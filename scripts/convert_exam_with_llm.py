from __future__ import annotations

import asyncio
import ast
import argparse
import json
import os
import re
import sys
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Reuse importer section-header heuristic when available so LLM chunk boundaries
# stay aligned with the non-LLM pipeline behavior.
EXAM_IMPORTER_ROOT = PROJECT_ROOT / "exam-importer"
if EXAM_IMPORTER_ROOT.exists() and str(EXAM_IMPORTER_ROOT) not in sys.path:
    sys.path.insert(0, str(EXAM_IMPORTER_ROOT))

try:
    from app.import_pipeline.section_headers import match_section_header as _match_pipeline_section_header
except Exception:
    _match_pipeline_section_header = None

DEFAULT_PROVIDER = "openai"
DEFAULT_MODELS = {
    "openai": "gpt-4o-mini",
    "gemini": "gemini-3-flash",
    "anthropic": "claude-3-5-haiku-latest",
}
MODEL_FALLBACKS = {
    "openai": ("gpt-4.1-mini", "gpt-4o", "gpt-4.1"),
    "gemini": ("gemini-2.5-flash", "gemini-2.5-pro"),
    "anthropic": ("claude-3-5-sonnet-latest", "claude-3-7-sonnet-latest"),
}
PROVIDER_ALIASES = {
    "openai": "openai",
    "oai": "openai",
    "gemini": "gemini",
    "google": "gemini",
    "anthropic": "anthropic",
    "claude": "anthropic",
    "auto": "auto",
}
PROVIDER_ENV_KEYS = {
    "openai": ("OPENAI_API_KEY",),
    "gemini": ("GEMINI_API_KEY", "GOOGLE_API_KEY"),
    "anthropic": ("ANTHROPIC_API_KEY",),
}
DOCX_PARSER_CHOICES = ("auto", "js", "python")
DEFAULT_TF_POINTS = [0.1, 0.25, 0.5, 1]

SYSTEM_PROMPT = """\
Bạn là một AI extraction engine chuyển đổi nội dung đề thi THPT 2025-2026 từ văn bản đã trích xuất thành JSON exam.json.

Cấu trúc đề thi THPT QG 2025:
- PHẦN I (single_choice): 18 câu × 0.25đ = 4.5đ (Toán: 12 câu × 0.25đ = 3.0đ)
- PHẦN II (true_false): 4 câu × 4 mệnh đề. Điểm: 1 đúng=0.1, 2 đúng=0.25, 3 đúng=0.5, 4 đúng=1.0
- PHẦN III (short_answer): 6 câu. Toán: 0.5đ/câu, các môn khác: 0.25đ/câu
- Tổng: 10 điểm.

Bắt buộc:
- Không bịa dữ liệu.
- Không tự suy luận đáp án nếu tài liệu không có.
- Nếu thiếu/không chắc: giữ nguyên text tối đa, dùng null khi phù hợp.
- Không thêm field ngoài schema.
- Nếu nội dung gồm nhiều block (text/rich text/image/table), dùng mảng content.
- PHẦN I -> single_choice, PHẦN II -> true_false, PHẦN III -> short_answer.
- Part IDs: "part-1", "part-2", "part-3".
- Question IDs: số thứ tự trong từng phần, bắt đầu từ "1" (VD: "1", "2", "3").
- Statement IDs cho true_false: chữ cái đơn "a", "b", "c", "d".
- Chỉ trả về JSON hợp lệ, không giải thích.
"""

MARKS = ["bold", "italic", "sup", "sub"]

TEXT_NODE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["type", "text"],
    "properties": {
        "type": {"const": "text"},
        "text": {"type": "string"},
        "marks": {
            "type": "array",
            "items": {"type": "string", "enum": MARKS},
        },
    },
}

IMAGE_NODE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["image"],
    "properties": {
        "image": {"type": "string"},
        "align": {"type": "string"},
        "width": {"type": ["number", "integer"]},
    },
}

MATH_NODE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["math"],
    "properties": {
        "math": {"type": "string"},
        "display": {"type": "string"},
    },
}

TABLE_CELL_ITEM_SCHEMA: dict[str, Any] = {
    "anyOf": [
        {"type": "string"},
        TEXT_NODE_SCHEMA,
        MATH_NODE_SCHEMA,
    ]
}

TABLE_NODE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["type", "rows"],
    "properties": {
        "type": {"const": "table"},
        "rows": {
            "type": "array",
            "items": {
                "type": "array",
                "items": {
                    "type": "array",
                    "items": TABLE_CELL_ITEM_SCHEMA,
                },
            },
        },
    },
}

CONTENT_NODE_SCHEMA: dict[str, Any] = {
    "anyOf": [
        {"type": "string"},
        TEXT_NODE_SCHEMA,
        IMAGE_NODE_SCHEMA,
        MATH_NODE_SCHEMA,
        TABLE_NODE_SCHEMA,
    ]
}

CONTENT_VALUE_SCHEMA: dict[str, Any] = {
    "anyOf": [
        {"type": "string"},
        {
            "type": "array",
            "items": CONTENT_NODE_SCHEMA,
        },
    ]
}

SINGLE_CHOICE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["id", "type", "content", "points", "options", "correct_answer"],
    "properties": {
        "id": {"type": "string"},
        "type": {"const": "single_choice"},
        "content": CONTENT_VALUE_SCHEMA,
        "points": {"type": ["number", "integer"]},
        "options": {
            "type": "array",
            "minItems": 4,
            "maxItems": 4,
            "items": CONTENT_VALUE_SCHEMA,
        },
        "correct_answer": {
            "anyOf": [
                {"type": "integer"},
                {"type": "string"},
                {"type": "null"},
            ]
        },
    },
}

TRUE_FALSE_STATEMENT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["id", "content", "correct"],
    "properties": {
        "id": {"type": "string"},
        "content": CONTENT_VALUE_SCHEMA,
        "correct": {
            "anyOf": [
                {"type": "boolean"},
                {"type": "string"},
                {"type": "null"},
            ]
        },
    },
}

TRUE_FALSE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["id", "type", "content", "points", "statements"],
    "properties": {
        "id": {"type": "string"},
        "type": {"const": "true_false"},
        "content": CONTENT_VALUE_SCHEMA,
        "points": {
            "type": "array",
            "items": {"type": ["number", "integer"]},
        },
        "statements": {
            "type": "array",
            "items": TRUE_FALSE_STATEMENT_SCHEMA,
        },
    },
}

SHORT_ANSWER_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["id", "type", "content", "points", "correct_answer"],
    "properties": {
        "id": {"type": "string"},
        "type": {"const": "short_answer"},
        "content": CONTENT_VALUE_SCHEMA,
        "points": {"type": ["number", "integer"]},
        "correct_answer": {
            "anyOf": [
                {"type": "string"},
                {"type": "number"},
                {"type": "integer"},
                {"type": "null"},
            ]
        },
    },
}

EXAM_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["id", "title", "subject", "time", "description", "parts"],
    "properties": {
        "id": {"type": "string"},
        "title": {"type": "string"},
        "subject": {"type": "string"},
        "time": {"type": ["number", "integer"]},
        "description": {"type": "string"},
        "parts": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["id", "name", "description", "questions"],
                "properties": {
                    "id": {"type": "string"},
                    "name": {"type": "string"},
                    "description": {"type": "string"},
                    "questions": {
                        "type": "array",
                        "items": {
                            "oneOf": [
                                SINGLE_CHOICE_SCHEMA,
                                TRUE_FALSE_SCHEMA,
                                SHORT_ANSWER_SCHEMA,
                            ]
                        },
                    },
                },
            },
        },
    },
}


QUESTION_BOUNDARY_RE = re.compile(
    r"^\s*(?:Câu|Cau|Question|Q)\s*\d{1,4}\s*[:\.\)\-]",
    re.IGNORECASE,
)
SECTION_HEADER_RE = re.compile(
    r"^\s*(?:PHẦN|PHAN|PART)\s*(?:IV|III|II|I|[1234])(?=[\s\.\:\)\-]|$)",
    re.IGNORECASE,
)

# Chunk schema keeps strict structure for extracted questions while allowing
# metadata fields to be omitted/empty in per-chunk responses.
CHUNK_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["parts"],
    "properties": {
        "id": {"type": ["string", "null"]},
        "title": {"type": ["string", "null"]},
        "subject": {"type": ["string", "null"]},
        "time": {"type": ["number", "integer", "null"]},
        "description": {"type": ["string", "null"]},
        "parts": EXAM_SCHEMA["properties"]["parts"],
    },
}


@dataclass(slots=True)
class RawTextChunk:
    id: str
    raw_markup_input: str
    line_start: int = 0
    line_end: int = 0


def _is_chunk_boundary_line(line: str) -> bool:
    if QUESTION_BOUNDARY_RE.match(line):
        return True
    if _match_pipeline_section_header is not None and _match_pipeline_section_header(line or ""):
        return True
    return bool(SECTION_HEADER_RE.match(line or ""))


def build_question_boundary_chunks(
    raw_text: str,
    *,
    max_chunk_chars: int = 6000,
) -> list[RawTextChunk]:
    if max_chunk_chars <= 0:
        raise ValueError("max_chunk_chars must be > 0.")

    lines = [line for line in str(raw_text or "").splitlines() if str(line).strip()]
    if not lines:
        return []

    chunks: list[RawTextChunk] = []
    current_lines: list[str] = []
    chunk_start = 0

    def flush(line_end: int) -> None:
        nonlocal current_lines, chunk_start
        if not current_lines:
            return
        chunks.append(
            RawTextChunk(
                id=f"chunk_{len(chunks) + 1}",
                raw_markup_input="\n".join(current_lines),
                line_start=chunk_start,
                line_end=line_end,
            )
        )
        current_lines = []
        chunk_start = line_end

    for idx, line in enumerate(lines):
        candidate = "\n".join(current_lines + [line]) if current_lines else line
        is_boundary = _is_chunk_boundary_line(line)
        if current_lines and len(candidate) > max_chunk_chars and is_boundary:
            flush(idx)
        current_lines.append(line)

    flush(len(lines))
    return chunks


