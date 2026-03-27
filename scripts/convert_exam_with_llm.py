from __future__ import annotations

import argparse
import json
import os
import re
import sys
import unicodedata
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

DEFAULT_PROVIDER = "openai"
DEFAULT_MODELS = {
    "openai": "gpt-5-mini",
    "gemini": "gemini-2.5-flash",
    "anthropic": "claude-sonnet-4-5",
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
DEFAULT_TF_POINTS = [0.1, 0.25, 0.5, 1]

SYSTEM_PROMPT = """\
Bạn là một AI extraction engine chuyển đổi nội dung đề thi THPT 2025-2026 từ văn bản đã trích xuất thành JSON exam.json.

Bắt buộc:
- Không bịa dữ liệu.
- Không tự suy luận đáp án nếu tài liệu không có.
- Nếu thiếu/không chắc: giữ nguyên text tối đa, dùng null khi phù hợp.
- Không thêm field ngoài schema.
- Nếu nội dung gồm nhiều block (text/rich text/image/table), dùng mảng content.
- PHẦN I -> single_choice, PHẦN II -> true_false, PHẦN III -> short_answer.
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

TABLE_CELL_ITEM_SCHEMA: dict[str, Any] = {
    "anyOf": [
        {"type": "string"},
        TEXT_NODE_SCHEMA,
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


def _strip_accents(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


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
            return candidate
        if candidate in {"i", "ii", "iii"}:
            return {"i": "part1", "ii": "part2", "iii": "part3"}[candidate]

    name_text = _strip_accents(str(name or "")).upper()
    if "PHAN I" in name_text:
        return "part1"
    if "PHAN II" in name_text:
        return "part2"
    if "PHAN III" in name_text:
        return "part3"
    return f"part{index}"


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


def _resolve_provider_for_execution(provider: str, api_key: str | None = None) -> str:
    normalized = normalize_provider(provider)
    if normalized != "auto":
        return normalized

    if api_key:
        return DEFAULT_PROVIDER

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
                if isinstance(item, str):
                    continue
                _validate_text_node(item, item_path)


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

    # Remove trailing commas before ] or }.
    text = re.sub(r",\s*([}\]])", r"\1", text)

    return text.strip()


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
        expanded_candidates.append(candidate)
        cleaned = _cleanup_json_like_text(candidate)
        if cleaned and cleaned not in expanded_candidates:
            expanded_candidates.append(cleaned)

    payload: dict[str, Any] | None = None
    last_error: Exception | None = None
    for candidate in expanded_candidates:
        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError as exc:
            last_error = exc
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


def _build_user_prompt(raw_text: str, previous_error: str | None = None) -> str:
    user_prompt = (
        "Hãy chuyển nội dung đề sau sang exam.json strict.\n"
        "Chỉ trả về JSON hợp lệ.\n\n"
        f"{raw_text}"
    )
    if previous_error:
        user_prompt += (
            "\n\nLần trước JSON chưa hợp lệ theo validator nội bộ. "
            "Hãy sửa toàn bộ để đúng schema.\n"
            f"Lỗi trước: {previous_error}"
        )
    return user_prompt


def _build_gemini_prompt(raw_text: str, previous_error: str | None = None) -> str:
    prompt = (
        f"{SYSTEM_PROMPT}\n\n"
        "Trả về JSON object hợp lệ theo đúng schema sau (không markdown):\n"
        f"{json.dumps(EXAM_SCHEMA, ensure_ascii=False)}\n\n"
        "Ràng buộc định dạng JSON:\n"
        "- Chỉ trả về đúng 1 JSON object, không văn bản trước/sau.\n"
        '- Mọi key phải có dấu ngoặc kép ".\n'
        "- Không trailing comma.\n"
        "- Không comment.\n"
        "- Không dùng ```json.\n\n"
        f"Nội dung đề:\n{raw_text}"
    )
    if previous_error:
        prompt += (
            "\n\nLỗi validate lần trước:\n"
            f"{previous_error}\n"
            "Hãy trả về JSON đã sửa đúng schema."
        )
    return prompt


def _build_anthropic_messages(raw_text: str, previous_error: str | None = None) -> list[dict[str, str]]:
    return [{"role": "user", "content": _build_user_prompt(raw_text, previous_error)}]


def _call_openai_once(
    client: Any,
    model: str,
    raw_text: str,
    previous_error: str | None = None,
) -> dict[str, Any]:
    response = client.responses.create(
        model=model,
        input=[
            {
                "role": "developer",
                "content": [{"type": "input_text", "text": SYSTEM_PROMPT}],
            },
            {
                "role": "user",
                "content": [{"type": "input_text", "text": _build_user_prompt(raw_text, previous_error)}],
            },
        ],
        text={
            "format": {
                "type": "json_schema",
                "name": "exam_schema",
                "strict": True,
                "schema": EXAM_SCHEMA,
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


def _call_gemini_once(
    client: Any,
    model: str,
    raw_text: str,
    previous_error: str | None = None,
) -> dict[str, Any]:
    generation_model = client.GenerativeModel(model)
    response = generation_model.generate_content(
        _build_gemini_prompt(raw_text, previous_error),
        generation_config={
            "response_mime_type": "application/json",
            "temperature": 0,
        },
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


def _call_anthropic_once(
    client: Any,
    model: str,
    raw_text: str,
    previous_error: str | None = None,
) -> dict[str, Any]:
    response = client.messages.create(
        model=model,
        max_tokens=8192,
        system=SYSTEM_PROMPT,
        messages=_build_anthropic_messages(raw_text, previous_error),
    )
    response_text = _extract_anthropic_text(response)
    return _extract_json_from_text(response_text, provider="anthropic")


def _call_llm_once(
    client: Any,
    provider: str,
    model: str,
    raw_text: str,
    previous_error: str | None = None,
) -> dict[str, Any]:
    if provider == "openai":
        return _call_openai_once(
            client=client,
            model=model,
            raw_text=raw_text,
            previous_error=previous_error,
        )
    if provider == "gemini":
        return _call_gemini_once(
            client=client,
            model=model,
            raw_text=raw_text,
            previous_error=previous_error,
        )
    if provider == "anthropic":
        return _call_anthropic_once(
            client=client,
            model=model,
            raw_text=raw_text,
            previous_error=previous_error,
        )
    raise ValueError(f"Unsupported provider '{provider}'.")


def _normalize_exam_payload(
    payload: dict[str, Any],
    raw_text: str,
    source_name: str,
) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("Model payload must be object.")

    title = str(payload.get("title") or source_name).strip()
    exam_id = slugify(str(payload.get("id") or title or source_name))
    subject = normalize_subject(str(payload.get("subject") or ""))
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
            qid = str(raw_question.get("id") or f"q{qidx}").strip()
            content = raw_question.get("content", "")

            if part_id == "part1" and qtype != "single_choice":
                raise ValueError(f"{part_id}.{qid}: question type must be single_choice.")
            if part_id == "part2" and qtype != "true_false":
                raise ValueError(f"{part_id}.{qid}: question type must be true_false.")
            if part_id == "part3" and qtype != "short_answer":
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
                normalized_questions.append(
                    {
                        "id": qid,
                        "type": "single_choice",
                        "content": content,
                        "points": _coerce_number(raw_question.get("points"), 0.25),
                        "options": options,
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
                    sid = str(
                        statement.get("id") or f"{qid}{chr(ord('a') + sidx - 1)}"
                    ).strip()
                    statements.append(
                        {
                            "id": sid,
                            "content": statement.get("content", ""),
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
                        "points": _coerce_number(raw_question.get("points"), 0.5),
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


def convert_exam_text_with_client(
    raw_text: str,
    source_name: str,
    client: Any,
    model: str | None = None,
    provider: str = DEFAULT_PROVIDER,
    max_retries: int = 2,
) -> dict[str, Any]:
    if max_retries < 0:
        raise ValueError("max_retries must be >= 0")
    provider_name = normalize_provider(provider)
    if provider_name == "auto":
        raise ValueError(
            "provider='auto' is only supported in convert_exam_file(). "
            "When passing a prebuilt client, set provider explicitly."
        )
    model_name = str(model or default_model_for_provider(provider_name))

    last_error = None
    for attempt in range(max_retries + 1):
        payload = _call_llm_once(
            client=client,
            provider=provider_name,
            model=model_name,
            raw_text=raw_text,
            previous_error=last_error,
        )
        try:
            return _normalize_exam_payload(payload, raw_text=raw_text, source_name=source_name)
        except Exception as exc:
            last_error = str(exc)
            if attempt >= max_retries:
                raise ValueError(
                    f"Failed after {max_retries + 1} attempts. Last error: {last_error}"
                ) from exc
    raise RuntimeError("Unexpected retry loop state.")


def load_input_text(input_path: Path, asset_dir: Path | None = None) -> tuple[str, dict[str, Any]]:
    suffix = input_path.suffix.lower()
    if suffix == ".docx":
        from lib.raw_extractor import convert_to_raw_markdown

        raw_text, image_map = convert_to_raw_markdown(
            docx_path=input_path,
            assets_dir=asset_dir,
        )
        return raw_text, image_map

    if suffix in {".txt", ".md"}:
        return input_path.read_text(encoding="utf-8", errors="replace"), {}

    raise ValueError("Unsupported input format. Use .docx, .txt or .md")


def _create_provider_client(provider: str, api_key: str) -> Any:
    if provider == "openai":
        try:
            from openai import OpenAI
        except ImportError as exc:
            raise ImportError(
                "Missing dependency 'openai'. Install with: python -m pip install openai"
            ) from exc
        return OpenAI(api_key=api_key)

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
            import anthropic
        except ImportError as exc:
            raise ImportError(
                "Missing dependency 'anthropic'. Install with: python -m pip install anthropic"
            ) from exc
        return anthropic.Anthropic(api_key=api_key)

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


def convert_exam_file(
    input_path: Path,
    output_path: Path,
    model: str | None = None,
    provider: str = DEFAULT_PROVIDER,
    asset_dir: Path | None = None,
    max_retries: int = 2,
    dump_raw: Path | None = None,
    api_key: str | None = None,
) -> dict[str, Any]:
    provider_name = _resolve_provider_for_execution(provider, api_key=api_key)
    key = _resolve_api_key(provider_name, api_key=api_key)
    model_name = str(model or default_model_for_provider(provider_name))

    raw_text, _image_map = load_input_text(input_path=input_path, asset_dir=asset_dir)
    if dump_raw:
        dump_raw.parent.mkdir(parents=True, exist_ok=True)
        dump_raw.write_text(raw_text, encoding="utf-8")

    client = _create_provider_client(provider_name, api_key=key)
    exam_json = convert_exam_text_with_client(
        raw_text=raw_text,
        source_name=input_path.stem,
        client=client,
        model=model_name,
        provider=provider_name,
        max_retries=max_retries,
    )

    _write_exam_output(output_path, exam_json)
    return exam_json


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
    parser.add_argument("--max-retries", type=int, default=2, help="Retry attempts for invalid model output")
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
            dump_raw=args.dump_raw.resolve() if args.dump_raw else None,
            api_key=args.api_key,
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