def _strip_accents(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def _normalize_for_answer_detection(value: str) -> str:
    text = _strip_accents(str(value or "")).lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s{2,}", " ", text).strip()


def _answer_line_signal_score(value: str) -> int:
    text = _normalize_for_answer_detection(value)
    if not text:
        return 0

    score = 0
    if re.search(r"\b(cau|question)\s*\d{1,4}\b", text):
        score += 1
    if re.search(r"\b\d{1,3}\s*[\.\):\-]?\s*[abcd]\b", text):
        score += 2
    if re.search(r"\b(cau|question)\s*\d{1,4}\s*[\.\):\-]?\s*[abcd]\b", text):
        score += 2
    if re.search(r"\b(da|sai|dung|true|false)\b", text):
        score += 1
    return score


def _heading_signal_score(value: str) -> int:
    text = _normalize_for_answer_detection(value)
    if not text:
        return 0

    score = 0
    strong_markers = (
        "dap an",
        "answer key",
        "huong dan giai",
        "loi giai",
        "goi y giai",
        "solution",
        "solutions",
    )
    for marker in strong_markers:
        if marker in text:
            score += 3
    if re.search(r"\b(phan|part)\s*(iv|4)\b", text):
        score += 1
    if re.search(r"\b(giai thich|explain|explanation)\b", text):
        score += 1
    return score


def _detect_answer_section_start_line(lines: list[str]) -> int | None:
    if not lines:
        return None

    max_lookahead = 12
    for idx, line in enumerate(lines):
        heading_score = _heading_signal_score(line)
        if heading_score <= 0:
            continue

        nearby_score = 0
        non_empty = 0
        for probe in range(idx + 1, min(len(lines), idx + 1 + max_lookahead)):
            current = lines[probe]
            if not str(current).strip():
                continue
            non_empty += 1
            nearby_score += _answer_line_signal_score(current)

        # Flexible confidence check:
        # - accept clear heading + enough answer-like lines
        # - or very strong heading alone (e.g. "DAP AN", "HUONG DAN GIAI")
        if heading_score >= 6:
            return idx
        if heading_score >= 3 and nearby_score >= 3:
            return idx
        if heading_score >= 4 and non_empty <= 2:
            return idx
    return None


def _trim_answer_guidance_section(raw_text: str) -> tuple[str, int | None]:
    lines = str(raw_text or "").splitlines()
    cut_line = _detect_answer_section_start_line(lines)
    if cut_line is None:
        return str(raw_text or ""), None

    kept_lines = lines[:cut_line]
    trimmed = "\n".join(kept_lines).strip()
    if not trimmed:
        return str(raw_text or ""), None
    return trimmed, cut_line + 1


def slugify(value: str) -> str:
    ascii_text = _strip_accents(str(value or "")).lower()
    ascii_text = re.sub(r"[^a-z0-9]+", "-", ascii_text)
    ascii_text = re.sub(r"-{2,}", "-", ascii_text).strip("-")
    return ascii_text or "exam-imported"


def normalize_subject(value: str) -> str:
    source = _strip_accents(str(value or "")).lower().strip()
    if not source:
        return "khac"
    if "sinh" in source:
        return "sinh"
    if "toan" in source:
        return "toan"
    if "vat ly" in source or source == "ly" or "ly " in source:
        return "ly"
    if "hoa" in source:
        return "hoa"
    if "van" in source or "ngu van" in source:
        return "van"
    if "anh" in source or "tieng anh" in source:
        return "anh"
    return source.split()[0]


def default_short_answer_points(subject: str) -> float:
    normalized = str(subject or "").strip().lower()
    return 0.5 if normalized in {"toan", "math"} else 0.25


def extract_time_minutes(raw_text: str, fallback: int = 0) -> int:
    text = _strip_accents(str(raw_text or "")).lower()
    patterns = [
        r"thoi\s*gian\s*lam\s*bai[^0-9]{0,20}(\d{1,3})\s*phut",
        r"(\d{1,3})\s*phut",
    ]
    for pat in patterns:
        match = re.search(pat, text)
        if match:
            return int(match.group(1))
    return int(fallback or 0)


def _coerce_number(value: Any, fallback: float) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        candidate = value.strip().replace(",", ".")
        if re.fullmatch(r"-?\d+(\.\d+)?", candidate):
            return float(candidate)
    return float(fallback)


def _coerce_optional_number(value: Any) -> int | float | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        number = float(value)
        if number.is_integer():
            return int(number)
        return number
    if not isinstance(value, str):
        return None

    text = value.strip().lower()
    if not text:
        return None
    if text.endswith("px"):
        text = text[:-2].strip()
    if text.endswith("%"):
        text = text[:-1].strip()

    match = re.search(r"-?\d+(?:[.,]\d+)?", text)
    if not match:
        return None
    try:
        number = float(match.group(0).replace(",", "."))
    except ValueError:
        return None
    if number.is_integer():
        return int(number)
    return number


def _resolve_image_filename(image_ref: str, image_map: dict[str, Any] | None) -> str:
    text = str(image_ref or "").strip()
    if not text:
        return text

    # Already a path/filename/url with extension.
    if re.search(r"\.[a-zA-Z0-9]{2,6}(?:[?#].*)?$", text):
        return text
    if "/" in text or "\\" in text or text.startswith("data:") or text.startswith("http"):
        return text

    mapping = image_map if isinstance(image_map, dict) else {}
    if not mapping:
        return text

    direct = mapping.get(text)
    if isinstance(direct, str) and direct.strip():
        return direct.strip()
    if isinstance(direct, dict):
        filename = str(direct.get("filename") or "").strip()
        if filename:
            return filename

    # Fallback search by filename stem.
    for key, value in mapping.items():
        if str(key).strip() != text:
            continue
        if isinstance(value, str) and value.strip():
            return value.strip()
        if isinstance(value, dict):
            filename = str(value.get("filename") or "").strip()
            if filename:
                return filename

    for value in mapping.values():
        if isinstance(value, str):
            name = value.strip()
            if re.sub(r"\.[a-zA-Z0-9]{2,6}$", "", name) == text:
                return name
        elif isinstance(value, dict):
            filename = str(value.get("filename") or "").strip()
            if filename and re.sub(r"\.[a-zA-Z0-9]{2,6}$", "", filename) == text:
                return filename

    return text


INLINE_TOKEN_RE = re.compile(
    r"(\[(?:math|!m):\$[\s\S]*?\$\]|\[(?:math|!m):[^\]]+\]|\[img:\$[^$]+\$\]|\[img:[^\]]+\]|\[!(?:sup|sub|b|i):\$[\s\S]*?\$\])",
    flags=re.IGNORECASE,
)


def _parse_markup_string_to_nodes(value: str, image_map: dict[str, Any] | None) -> list[Any]:
    text = str(value or "")
    if not text:
        return [""]

    nodes: list[Any] = []
    parts = [part for part in INLINE_TOKEN_RE.split(text) if part != ""]
    for part in parts:
        math_match = re.match(r"^\[(?:math|!m):\$(.*?)\$\]$", part, flags=re.IGNORECASE | re.DOTALL)
        if math_match:
            nodes.append({"math": str(math_match.group(1) or "").strip()})
            continue

        math_plain_match = re.match(r"^\[(?:math|!m):([^\]]+)\]$", part, flags=re.IGNORECASE | re.DOTALL)
        if math_plain_match:
            nodes.append({"math": str(math_plain_match.group(1) or "").strip()})
            continue

        img_match = re.match(r"^\[img:(.+)\]$", part, flags=re.IGNORECASE | re.DOTALL)
        if img_match:
            raw_id = str(img_match.group(1) or "").strip()
            if raw_id.startswith("$") and raw_id.endswith("$") and len(raw_id) >= 2:
                raw_id = raw_id[1:-1].strip()
            nodes.append({"image": _resolve_image_filename(raw_id, image_map)})
            continue

        mark_match = re.match(r"^\[!(sup|sub|b|i):\$(.*?)\$\]$", part, flags=re.IGNORECASE | re.DOTALL)
        if mark_match:
            mark_raw = str(mark_match.group(1) or "").strip().lower()
            inner_text = str(mark_match.group(2) or "")
            mark_map = {"sup": "sup", "sub": "sub", "b": "bold", "i": "italic"}
            mark = mark_map.get(mark_raw)
            if mark:
                nodes.append({"type": "text", "text": inner_text, "marks": [mark]})
                continue

        nodes.append(part)

    return nodes


def _sanitize_content_node(node: Any, image_map: dict[str, Any] | None = None) -> Any:
    if isinstance(node, str):
        parsed = _parse_markup_string_to_nodes(node, image_map)
        return parsed[0] if len(parsed) == 1 else parsed
    if not isinstance(node, dict):
        return node

    if "image" in node:
        sanitized: dict[str, Any] = {
            "image": _resolve_image_filename(str(node.get("image") or ""), image_map)
        }
        align = node.get("align")
        if isinstance(align, str):
            sanitized["align"] = align
        width = _coerce_optional_number(node.get("width"))
        if width is not None:
            sanitized["width"] = width
        return sanitized

    if "math" in node:
        sanitized_math: dict[str, Any] = {"math": str(node.get("math") or "")}
        display = node.get("display")
        if isinstance(display, str) and display.strip():
            sanitized_math["display"] = display.strip()
        return sanitized_math

    if node.get("type") == "text":
        sanitized = {"type": "text", "text": str(node.get("text") or "")}
        marks = node.get("marks")
        if isinstance(marks, list):
            sanitized["marks"] = [mark for mark in marks if mark in MARKS]
        return sanitized

    if node.get("type") == "table":
        rows = node.get("rows")
        if not isinstance(rows, list):
            return {"type": "table", "rows": []}
        sanitized_rows: list[list[list[Any]]] = []
        for row in rows:
            if not isinstance(row, list):
                continue
            sanitized_row: list[list[Any]] = []
            for cell in row:
                if not isinstance(cell, list):
                    continue
                sanitized_cell: list[Any] = []
                for item in cell:
                    if isinstance(item, str):
                        parsed = _parse_markup_string_to_nodes(item, image_map)
                        sanitized_cell.extend(parsed)
                    elif isinstance(item, dict):
                        nested = _sanitize_content_node(item, image_map)
                        if isinstance(nested, list):
                            sanitized_cell.extend(nested)
                        else:
                            sanitized_cell.append(nested)
                sanitized_row.append(sanitized_cell)
            sanitized_rows.append(sanitized_row)
        return {"type": "table", "rows": sanitized_rows}

    return node


_OPTION_LABEL_PREFIX_RE = re.compile(
    r'^\s*[A-Da-d][.):]\s*',
)


def _strip_option_label_prefix(value: Any) -> Any:
    """Remove leading A./B./C./D. prefix from option text.

    The UI already renders its own A/B/C/D badge, so the raw text
    must not repeat the label.  Handles both plain strings and
    rich-content arrays whose first element is a string.
    """
    if isinstance(value, str):
        return _OPTION_LABEL_PREFIX_RE.sub('', value)
    if isinstance(value, list) and value:
        first = value[0]
        if isinstance(first, str):
            stripped = _OPTION_LABEL_PREFIX_RE.sub('', first)
            if stripped != first:
                return [stripped, *value[1:]]
    return value


def _sanitize_content_value(value: Any, image_map: dict[str, Any] | None = None) -> Any:
    if isinstance(value, str):
        parsed = _parse_markup_string_to_nodes(value, image_map)
        if len(parsed) == 1 and isinstance(parsed[0], str):
            return parsed[0]
        return parsed
    if isinstance(value, list):
        out: list[Any] = []
        for item in value:
            sanitized = _sanitize_content_node(item, image_map)
            if isinstance(sanitized, list):
                out.extend(sanitized)
            else:
                out.append(sanitized)
        return out
    return value


def _normalize_single_choice_answer(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, int):
        return value if 0 <= value <= 3 else None
    text = str(value).strip().upper()
    letter_to_index = {"A": 0, "B": 1, "C": 2, "D": 3}
    if text in letter_to_index:
        return letter_to_index[text]
    if text.isdigit():
        number = int(text)
        return number if 0 <= number <= 3 else None
    return None


def _normalize_boolean(value: Any) -> bool | None:
    if value is None or isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        if value == 1:
            return True
        if value == 0:
            return False
        return None

    text = _strip_accents(str(value)).strip().lower()
    if text in {"d", "dung", "true", "t", "yes", "y", "1"}:
        return True
    if text in {"s", "sai", "false", "f", "no", "n", "0"}:
        return False
    if text in {"", "null", "none"}:
        return None
    return None


def _infer_part_id(index: int, raw_id: str, name: str) -> str:
    candidate = str(raw_id or "").strip().lower()
    if candidate:
        if candidate.startswith("part"):
            if candidate in {"part1", "part_1", "part-1"}:
                return "part-1"
            if candidate in {"part2", "part_2", "part-2"}:
                return "part-2"
            if candidate in {"part3", "part_3", "part-3"}:
                return "part-3"
            return candidate
        if candidate in {"i", "ii", "iii"}:
            return {"i": "part-1", "ii": "part-2", "iii": "part-3"}[candidate]

    name_text = _strip_accents(str(name or "")).upper()
    if "PHAN I" in name_text:
        return "part-1"
    if "PHAN II" in name_text:
        return "part-2"
    if "PHAN III" in name_text:
        return "part-3"
    return f"part-{index}"


def _normalize_question_id(raw_id: Any, fallback_index: int) -> str:
    """Normalize question ID to a plain numeric string.

    Production format always uses "1", "2", etc. per part.
    The LLM may return "q1", "Câu 1", "question_1", "1", etc.
    """
    text = str(raw_id or "").strip()
    if not text:
        return str(fallback_index)
    # Extract leading/trailing digits from common patterns
    match = re.search(r"\d+", text)
    if match:
        return str(int(match.group(0)))
    return str(fallback_index)


def _normalize_statement_id(raw_id: Any, fallback_index: int) -> str:
    """Normalize statement ID to a single lowercase letter.

    Production format always uses "a", "b", "c", "d".
    The LLM may return "q1a", "1a", "stmt-a", "a", etc.
    """
    text = str(raw_id or "").strip().lower()
    if not text:
        return chr(ord('a') + fallback_index) if fallback_index < 26 else f"s{fallback_index}"
    # Try to extract the trailing single letter
    match = re.search(r'([a-d])$', text)
    if match:
        return match.group(1)
    # Fallback: if the whole string is a single letter
    if len(text) == 1 and text.isalpha():
        return text
    return chr(ord('a') + fallback_index) if fallback_index < 26 else f"s{fallback_index}"


def _canonical_question_type(value: str) -> str:
    t = str(value or "").strip().lower()
    aliases = {
        "single": "single_choice",
        "single_choice": "single_choice",
        "multiple_choice": "single_choice",
        "trac_nghiem": "single_choice",
        "true_false": "true_false",
        "true_false_group": "true_false",
        "dung_sai": "true_false",
        "short_answer": "short_answer",
        "short": "short_answer",
        "tu_luan_ngan": "short_answer",
    }
    return aliases.get(t, t)


def _strip_markup_for_detection(text: str) -> str:
    """
    Flatten raw extractor markers into plain text for robust regex detection.
    """
    value = str(text or "")
    for _ in range(8):
        next_value = re.sub(r"\[!(?:b|i|sup|sub):\$(.*?)\$\]", r"\1", value, flags=re.DOTALL)
        if next_value == value:
            break
        value = next_value
    value = re.sub(r"\[math:[^\]]+\]", " ", value, flags=re.IGNORECASE)
    value = re.sub(r"\[img:[^\]]+\]", " ", value, flags=re.IGNORECASE)
    value = re.sub(r"[ \t]+", " ", value)
    return value


def _normalize_raw_markup_tokens(raw_text: str) -> str:
    text = str(raw_text or "")
    if not text:
        return text

    # Keep one canonical math token form so downstream heuristics are stable.
    text = re.sub(
        r"\[(?:!m|math):\$(.*?)\$\]",
        r"[math:$\1$]",
        text,
        flags=re.IGNORECASE | re.DOTALL,
    )
    text = re.sub(
        r"\[(?:!m|math):(?!\$)(.*?)\]",
        lambda m: f"[math:${m.group(1).strip()}$]",
        text,
        flags=re.IGNORECASE | re.DOTALL,
    )
    text = re.sub(
        r"\[img:\$(.*?)\$\]",
        lambda m: f"[img:{m.group(1).strip()}]",
        text,
        flags=re.IGNORECASE | re.DOTALL,
    )
    return text


def _load_docx_with_exam_importer_parser(
    input_path: Path,
    asset_dir: Path | None,
) -> tuple[str, dict[str, Any]]:
    from app.import_pipeline.extractor import extract_word_data

    target_asset_dir = asset_dir or (input_path.parent / "assets")
    extracted = extract_word_data(docx_path=input_path, asset_dir=target_asset_dir)
    assets = extracted.assets if isinstance(getattr(extracted, "assets", None), dict) else {}
    image_map = assets.get("images", {}) if isinstance(assets.get("images"), dict) else {}
    raw_text = _normalize_raw_markup_tokens(getattr(extracted, "raw_markup_input", ""))
    return raw_text, image_map


def _load_docx_with_raw_extractor(
    input_path: Path,
    asset_dir: Path | None,
) -> tuple[str, dict[str, Any]]:
    from lib.raw_extractor import convert_to_raw_markdown

    raw_text, image_map = convert_to_raw_markdown(
        docx_path=input_path,
        assets_dir=asset_dir,
    )
    return _normalize_raw_markup_tokens(raw_text), image_map


def _iter_text_values(value: Any):
    if isinstance(value, str):
        yield value
        return
    if isinstance(value, list):
        for item in value:
            yield from _iter_text_values(item)
        return
    if isinstance(value, dict):
        if "math" in value:
            math_text = str(value.get("math") or "").strip()
            if math_text:
                yield f"[math:${math_text}$]"
            return
        if "image" in value:
            image_ref = str(value.get("image") or "").strip()
            if image_ref:
                yield f"[img:{image_ref}]"
            return

        node_type = value.get("type")
        if node_type == "text":
            text = value.get("text")
            if isinstance(text, str):
                yield text
            return
        if node_type == "table":
            rows = value.get("rows")
            if isinstance(rows, list):
                for row in rows:
                    yield from _iter_text_values(row)
            return

        for key, item in value.items():
            if key in {
                "id",
                "type",
                "name",
                "description",
                "subject",
                "title",
                "time",
                "points",
                "correct",
                "correct_answer",
                "align",
                "width",
                "display",
            }:
                continue
            yield from _iter_text_values(item)


def _count_math_markers_in_text(value: str) -> int:
    text = str(value or "")
    if not text:
        return 0
    return len(re.findall(r"\[(?:math|!m):[^\]]+\]", text, flags=re.IGNORECASE))


def _count_math_markers_in_value(value: Any) -> int:
    if isinstance(value, str):
        return _count_math_markers_in_text(value)
    if isinstance(value, list):
        return sum(_count_math_markers_in_value(item) for item in value)
    if not isinstance(value, dict):
        return 0

    if "math" in value:
        return 1 if str(value.get("math") or "").strip() else 0
    if "image" in value:
        return 0

    node_type = value.get("type")
    if node_type == "text":
        return _count_math_markers_in_value(value.get("text"))
    if node_type == "table":
        return _count_math_markers_in_value(value.get("rows"))

    total = 0
    for key, item in value.items():
        if key in {
            "id",
            "type",
            "name",
            "description",
            "subject",
            "title",
            "time",
            "points",
            "correct",
            "correct_answer",
            "align",
            "width",
            "display",
        }:
            continue
        total += _count_math_markers_in_value(item)
    return total


def _chunk_degradation_error(
    chunk: RawTextChunk,
    payload: dict[str, Any],
) -> str | None:
    raw = chunk.raw_markup_input
    src_math = _count_math_markers_in_text(raw)

    out_math = 0
    total_questions = 0
    total_empty_content = 0
    dot_like_options = 0

    parts = payload.get("parts")
    if not isinstance(parts, list):
        return None

    for part in parts:
        if not isinstance(part, dict):
            continue
        questions = part.get("questions")
        if not isinstance(questions, list):
            continue
        for question in questions:
            if not isinstance(question, dict):
                continue
            total_questions += 1
            content = question.get("content", "")
            flat_content = " ".join(
                item.strip()
                for item in _iter_text_values(content)
                if isinstance(item, str) and item.strip()
            ).strip()
            if not flat_content:
                total_empty_content += 1
            out_math += _count_math_markers_in_value(question)
            options = question.get("options")
            if isinstance(options, list):
                for option in options:
                    opt_text = " ".join(
                        item.strip()
                        for item in _iter_text_values(option)
                        if isinstance(item, str) and item.strip()
                    ).strip()
                    if opt_text in {".", "·", "…"}:
                        dot_like_options += 1

    if src_math > 0 and out_math == 0:
        return "missing math markers from chunk content"
    if dot_like_options >= 2:
        return "placeholder options like '.' detected"
    if total_questions >= 3 and total_empty_content * 2 >= total_questions:
        return "too many empty question content values"
    return None


def _format_chunk_error_message(chunk_id: str, error: Exception) -> str:
    message = str(error).strip() or type(error).__name__
    prefix = f"{chunk_id}:"
    if message.lower().startswith(prefix.lower()):
        return message
    return f"{chunk_id}: {message}"


def _extract_question_number_from_qid(qid: str, fallback: int) -> int:
    match = re.search(r"\d+", str(qid or ""))
    if match:
        return int(match.group(0))
    return fallback


def _split_abcd_options(text: str) -> list[str]:
    """
    Split inline/multiline A/B/C/D options from a question block.
    Returns exactly 4 items when successful, otherwise [].
    """
    source = str(text or "").strip()
    if not source:
        return []

    # Normalize spacing while keeping line boundaries useful.
    source = source.replace("\r", "\n")

    pattern = re.compile(
        r"(?:^|\s)([A-D])[\.\):]\s*([\s\S]*?)(?=(?:\s+[A-D][\.\):]\s*)|(?:\n\s*(?:Câu|PHẦN)\b)|$)",
        flags=re.IGNORECASE,
    )
    matches = list(pattern.finditer(source))
    if len(matches) < 4:
        return []

    # Prefer first full A->D set.
    for i in range(len(matches) - 3):
        labels = [matches[i + k].group(1).upper() for k in range(4)]
        if labels != ["A", "B", "C", "D"]:
            continue
        options = []
        for k in range(4):
            option_text = matches[i + k].group(2).strip()
            option_text = re.sub(r"\s+", " ", option_text).strip()
            options.append(option_text)
        if all(options):
            return options

    return []


def _extract_part1_option_lookup(raw_text: str) -> dict[int, list[str]]:
    """
    Build lookup question_no -> [A,B,C,D] from raw text in PART I.
    """
    plain = _strip_markup_for_detection(raw_text)

    start_match = re.search(r"(?:PHẦN|PHAN)\s*I\b", plain, flags=re.IGNORECASE)
    if not start_match:
        return {}
    start = start_match.start()

    end_match = re.search(r"(?:PHẦN|PHAN)\s*II\b", plain[start:], flags=re.IGNORECASE)
    end = start + end_match.start() if end_match else len(plain)
    part1_text = plain[start:end]

    q_pattern = re.compile(r"(?:Câu|Cau)\s*(\d{1,3})[\.\):]\s*", flags=re.IGNORECASE)
    matches = list(q_pattern.finditer(part1_text))
    if not matches:
        return {}

    lookup: dict[int, list[str]] = {}
    for idx, match in enumerate(matches):
        q_no = int(match.group(1))
        block_start = match.start()
        block_end = matches[idx + 1].start() if idx + 1 < len(matches) else len(part1_text)
        block = part1_text[block_start:block_end]
        options = _split_abcd_options(block)
        if len(options) == 4:
            lookup[q_no] = options
    return lookup


def _coerce_option_value(value: Any) -> Any:
    if isinstance(value, (str, list)):
        return value
    if value is None:
        return ""
    return str(value)


def _salvage_single_choice_options(
    question_content: Any,
    model_options: Any,
    question_number: int,
    part1_lookup: dict[int, list[str]],
) -> list[Any]:
    """
    Recover missing/invalid A-D options from multiple sources.
    Priority:
    1) model options (if already 4)
    2) parse from question content
    3) lookup from raw part I text
    """
    if isinstance(model_options, list):
        coerced = [_coerce_option_value(item) for item in model_options if item is not None]
        if len(coerced) == 4:
            return coerced
    else:
        coerced = []

    # Attempt parse from question content blocks.
    content_text = ""
    if isinstance(question_content, str):
        content_text = question_content
    elif isinstance(question_content, list):
        chunks = []
        for node in question_content:
            if isinstance(node, str):
                chunks.append(node)
            elif isinstance(node, dict) and node.get("type") == "text":
                chunks.append(str(node.get("text", "")))
        content_text = "\n".join(chunks)
    inline = _split_abcd_options(_strip_markup_for_detection(content_text))
    if len(inline) == 4:
        return inline

    # Fallback to raw text lookup.
    from_raw = part1_lookup.get(question_number)
    if from_raw and len(from_raw) == 4:
        return from_raw

    return coerced


def normalize_provider(value: str) -> str:
    key = str(value or "").strip().lower()
    if not key:
        return DEFAULT_PROVIDER
    if key not in PROVIDER_ALIASES:
        supported = ", ".join(sorted(PROVIDER_ALIASES))
        raise ValueError(f"Unsupported provider '{value}'. Supported: {supported}")
    return PROVIDER_ALIASES[key]


def default_model_for_provider(provider: str) -> str:
    normalized = normalize_provider(provider)
    if normalized == "auto":
        normalized = DEFAULT_PROVIDER
    return DEFAULT_MODELS.get(normalized, DEFAULT_MODELS[DEFAULT_PROVIDER])


def infer_provider_from_api_key(api_key: str | None) -> str | None:
    key = str(api_key or "").strip()
    if not key:
        return None

    lowered = key.lower()
    if lowered.startswith("sk-ant-"):
        return "anthropic"
    if key.startswith("AIza"):
        return "gemini"
    if lowered.startswith(("sk-", "sess-", "rk-")):
        return "openai"
    return None


def infer_provider_from_model(model: str | None) -> str | None:
    value = str(model or "").strip().lower()
    if not value:
        return None
    if value.startswith("claude"):
        return "anthropic"
    if value.startswith("gemini"):
        return "gemini"
    if value.startswith(("gpt", "o1", "o3", "o4", "chatgpt")):
        return "openai"
    return None


def candidate_models_for_provider(provider: str, requested_model: str | None = None) -> list[str]:
    normalized = normalize_provider(provider)
    if normalized == "auto":
        normalized = DEFAULT_PROVIDER

    candidates: list[str] = []

    def _push(model_name: str | None) -> None:
        value = str(model_name or "").strip()
        if not value:
            return
        if value not in candidates:
            candidates.append(value)

    _push(requested_model)
    _push(default_model_for_provider(normalized))
    for fallback in MODEL_FALLBACKS.get(normalized, ()):
        _push(fallback)
    return candidates


def _resolve_provider_for_execution(
    provider: str,
    api_key: str | None = None,
    model: str | None = None,
) -> str:
    normalized = normalize_provider(provider)
    if normalized != "auto":
        return normalized

    if api_key:
        inferred = infer_provider_from_api_key(api_key)
        if inferred:
            return inferred

    inferred_from_model = infer_provider_from_model(model)
    if inferred_from_model:
        return inferred_from_model

    for candidate in ("openai", "gemini", "anthropic"):
        for env_name in PROVIDER_ENV_KEYS[candidate]:
            if os.environ.get(env_name):
                return candidate
    return DEFAULT_PROVIDER


def _resolve_api_key(provider: str, api_key: str | None) -> str:
    if api_key:
        return api_key

    for env_name in PROVIDER_ENV_KEYS[provider]:
        key = os.environ.get(env_name)
        if key:
            return key
    env_display = " or ".join(PROVIDER_ENV_KEYS[provider])
    raise ValueError(
        f"Missing API key for provider '{provider}'. Set {env_display} or pass --api-key."
    )


def _is_model_access_error(provider: str, error: Exception) -> bool:
    text = f"{type(error).__name__}: {error}".lower()
    if "model" not in text and "not_found" not in text and "404" not in text:
        return False

    generic_signals = (
        "does not exist",
        "not found",
        "unknown model",
        "unsupported model",
        "invalid model",
        "not available",
        "not enabled",
        "permission",
        "access",
        "404",
        "no matching model",
    )
    if any(signal in text for signal in generic_signals):
        return True

    provider_specific = {
        "openai": ("do not have access",),
        "gemini": ("for api version",),
        "anthropic": ("not_found_error",),
    }
    return any(signal in text for signal in provider_specific.get(provider, ()))


def _list_openai_models(api_key: str) -> list[str]:
    from openai import OpenAI

    client = OpenAI(api_key=api_key)
    response = client.models.list()
    data = getattr(response, "data", None)
    if not isinstance(data, list):
        return []
    models = [str(getattr(item, "id", "")).strip() for item in data]
    return [name for name in models if name]


def _list_gemini_models(api_key: str) -> list[str]:
    import google.generativeai as genai

    genai.configure(api_key=api_key)
    models: list[str] = []
    for item in genai.list_models():
        methods = getattr(item, "supported_generation_methods", None)
        if isinstance(methods, list) and "generateContent" not in methods:
            continue
        name = str(getattr(item, "name", "")).strip()
        if name.startswith("models/"):
            name = name[len("models/") :]
        if name:
            models.append(name)
    return models


def _list_anthropic_models(api_key: str) -> list[str]:
    from anthropic import Anthropic

    client = Anthropic(api_key=api_key)
    models_api = getattr(client, "models", None)
    if models_api is None or not hasattr(models_api, "list"):
        return []
    response = models_api.list()
    data = getattr(response, "data", None)
    if not isinstance(data, list):
        return []
    models = [str(getattr(item, "id", "")).strip() for item in data]
    return [name for name in models if name]


def _merge_models(primary: list[str], fallback: list[str]) -> list[str]:
    seen: set[str] = set()
    merged: list[str] = []
    for item in [*primary, *fallback]:
        value = str(item or "").strip()
        if not value or value in seen:
            continue
        seen.add(value)
        merged.append(value)
    return merged


def list_available_models(
    provider: str = "auto",
    *,
    api_key: str | None = None,
    requested_model: str | None = None,
) -> tuple[str, list[str]]:
    provider_name = _resolve_provider_for_execution(
        provider,
        api_key=api_key,
        model=requested_model,
    )

    fallback = candidate_models_for_provider(
        provider_name,
        requested_model=requested_model,
    )

    try:
        key = _resolve_api_key(provider_name, api_key=api_key)
    except Exception:
        return provider_name, fallback

    try:
        if provider_name == "openai":
            live = _list_openai_models(key)
        elif provider_name == "gemini":
            live = _list_gemini_models(key)
        elif provider_name == "anthropic":
            live = _list_anthropic_models(key)
        else:
            live = []
    except Exception:
        live = []

    return provider_name, _merge_models(live, fallback)


def _validate_text_node(node: Any, path: str) -> None:
    if not isinstance(node, dict):
        raise ValueError(f"{path}: text node must be object.")
    allowed = {"type", "text", "marks"}
    extra = set(node.keys()) - allowed
    if extra:
        raise ValueError(f"{path}: extra keys not allowed: {sorted(extra)}")
    if node.get("type") != "text":
        raise ValueError(f"{path}: text node type must be 'text'.")
    if not isinstance(node.get("text"), str):
        raise ValueError(f"{path}: text node text must be string.")
    marks = node.get("marks")
    if marks is None:
        return
    if not isinstance(marks, list):
        raise ValueError(f"{path}: marks must be array.")
    for idx, mark in enumerate(marks):
        if mark not in MARKS:
            raise ValueError(f"{path}.marks[{idx}]: invalid mark '{mark}'.")


def _validate_table_node(node: Any, path: str) -> None:
    if not isinstance(node, dict):
        raise ValueError(f"{path}: table node must be object.")
    allowed = {"type", "rows"}
    extra = set(node.keys()) - allowed
    if extra:
        raise ValueError(f"{path}: extra keys not allowed: {sorted(extra)}")
    if node.get("type") != "table":
        raise ValueError(f"{path}: table node type must be 'table'.")
    rows = node.get("rows")
    if not isinstance(rows, list):
        raise ValueError(f"{path}: table rows must be array.")
    for ridx, row in enumerate(rows):
        if not isinstance(row, list):
            raise ValueError(f"{path}.rows[{ridx}]: row must be array.")
        for cidx, cell in enumerate(row):
            if not isinstance(cell, list):
                raise ValueError(
                    f"{path}.rows[{ridx}][{cidx}]: cell must be array of text nodes."
                )
            for item_idx, item in enumerate(cell):
                item_path = f"{path}.rows[{ridx}][{cidx}][{item_idx}]"
                _validate_content_node(item, item_path)


def _validate_image_node(node: Any, path: str) -> None:
    if not isinstance(node, dict):
        raise ValueError(f"{path}: image node must be object.")
    allowed = {"image", "align", "width"}
    extra = set(node.keys()) - allowed
    if extra:
        raise ValueError(f"{path}: extra keys not allowed: {sorted(extra)}")
    image = node.get("image")
    if not isinstance(image, str) or not image.strip():
        raise ValueError(f"{path}: image must be non-empty string.")
    if "align" in node and not isinstance(node.get("align"), str):
        raise ValueError(f"{path}: align must be string.")
    if "width" in node and not isinstance(node.get("width"), (int, float)):
        raise ValueError(f"{path}: width must be number.")


def _validate_content_node(node: Any, path: str) -> None:
    if isinstance(node, str):
        return
    if not isinstance(node, dict):
        raise ValueError(f"{path}: content node must be string/object.")

    if node.get("type") == "text":
        _validate_text_node(node, path)
        return
    if node.get("type") == "table":
        _validate_table_node(node, path)
        return
    if "math" in node:
        if set(node.keys()) - {"math", "display"}:
            raise ValueError(f"{path}: extra keys not allowed for math node.")
        if not isinstance(node.get("math"), str):
            raise ValueError(f"{path}: math must be string.")
        if "display" in node and not isinstance(node.get("display"), str):
            raise ValueError(f"{path}: display must be string.")
        return
    if "image" in node:
        _validate_image_node(node, path)
        return
    raise ValueError(f"{path}: unsupported content object shape.")


def _validate_content_value(value: Any, path: str) -> None:
    if isinstance(value, str):
        return
    if not isinstance(value, list):
        raise ValueError(f"{path}: content must be string or array.")
    for idx, node in enumerate(value):
        _validate_content_node(node, f"{path}[{idx}]")


def _validate_exam_schema(exam: dict[str, Any]) -> None:
    root_required = {"id", "title", "subject", "time", "description", "parts"}
    if set(exam.keys()) != root_required:
        raise ValueError(
            f"root keys mismatch. required={sorted(root_required)} actual={sorted(exam.keys())}"
        )
    if not isinstance(exam["id"], str) or not exam["id"].strip():
        raise ValueError("id must be non-empty string.")
    if not isinstance(exam["title"], str):
        raise ValueError("title must be string.")
    if not isinstance(exam["subject"], str):
        raise ValueError("subject must be string.")
    if not isinstance(exam["time"], (int, float)):
        raise ValueError("time must be number.")
    if not isinstance(exam["description"], str):
        raise ValueError("description must be string.")
    if not isinstance(exam["parts"], list):
        raise ValueError("parts must be array.")

    for pidx, part in enumerate(exam["parts"]):
        ppath = f"parts[{pidx}]"
        if not isinstance(part, dict):
            raise ValueError(f"{ppath}: part must be object.")
        part_required = {"id", "name", "description", "questions"}
        if set(part.keys()) != part_required:
            raise ValueError(
                f"{ppath}: part keys mismatch. required={sorted(part_required)} actual={sorted(part.keys())}"
            )
        if not isinstance(part["id"], str):
            raise ValueError(f"{ppath}.id must be string.")
        if not isinstance(part["name"], str):
            raise ValueError(f"{ppath}.name must be string.")
        if not isinstance(part["description"], str):
            raise ValueError(f"{ppath}.description must be string.")
        if not isinstance(part["questions"], list):
            raise ValueError(f"{ppath}.questions must be array.")

        for qidx, q in enumerate(part["questions"]):
            qpath = f"{ppath}.questions[{qidx}]"
            if not isinstance(q, dict):
                raise ValueError(f"{qpath}: question must be object.")
            qtype = q.get("type")
            if qtype == "single_choice":
                required = {"id", "type", "content", "points", "options", "correct_answer"}
                if set(q.keys()) != required:
                    raise ValueError(
                        f"{qpath}: single_choice keys mismatch. required={sorted(required)} actual={sorted(q.keys())}"
                    )
                _validate_content_value(q["content"], f"{qpath}.content")
                if not isinstance(q["points"], (int, float)):
                    raise ValueError(f"{qpath}.points must be number.")
                if not isinstance(q["options"], list) or len(q["options"]) != 4:
                    raise ValueError(f"{qpath}.options must be array of 4 items.")
                for oidx, opt in enumerate(q["options"]):
                    _validate_content_value(opt, f"{qpath}.options[{oidx}]")
                if q["correct_answer"] is not None and not isinstance(q["correct_answer"], int):
                    raise ValueError(f"{qpath}.correct_answer must be integer|null.")

            elif qtype == "true_false":
                required = {"id", "type", "content", "points", "statements"}
                if set(q.keys()) != required:
                    raise ValueError(
                        f"{qpath}: true_false keys mismatch. required={sorted(required)} actual={sorted(q.keys())}"
                    )
                _validate_content_value(q["content"], f"{qpath}.content")
                if not isinstance(q["points"], list):
                    raise ValueError(f"{qpath}.points must be array.")
                for vidx, value in enumerate(q["points"]):
                    if not isinstance(value, (int, float)):
                        raise ValueError(f"{qpath}.points[{vidx}] must be number.")
                if not isinstance(q["statements"], list) or len(q["statements"]) == 0:
                    raise ValueError(f"{qpath}.statements must be non-empty array.")
                for sidx, statement in enumerate(q["statements"]):
                    spath = f"{qpath}.statements[{sidx}]"
                    required_stmt = {"id", "content", "correct"}
                    if not isinstance(statement, dict) or set(statement.keys()) != required_stmt:
                        raise ValueError(
                            f"{spath}: statement keys mismatch. required={sorted(required_stmt)}"
                        )
                    if not isinstance(statement["id"], str):
                        raise ValueError(f"{spath}.id must be string.")
                    _validate_content_value(statement["content"], f"{spath}.content")
                    if statement["correct"] is not None and not isinstance(statement["correct"], bool):
                        raise ValueError(f"{spath}.correct must be boolean|null.")

            elif qtype == "short_answer":
                required = {"id", "type", "content", "points", "correct_answer"}
                if set(q.keys()) != required:
                    raise ValueError(
                        f"{qpath}: short_answer keys mismatch. required={sorted(required)} actual={sorted(q.keys())}"
                    )
                _validate_content_value(q["content"], f"{qpath}.content")
                if not isinstance(q["points"], (int, float)):
                    raise ValueError(f"{qpath}.points must be number.")
                if q["correct_answer"] is not None and not isinstance(q["correct_answer"], str):
                    raise ValueError(f"{qpath}.correct_answer must be string|null.")
            else:
                raise ValueError(f"{qpath}: unsupported question type '{qtype}'.")


def _extract_openai_response_text(response: Any) -> str:
    output_text = getattr(response, "output_text", None)
    if isinstance(output_text, str) and output_text.strip():
        return output_text

    output = getattr(response, "output", None)
    if isinstance(output, list):
        for item in output:
            content = getattr(item, "content", None)
            if isinstance(content, list):
                for chunk in content:
                    text = getattr(chunk, "text", None)
                    if isinstance(text, str) and text.strip():
                        return text
                    if isinstance(chunk, dict):
                        text2 = chunk.get("text")
                        if isinstance(text2, str) and text2.strip():
                            return text2
            if isinstance(item, dict):
                for chunk in item.get("content", []):
                    if isinstance(chunk, dict):
                        text = chunk.get("text")
                        if isinstance(text, str) and text.strip():
                            return text

    raise ValueError("OpenAI response did not contain textual JSON output.")


def _extract_balanced_json_object(source: str) -> str | None:
    text = str(source or "")
    if not text:
        return None

    candidates: list[str] = []
    depth = 0
    start = -1
    in_string = False
    escaped = False

    for idx, ch in enumerate(text):
        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
            continue

        if ch == '"':
            in_string = True
            continue

        if ch == "{":
            if depth == 0:
                start = idx
            depth += 1
            continue

        if ch == "}" and depth > 0:
            depth -= 1
            if depth == 0 and start >= 0:
                candidates.append(text[start : idx + 1])
                start = -1

    if not candidates:
        return None

    def _score(candidate: str) -> tuple[int, int]:
        marker_score = 0
        if '"parts"' in candidate:
            marker_score += 4
        if '"title"' in candidate:
            marker_score += 2
        if '"id"' in candidate:
            marker_score += 1
        return marker_score, len(candidate)

    return max(candidates, key=_score)


def _cleanup_json_like_text(source: str) -> str:
    text = str(source or "")
    if not text:
        return text

    text = text.replace("\ufeff", "")
    text = text.replace("\u201c", '"').replace("\u201d", '"')
    text = text.replace("\u2018", "'").replace("\u2019", "'")
    text = text.replace("\u00a0", " ")
    text = text.replace("，", ",").replace("：", ":")
    text = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F]", "", text)

    # Remove common markdown fences that may survive trimming.
    text = re.sub(r"^\s*```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```\s*$", "", text, flags=re.IGNORECASE)

    # Strip JS-style comments.
    text = re.sub(r"/\*[\s\S]*?\*/", "", text)
    text = re.sub(r"(?m)^\s*//.*$", "", text)

    # Quote unquoted object keys: { key: ... } / , key: ...
    text = re.sub(
        r'([{,]\s*)([A-Za-z_][A-Za-z0-9_-]*)(\s*:)',
        r'\1"\2"\3',
        text,
    )

    # Normalize Python-ish literals to JSON.
    text = re.sub(r'([:\[,]\s*)True(\s*[,}\]])', r"\1true\2", text)
    text = re.sub(r'([:\[,]\s*)False(\s*[,}\]])', r"\1false\2", text)
    text = re.sub(r'([:\[,]\s*)None(\s*[,}\]])', r"\1null\2", text)
    text = re.sub(r'([:\[,]\s*)NaN(\s*[,}\]])', r"\1null\2", text, flags=re.IGNORECASE)
    text = re.sub(r'([:\[,]\s*)Infinity(\s*[,}\]])', r"\1null\2", text, flags=re.IGNORECASE)

    # Remove trailing commas before ] or }.
    text = re.sub(r",\s*([}\]])", r"\1", text)

    return text.strip()


def _balance_json_brackets(source: str) -> str:
    text = str(source or "")
    if not text:
        return text

    stack: list[str] = []
    in_string = False
    escaped = False
    for ch in text:
        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
            continue

        if ch == '"':
            in_string = True
            continue
        if ch == "{":
            stack.append("}")
            continue
        if ch == "[":
            stack.append("]")
            continue
        if ch in {"}", "]"}:
            if stack and stack[-1] == ch:
                stack.pop()
                continue
            return text
    if not stack:
        return text
    return text + "".join(reversed(stack))


def _to_python_literal_text(source: str) -> str:
    text = str(source or "")
    if not text:
        return text
    text = re.sub(r"\btrue\b", "True", text)
    text = re.sub(r"\bfalse\b", "False", text)
    text = re.sub(r"\bnull\b", "None", text)
    return text


def _expand_json_repair_candidates(source: str) -> list[str]:
    candidates: list[str] = []
    base = str(source or "").strip()
    if not base:
        return candidates

    def _append(value: str) -> None:
        item = str(value or "").strip()
        if item and item not in candidates:
            candidates.append(item)

    cleaned = _cleanup_json_like_text(base)
    balanced = _balance_json_brackets(cleaned)
    _append(base)
    _append(cleaned)
    _append(balanced)
    _append(re.sub(r"}\s*{", "},{", balanced))
    _append(re.sub(r"]\s*\[", "],[", balanced))
    _append(re.sub(r'"\s+"', '", "', balanced))
    return candidates


def _extract_json_from_text(text: str, provider: str) -> dict[str, Any]:
    source = str(text or "").strip()
    if not source:
        raise ValueError(f"{provider}: empty response text.")

    fenced = re.match(r"^```(?:json)?\s*([\s\S]*?)\s*```$", source, flags=re.IGNORECASE)
    if fenced:
        source = fenced.group(1).strip()

    candidates: list[str] = []
    candidates.append(source)

    balanced = _extract_balanced_json_object(source)
    if balanced and balanced not in candidates:
        candidates.append(balanced)

    start = source.find("{")
    end = source.rfind("}")
    if start >= 0 and end > start:
        wrapped = source[start : end + 1]
        if wrapped not in candidates:
            candidates.append(wrapped)

    # Try original + cleaned variants.
    expanded_candidates: list[str] = []
    for candidate in candidates:
        for repaired in _expand_json_repair_candidates(candidate):
            if repaired not in expanded_candidates:
                expanded_candidates.append(repaired)

    payload: dict[str, Any] | None = None
    last_error: Exception | None = None
    for candidate in expanded_candidates:
        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError as exc:
            last_error = exc
            try:
                parsed = ast.literal_eval(_to_python_literal_text(candidate))
            except (SyntaxError, ValueError) as literal_exc:
                last_error = literal_exc
                continue

        if isinstance(parsed, dict):
            payload = parsed
            break
        last_error = ValueError("top-level JSON is not object")

    if payload is None:
        if last_error is not None:
            raise ValueError(f"{provider}: response is not valid JSON ({last_error}).") from last_error
        raise ValueError(f"{provider}: response is not valid JSON.")

    return payload


def _build_chunk_user_prompt(
    raw_text: str,
    *,
    chunk_id: str,
    chunk_index: int,
    total_chunks: int,
    include_schema: bool,
    previous_error: str | None = None,
) -> str:
    prompt = (
        "Hãy trích xuất JSON cho 1 đoạn (chunk) của đề thi.\n"
        f"Chunk hiện tại: {chunk_index}/{total_chunks} ({chunk_id}).\n"
        "Chỉ lấy câu hỏi xuất hiện trong chunk này, không thêm câu nằm ngoài chunk.\n"
        "Nếu metadata (id/title/subject/time/description) không chắc, để rỗng hoặc null.\n"
        "Phải giữ đúng cấu trúc content/options/statements và chỉ trả về JSON object.\n"
        "Giữ nguyên token công thức/hình ảnh trong nội dung: [math:$...$], [!m:$...$], [img:...].\n"
        "Không được thay bằng dấu '.' hoặc chuỗi rỗng nếu token có trong chunk.\n"
    )
    if include_schema:
        prompt += (
            "Schema cho output chunk:\n"
            f"{json.dumps(CHUNK_SCHEMA, ensure_ascii=False)}\n\n"
        )
    prompt += f"Nội dung chunk:\n{raw_text}"
    if previous_error:
        prompt += (
            "\n\nChunk trước đó trả JSON chưa hợp lệ, hãy sửa triệt để theo schema.\n"
            f"Lỗi: {previous_error}"
        )
    return prompt


def _build_chunk_gemini_prompt(
    raw_text: str,
    *,
    chunk_id: str,
    chunk_index: int,
    total_chunks: int,
    previous_error: str | None = None,
) -> str:
    return (
        f"{SYSTEM_PROMPT}\n\n"
        + _build_chunk_user_prompt(
            raw_text,
            chunk_id=chunk_id,
            chunk_index=chunk_index,
            total_chunks=total_chunks,
            include_schema=True,
            previous_error=previous_error,
        )
    )


def _build_chunk_anthropic_messages(
    raw_text: str,
    *,
    chunk_id: str,
    chunk_index: int,
    total_chunks: int,
    previous_error: str | None = None,
) -> list[dict[str, str]]:
    return [
        {
            "role": "user",
            "content": _build_chunk_user_prompt(
                raw_text,
                chunk_id=chunk_id,
                chunk_index=chunk_index,
                total_chunks=total_chunks,
                include_schema=True,
                previous_error=previous_error,
            ),
        }
    ]


async def _invoke_sdk(method: Any, *args: Any, **kwargs: Any) -> Any:
    if asyncio.iscoroutinefunction(method):
        return await method(*args, **kwargs)
    result = await asyncio.to_thread(method, *args, **kwargs)
    if asyncio.iscoroutine(result):
        return await result
    return result


async def _call_openai_once_async(
    client: Any,
    model: str,
    raw_text: str,
    *,
    chunk_id: str,
    chunk_index: int,
    total_chunks: int,
    previous_error: str | None = None,
) -> dict[str, Any]:
    response = await _invoke_sdk(
        client.responses.create,
        model=model,
        input=[
            {
                "role": "developer",
                "content": [{"type": "input_text", "text": SYSTEM_PROMPT}],
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": _build_chunk_user_prompt(
                            raw_text,
                            chunk_id=chunk_id,
                            chunk_index=chunk_index,
                            total_chunks=total_chunks,
                            include_schema=False,
                            previous_error=previous_error,
                        ),
                    }
                ],
            },
        ],
        text={
            "format": {
                "type": "json_schema",
                "name": "exam_chunk_schema",
                "strict": True,
                "schema": CHUNK_SCHEMA,
            }
        },
    )
    response_text = _extract_openai_response_text(response)
    return _extract_json_from_text(response_text, provider="openai")


def _extract_gemini_text(response: Any) -> str:
    direct = getattr(response, "text", None)
    if isinstance(direct, str) and direct.strip():
        return direct

    candidates = getattr(response, "candidates", None)
    if isinstance(candidates, list):
        for candidate in candidates:
            content = getattr(candidate, "content", None)
            parts = getattr(content, "parts", None)
            if isinstance(parts, list):
                for part in parts:
                    text = getattr(part, "text", None)
                    if isinstance(text, str) and text.strip():
                        return text
    raise ValueError("gemini: response did not contain text.")


async def _call_gemini_once_async(
    client: Any,
    model: str,
    raw_text: str,
    *,
    chunk_id: str,
    chunk_index: int,
    total_chunks: int,
    previous_error: str | None = None,
) -> dict[str, Any]:
    if hasattr(client, "AsyncGenerativeModel"):
        generation_model = client.AsyncGenerativeModel(model)
    else:
        generation_model = client.GenerativeModel(model)

    prompt = _build_chunk_gemini_prompt(
        raw_text,
        chunk_id=chunk_id,
        chunk_index=chunk_index,
        total_chunks=total_chunks,
        previous_error=previous_error,
    )
    generation_config = {
        "response_mime_type": "application/json",
        "temperature": 0,
    }
    if hasattr(generation_model, "generate_content_async"):
        response = await _invoke_sdk(
            generation_model.generate_content_async,
            prompt,
            generation_config=generation_config,
        )
    else:
        response = await _invoke_sdk(
            generation_model.generate_content,
            prompt,
            generation_config=generation_config,
        )
    response_text = _extract_gemini_text(response)
    return _extract_json_from_text(response_text, provider="gemini")


def _extract_anthropic_text(response: Any) -> str:
    content = getattr(response, "content", None)
    if not isinstance(content, list):
        raise ValueError("anthropic: response content missing.")
    chunks: list[str] = []
    for item in content:
        text = getattr(item, "text", None)
        if isinstance(text, str) and text.strip():
            chunks.append(text)
        elif isinstance(item, dict):
            value = item.get("text")
            if isinstance(value, str) and value.strip():
                chunks.append(value)
    if not chunks:
        raise ValueError("anthropic: response did not contain text chunks.")
    return "\n".join(chunks).strip()


async def _call_anthropic_once_async(
    client: Any,
    model: str,
    raw_text: str,
    *,
    chunk_id: str,
    chunk_index: int,
    total_chunks: int,
    previous_error: str | None = None,
) -> dict[str, Any]:
    response = await _invoke_sdk(
        client.messages.create,
        model=model,
        max_tokens=8192,
        system=SYSTEM_PROMPT,
        messages=_build_chunk_anthropic_messages(
            raw_text,
            chunk_id=chunk_id,
            chunk_index=chunk_index,
            total_chunks=total_chunks,
            previous_error=previous_error,
        ),
    )
    response_text = _extract_anthropic_text(response)
    return _extract_json_from_text(response_text, provider="anthropic")


async def _call_llm_once_async(
    client: Any,
    provider: str,
    model: str,
    raw_text: str,
    *,
    chunk_id: str,
    chunk_index: int,
    total_chunks: int,
    previous_error: str | None = None,
) -> dict[str, Any]:
    if provider == "openai":
        return await _call_openai_once_async(
            client=client,
            model=model,
            raw_text=raw_text,
            chunk_id=chunk_id,
            chunk_index=chunk_index,
            total_chunks=total_chunks,
            previous_error=previous_error,
        )
    if provider == "gemini":
        return await _call_gemini_once_async(
            client=client,
            model=model,
            raw_text=raw_text,
            chunk_id=chunk_id,
            chunk_index=chunk_index,
            total_chunks=total_chunks,
            previous_error=previous_error,
        )
    if provider == "anthropic":
        return await _call_anthropic_once_async(
            client=client,
            model=model,
            raw_text=raw_text,
            chunk_id=chunk_id,
            chunk_index=chunk_index,
            total_chunks=total_chunks,
            previous_error=previous_error,
        )
    raise ValueError(f"Unsupported provider '{provider}'.")


def _coerce_chunk_payload(payload: dict[str, Any], *, chunk_id: str) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError(f"{chunk_id}: model payload must be object.")

    raw_parts = payload.get("parts")
    if not isinstance(raw_parts, list):
        raise ValueError(f"{chunk_id}: payload.parts must be array.")

    normalized_parts: list[dict[str, Any]] = []
    for index, raw_part in enumerate(raw_parts, start=1):
        if not isinstance(raw_part, dict):
            continue
        raw_questions = raw_part.get("questions", [])
        if not isinstance(raw_questions, list):
            raw_questions = []
        normalized_parts.append(
            {
                "id": str(raw_part.get("id") or f"part{index}").strip() or f"part{index}",
                "name": str(raw_part.get("name") or f"PHẦN {index}").strip(),
                "description": str(raw_part.get("description") or "").strip(),
                "questions": [q for q in raw_questions if isinstance(q, dict)],
            }
        )

    normalized_payload = dict(payload)
    normalized_payload["parts"] = normalized_parts
    return normalized_payload


def _merge_chunk_payloads(
    payloads: list[dict[str, Any]],
    *,
    source_name: str,
) -> dict[str, Any]:
    if not payloads:
        raise ValueError("No chunk payloads to merge.")

    exam_id: str | None = None
    title: str | None = None
    subject: str | None = None
    description: str | None = None
    time_value: Any = None

    merged_parts: list[dict[str, Any]] = []
    part_index_map: dict[str, int] = {}
    part_question_seen: dict[str, set[str]] = {}

    def _part_key(part: dict[str, Any], fallback_index: int) -> str:
        raw_id = str(part.get("id") or "").strip().lower()
        if raw_id:
            return raw_id
        from_name = slugify(str(part.get("name") or ""))
        if from_name and from_name != "exam-imported":
            return from_name
        questions = part.get("questions")
        if isinstance(questions, list) and questions:
            first_question = questions[0]
            if isinstance(first_question, dict):
                qtype = _canonical_question_type(first_question.get("type", ""))
                if qtype == "single_choice":
                    return "part1"
                if qtype == "true_false":
                    return "part2"
                if qtype == "short_answer":
                    return "part3"
        return f"part{fallback_index}"

    next_part_index = 1
    for payload in payloads:
        if exam_id is None:
            value = str(payload.get("id") or "").strip()
            if value:
                exam_id = value
        if title is None:
            value = str(payload.get("title") or "").strip()
            if value:
                title = value
        if subject is None:
            value = str(payload.get("subject") or "").strip()
            if value:
                subject = value
        if description is None:
            value = str(payload.get("description") or "").strip()
            if value:
                description = value
        if time_value is None and payload.get("time") is not None:
            time_value = payload.get("time")

        raw_parts = payload.get("parts")
        if not isinstance(raw_parts, list):
            continue
        for raw_part in raw_parts:
            if not isinstance(raw_part, dict):
                continue

            key = _part_key(raw_part, next_part_index)
            if key not in part_index_map:
                part_id = str(raw_part.get("id") or f"part{next_part_index}").strip()
                part_name = str(raw_part.get("name") or f"PHẦN {next_part_index}").strip()
                part_description = str(raw_part.get("description") or "").strip()
                part_index_map[key] = len(merged_parts)
                part_question_seen[key] = set()
                merged_parts.append(
                    {
                        "id": part_id or f"part{next_part_index}",
                        "name": part_name or f"PHẦN {next_part_index}",
                        "description": part_description,
                        "questions": [],
                    }
                )
                next_part_index += 1

            merged_part = merged_parts[part_index_map[key]]
            if not merged_part["name"]:
                merged_part["name"] = str(raw_part.get("name") or "").strip()
            if not merged_part["description"]:
                merged_part["description"] = str(raw_part.get("description") or "").strip()

            questions = raw_part.get("questions")
            if not isinstance(questions, list):
                continue

            seen_ids = part_question_seen[key]
            for question in questions:
                if not isinstance(question, dict):
                    continue
                qid = str(question.get("id") or "").strip().lower()
                if qid and qid in seen_ids:
                    continue
                if qid:
                    seen_ids.add(qid)
                merged_part["questions"].append(question)

    merged_parts = [part for part in merged_parts if part["questions"]]
    if not merged_parts:
        raise ValueError("Merged payload has no valid questions.")

    final_title = title or source_name
    return {
        "id": exam_id or slugify(final_title or source_name),
        "title": final_title,
        "subject": subject or "",
        "time": 0 if time_value is None else time_value,
        "description": description or final_title,
        "parts": merged_parts,
    }


async def _convert_chunk_with_retries(
    *,
    chunk: RawTextChunk,
    chunk_index: int,
    total_chunks: int,
    client: Any,
    provider: str,
    model: str,
    max_retries: int,
    semaphore: asyncio.Semaphore,
) -> dict[str, Any]:
    last_error: str | None = None
    for attempt in range(max_retries + 1):
        async with semaphore:
            payload = await _call_llm_once_async(
                client=client,
                provider=provider,
                model=model,
                raw_text=chunk.raw_markup_input,
                chunk_id=chunk.id,
                chunk_index=chunk_index,
                total_chunks=total_chunks,
                previous_error=last_error,
            )
        try:
            normalized = _coerce_chunk_payload(payload, chunk_id=chunk.id)
            degradation_error = _chunk_degradation_error(chunk, normalized)
            if degradation_error:
                raise ValueError(f"{chunk.id}: degradation detected: {degradation_error}")
            return normalized
        except Exception as exc:
            last_error = str(exc)
            if attempt >= max_retries:
                raise ValueError(
                    f"{chunk.id}: failed after {max_retries + 1} attempts. Last error: {last_error}"
                ) from exc
    raise RuntimeError("Unexpected chunk retry loop state.")


def _normalize_exam_payload(
    payload: dict[str, Any],
    raw_text: str,
    source_name: str,
    image_map: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("Model payload must be object.")

    title = str(payload.get("title") or source_name).strip()
    exam_id = slugify(str(payload.get("id") or title or source_name))
    subject = normalize_subject(str(payload.get("subject") or ""))
    short_answer_default_points = default_short_answer_points(subject)
    model_time = payload.get("time")
    time_from_model = _coerce_number(model_time, 0.0)
    inferred_time = extract_time_minutes(raw_text, int(time_from_model))
    description = str(payload.get("description") or title).strip()
    raw_parts = payload.get("parts")
    if not isinstance(raw_parts, list):
        raise ValueError("parts must be an array.")
    part1_option_lookup = _extract_part1_option_lookup(raw_text)

    normalized_parts: list[dict[str, Any]] = []
    for idx, raw_part in enumerate(raw_parts, start=1):
        if not isinstance(raw_part, dict):
            raise ValueError(f"parts[{idx - 1}] must be object.")
        raw_questions = raw_part.get("questions", [])
        if not isinstance(raw_questions, list):
            raise ValueError(f"parts[{idx - 1}].questions must be array.")
        if len(raw_questions) == 0:
            # Chỉ xuất part thực sự có dữ liệu.
            continue

        part_name = str(raw_part.get("name") or f"PHẦN {idx}").strip()
        part_id = _infer_part_id(idx, str(raw_part.get("id") or ""), part_name)
        part_desc = str(raw_part.get("description") or "").strip()

        normalized_questions: list[dict[str, Any]] = []
        for qidx, raw_question in enumerate(raw_questions, start=1):
            if not isinstance(raw_question, dict):
                raise ValueError(
                    f"parts[{idx - 1}].questions[{qidx - 1}] must be object."
                )
            qtype = _canonical_question_type(raw_question.get("type", ""))
            qid = _normalize_question_id(raw_question.get("id"), qidx)
            content = _sanitize_content_value(raw_question.get("content", ""), image_map)

            if part_id == "part-1" and qtype != "single_choice":
                raise ValueError(f"{part_id}.{qid}: question type must be single_choice.")
            if part_id == "part-2" and qtype != "true_false":
                raise ValueError(f"{part_id}.{qid}: question type must be true_false.")
            if part_id == "part-3" and qtype != "short_answer":
                raise ValueError(f"{part_id}.{qid}: question type must be short_answer.")

            if qtype == "single_choice":
                options = raw_question.get("options")
                if options is None:
                    options = raw_question.get("choices")
                question_no = _extract_question_number_from_qid(qid, fallback=qidx)
                options = _salvage_single_choice_options(
                    question_content=content,
                    model_options=options,
                    question_number=question_no,
                    part1_lookup=part1_option_lookup,
                )
                if not isinstance(options, list):
                    raise ValueError(f"{part_id}.{qid}: options must be array.")
                if len(options) != 4:
                    raise ValueError(f"{part_id}.{qid}: single_choice options must have 4 items.")
                normalized_options = [
                    _sanitize_content_value(
                        _strip_option_label_prefix(option), image_map
                    )
                    for option in options
                ]
                normalized_questions.append(
                    {
                        "id": qid,
                        "type": "single_choice",
                        "content": content,
                        "points": _coerce_number(raw_question.get("points"), 0.25),
                        "options": normalized_options,
                        "correct_answer": _normalize_single_choice_answer(
                            raw_question.get("correct_answer")
                        ),
                    }
                )
                continue

            if qtype == "true_false":
                raw_statements = raw_question.get("statements")
                if not isinstance(raw_statements, list) or len(raw_statements) == 0:
                    raise ValueError(f"{part_id}.{qid}: true_false statements must be non-empty.")
                statements = []
                for sidx, statement in enumerate(raw_statements, start=1):
                    if not isinstance(statement, dict):
                        raise ValueError(f"{part_id}.{qid}: statement must be object.")
                    sid = _normalize_statement_id(
                        statement.get("id"), sidx - 1
                    )
                    statements.append(
                        {
                            "id": sid,
                            "content": _sanitize_content_value(
                                statement.get("content", ""), image_map
                            ),
                            "correct": _normalize_boolean(statement.get("correct")),
                        }
                    )

                points = raw_question.get("points")
                if not isinstance(points, list):
                    points = DEFAULT_TF_POINTS
                numeric_points = [_coerce_number(value, 0.0) for value in points]

                normalized_questions.append(
                    {
                        "id": qid,
                        "type": "true_false",
                        "content": content,
                        "points": numeric_points,
                        "statements": statements,
                    }
                )
                continue

            if qtype == "short_answer":
                answer = raw_question.get("correct_answer")
                normalized_questions.append(
                    {
                        "id": qid,
                        "type": "short_answer",
                        "content": content,
                        "points": _coerce_number(
                            raw_question.get("points"), short_answer_default_points
                        ),
                        "correct_answer": None if answer is None else str(answer),
                    }
                )
                continue

            raise ValueError(f"{part_id}.{qid}: unsupported question type '{qtype}'.")

        normalized_parts.append(
            {
                "id": part_id,
                "name": part_name,
                "description": part_desc,
                "questions": normalized_questions,
            }
        )

    normalized = {
        "id": exam_id,
        "title": title,
        "subject": subject,
        "time": int(inferred_time),
        "description": description,
        "parts": normalized_parts,
    }
    _validate_exam_schema(normalized)
    return normalized


async def convert_exam_text_with_client_async(
    raw_text: str,
    source_name: str,
    client: Any,
    model: str | None = None,
    provider: str = DEFAULT_PROVIDER,
    max_retries: int = 2,
    max_chunk_chars: int = 6000,
    max_concurrency: int = 4,
    image_map: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if max_retries < 0:
        raise ValueError("max_retries must be >= 0")
    if max_chunk_chars <= 0:
        raise ValueError("max_chunk_chars must be > 0")
    if max_concurrency <= 0:
        raise ValueError("max_concurrency must be > 0")

    provider_name = normalize_provider(provider)
    if provider_name == "auto":
        raise ValueError(
            "provider='auto' is only supported in convert_exam_file(). "
            "When passing a prebuilt client, set provider explicitly."
        )
    model_name = str(model or default_model_for_provider(provider_name))

    prepared_text, _cut_line = _trim_answer_guidance_section(raw_text)
    chunks = build_question_boundary_chunks(prepared_text, max_chunk_chars=max_chunk_chars)
    if not chunks:
        text = str(prepared_text or "").strip()
        if not text:
            raise ValueError("Input text is empty.")
        chunks = [RawTextChunk(id="chunk_1", raw_markup_input=text, line_start=0, line_end=0)]

    semaphore = asyncio.Semaphore(max_concurrency)
    tasks = [
        asyncio.create_task(
            _convert_chunk_with_retries(
                chunk=chunk,
                chunk_index=index,
                total_chunks=len(chunks),
                client=client,
                provider=provider_name,
                model=model_name,
                max_retries=max_retries,
                semaphore=semaphore,
            )
        )
        for index, chunk in enumerate(chunks, start=1)
    ]
    chunk_results = await asyncio.gather(*tasks, return_exceptions=True)

    errors: list[str] = []
    payloads: list[dict[str, Any]] = []
    for chunk, result in zip(chunks, chunk_results):
        if isinstance(result, Exception):
            errors.append(_format_chunk_error_message(chunk.id, result))
            continue
        payloads.append(result)

    if errors:
        raise ValueError(
            "Chunk extraction failed.\n"
            + "\n".join(errors[:10])
            + ("\n..." if len(errors) > 10 else "")
        )

    merged_payload = _merge_chunk_payloads(payloads, source_name=source_name)
    return _normalize_exam_payload(
        merged_payload,
        raw_text=prepared_text,
        source_name=source_name,
        image_map=image_map,
    )


def _run_async(coro: Any) -> Any:
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None
    if loop and loop.is_running():
        raise RuntimeError(
            "A running event loop is active. Use the async API instead of the sync wrapper."
        )
    return asyncio.run(coro)


def convert_exam_text_with_client(
    raw_text: str,
    source_name: str,
    client: Any,
    model: str | None = None,
    provider: str = DEFAULT_PROVIDER,
    max_retries: int = 2,
    max_chunk_chars: int = 6000,
    max_concurrency: int = 4,
    image_map: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return _run_async(
        convert_exam_text_with_client_async(
            raw_text=raw_text,
            source_name=source_name,
            client=client,
            model=model,
            provider=provider,
            max_retries=max_retries,
            max_chunk_chars=max_chunk_chars,
            max_concurrency=max_concurrency,
            image_map=image_map,
        )
    )


def load_input_text(
    input_path: Path,
    asset_dir: Path | None = None,
    docx_parser: str = "auto",
) -> tuple[str, dict[str, Any]]:
    suffix = input_path.suffix.lower()
    if suffix == ".docx":
        parser_mode = str(docx_parser or "auto").strip().lower()
        if parser_mode not in DOCX_PARSER_CHOICES:
            raise ValueError(
                f"Unsupported --docx-parser '{docx_parser}'. "
                f"Supported: {', '.join(DOCX_PARSER_CHOICES)}"
            )

        if parser_mode in {"auto", "js"}:
            try:
                return _load_docx_with_exam_importer_parser(
                    input_path=input_path,
                    asset_dir=asset_dir,
                )
            except Exception:
                if parser_mode == "js":
                    raise
        return _load_docx_with_raw_extractor(
            input_path=input_path,
            asset_dir=asset_dir,
        )

    if suffix in {".txt", ".md"}:
        return _normalize_raw_markup_tokens(
            input_path.read_text(encoding="utf-8", errors="replace")
        ), {}

    raise ValueError("Unsupported input format. Use .docx, .txt or .md")


def _create_provider_client(provider: str, api_key: str) -> Any:
    if provider == "openai":
        try:
            from openai import AsyncOpenAI
        except ImportError as exc:
            raise ImportError(
                "Missing dependency 'openai'. Install with: python -m pip install openai"
            ) from exc
        return AsyncOpenAI(api_key=api_key)

    if provider == "gemini":
        try:
            import google.generativeai as genai
        except ImportError as exc:
            raise ImportError(
                "Missing dependency 'google-generativeai'. Install with: "
                "python -m pip install google-generativeai"
            ) from exc
        genai.configure(api_key=api_key)
        return genai

    if provider == "anthropic":
        try:
            from anthropic import AsyncAnthropic
        except ImportError as exc:
            raise ImportError(
                "Missing dependency 'anthropic'. Install with: python -m pip install anthropic"
            ) from exc
        return AsyncAnthropic(api_key=api_key)

    raise ValueError(f"Unsupported provider '{provider}'.")


def _write_exam_output(output_path: Path, exam_json: dict[str, Any]) -> list[Path]:
    """
    Write output JSON and also mirror to canonical `exam.json` in the same folder
    when user selects a custom filename (e.g. *.exam.json).
    """
    payload = json.dumps(exam_json, ensure_ascii=False, indent=2) + "\n"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(payload, encoding="utf-8")

    written_paths = [output_path]
    canonical_path = output_path.parent / "exam.json"
    if output_path.resolve() != canonical_path.resolve():
        canonical_path.write_text(payload, encoding="utf-8")
        written_paths.append(canonical_path)
    return written_paths


async def convert_exam_file_async(
    input_path: Path,
    output_path: Path,
    model: str | None = None,
    provider: str = DEFAULT_PROVIDER,
    asset_dir: Path | None = None,
    max_retries: int = 2,
    max_chunk_chars: int = 6000,
    max_concurrency: int = 4,
    dump_raw: Path | None = None,
    api_key: str | None = None,
    docx_parser: str = "auto",
) -> dict[str, Any]:
    requested_model = str(model or "").strip() or None
    provider_name = _resolve_provider_for_execution(
        provider,
        api_key=api_key,
        model=requested_model,
    )
    key = _resolve_api_key(provider_name, api_key=api_key)
    model_candidates = candidate_models_for_provider(
        provider_name,
        requested_model=requested_model,
    )

    raw_text, image_map = load_input_text(
        input_path=input_path,
        asset_dir=asset_dir,
        docx_parser=docx_parser,
    )
    if dump_raw:
        dump_raw.parent.mkdir(parents=True, exist_ok=True)
        dump_raw.write_text(raw_text, encoding="utf-8")

    client = _create_provider_client(provider_name, api_key=key)
    exam_json: dict[str, Any] | None = None
    try:
        for model_name in model_candidates:
            try:
                exam_json = await convert_exam_text_with_client_async(
                    raw_text=raw_text,
                    source_name=input_path.stem,
                    client=client,
                    model=model_name,
                    provider=provider_name,
                    max_retries=max_retries,
                    max_chunk_chars=max_chunk_chars,
                    max_concurrency=max_concurrency,
                    image_map=image_map,
                )
                break
            except Exception as exc:
                is_last = model_name == model_candidates[-1]
                if is_last or not _is_model_access_error(provider_name, exc):
                    raise
    finally:
        close_async = getattr(client, "aclose", None)
        if callable(close_async):
            await close_async()
        else:
            close_sync = getattr(client, "close", None)
            if callable(close_sync):
                close_sync()

    if exam_json is None:
        tried = ", ".join(model_candidates)
        raise ValueError(
            f"Unable to run provider '{provider_name}' with available models: {tried}"
        )

    _write_exam_output(output_path, exam_json)
    return exam_json


def convert_exam_file(
    input_path: Path,
    output_path: Path,
    model: str | None = None,
    provider: str = DEFAULT_PROVIDER,
    asset_dir: Path | None = None,
    max_retries: int = 2,
    max_chunk_chars: int = 6000,
    max_concurrency: int = 4,
    dump_raw: Path | None = None,
    api_key: str | None = None,
    docx_parser: str = "auto",
) -> dict[str, Any]:
    return _run_async(
        convert_exam_file_async(
            input_path=input_path,
            output_path=output_path,
            model=model,
            provider=provider,
            asset_dir=asset_dir,
            max_retries=max_retries,
            max_chunk_chars=max_chunk_chars,
            max_concurrency=max_concurrency,
            dump_raw=dump_raw,
            api_key=api_key,
            docx_parser=docx_parser,
        )
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Convert .docx/.txt extracted exam text into strict exam.json "
            "using OpenAI/Gemini/Claude(Anthropic)."
        )
    )
    parser.add_argument("--input", required=True, type=Path, help="Input file (.docx/.txt/.md)")
    parser.add_argument("--output", required=True, type=Path, help="Output exam.json path")
    parser.add_argument(
        "--provider",
        default=DEFAULT_PROVIDER,
        help="LLM provider: openai|gemini|anthropic|claude|auto (default: openai)",
    )
    parser.add_argument("--model", default=None, help="Model name (default depends on provider)")
    parser.add_argument("--asset-dir", type=Path, default=None, help="Asset output dir when input is .docx")
    parser.add_argument(
        "--docx-parser",
        default="auto",
        choices=DOCX_PARSER_CHOICES,
        help="DOCX parser mode: auto|js|python (default: auto)",
    )
    parser.add_argument("--max-retries", type=int, default=2, help="Retry attempts for invalid model output")
    parser.add_argument(
        "--max-chunk-chars",
        type=int,
        default=6000,
        help="Max chars per question-boundary chunk before splitting",
    )
    parser.add_argument(
        "--max-concurrency",
        type=int,
        default=4,
        help="Maximum number of chunks to send to LLM in parallel",
    )
    parser.add_argument("--dump-raw", type=Path, default=None, help="Optional raw extracted text dump path")
    parser.add_argument(
        "--api-key",
        default=None,
        help=(
            "Provider API key. Fallback envs: "
            "OPENAI_API_KEY | GEMINI_API_KEY/GOOGLE_API_KEY | ANTHROPIC_API_KEY"
        ),
    )
    args = parser.parse_args()

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    input_path = args.input.resolve()
    if not input_path.exists():
        print(f"[error] Input not found: {input_path}", file=sys.stderr)
        return 1

    try:
        exam_json = convert_exam_file(
            input_path=input_path,
            output_path=args.output.resolve(),
            model=args.model,
            provider=args.provider,
            asset_dir=args.asset_dir.resolve() if args.asset_dir else None,
            max_retries=args.max_retries,
            max_chunk_chars=args.max_chunk_chars,
            max_concurrency=args.max_concurrency,
            dump_raw=args.dump_raw.resolve() if args.dump_raw else None,
            api_key=args.api_key,
            docx_parser=args.docx_parser,
        )
        print(
            f"[ok] Wrote {args.output} | parts={len(exam_json.get('parts', []))} "
            f"| id={exam_json.get('id')}"
        )
        return 0
    except Exception as exc:
        print(f"[error] {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
