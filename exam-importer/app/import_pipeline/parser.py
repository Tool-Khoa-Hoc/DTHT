from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from .section_headers import find_embedded_section_start, match_section_header
from .types import ParseResult


SPACE_RE = re.compile(r"\s+")
QUESTION_RE = re.compile(
    r"^\s*(?:Câu|Cau|Question|Q)\s*(?:số|so|number|no\.?)?\s*(\d{1,4})(?:\s*[:\.\)\-])?\s*(.*)$",
    re.IGNORECASE,
)
NUMERIC_QUESTION_RE = re.compile(r"^\s*(\d{1,4})\s*[\.\)]\s*(.+)$")
OPTION_RE = re.compile(r"^\s*([A-D])\s*[\.\):]\s*(.+)$")
TF_RE = re.compile(r"^\s*([a-dA-D])\)\s*(.+)$")
ANSWER_ONLY_RE = re.compile(r"^\s*(?:Đáp\s*án|Dap\s*an|ĐA|DA|Answer)\s*[:\-]\s*(.+)\s*$", re.IGNORECASE)
ANSWER_INLINE_RE = re.compile(r"\s*(?:\(|\[)?\s*(?:Đáp\s*án|Dap\s*an|ĐA|DA|Answer)\s*[:\-]\s*([^\)\]]+)\s*(?:\)|\])?\s*$", re.IGNORECASE)
ANSWER_HEADER_RE = re.compile(r"^\s*(?:ĐÁP\s*ÁN|DAP\s*AN|ĐA|DA|ANSWER)\s*$", re.IGNORECASE)
DETAILED_ANSWER_RE = re.compile(r"^\s*(?:ĐÁP\s*ÁN|DAP\s*AN|ANSWER)\s+CHI\s+TIẾT\s*$", re.IGNORECASE)
END_MARKER_RE = re.compile(r"^\s*[-–—_=.\s]*H[ẾE]T[-–—_=.\s]*\s*$", re.IGNORECASE)
TABLE_ROW_RE = re.compile(r"^\[\*\s*(.*?)\s*\*\]$")
STYLE_TOKEN_RE = re.compile(r"\[!(b|i|sup|sub):\$(.*?)\$\]")
MATH_TOKEN_RE = re.compile(r"\[math:\$(.*?)\$\]")
IMAGE_TOKEN_RE = re.compile(r"\[img:\$([^\$]+)\$\]")
TOKEN_SPLIT_RE = re.compile(r"(\[!(?:b|i|sup|sub):\$.*?\$\]|\[math:\$.*?\$\]|\[img:\$[^\$]+\$\])")
IMAGE_ONLY_LINE_RE = re.compile(r"^\s*\[img:\$[^\$]+\$\]\s*$")
SUPSUB_ONLY_LINE_RE = re.compile(r"^\s*\[!(?:sup|sub):\$.*?\$\]\s*$", re.DOTALL)
ANSWER_TF_TEXT_RE = re.compile(r"^[ĐSđsTFtf,\.\s]{2,20}$")
ANSWER_SINGLE_RE = re.compile(r"^[A-Da-d]$")
QUESTION_RANGE_RE = re.compile(
    r"(?:từ|tu)\s*câu\s*(\d{1,4})\s*(?:đến|den)\s*câu\s*(\d{1,4})",
    re.IGNORECASE,
)
EMBEDDED_QUESTION_RE = re.compile(
    r"(?<=[^\s])((?:Câu|Cau|Question|Q)\s*(?:số|so|number|no\.?)?\s*\d{1,4}(?:\s*[:\.\)\-])?)",
    re.IGNORECASE,
)
INLINE_CHOICE_RE = re.compile(r"(?<![\w])([A-D])\.\s*")


STYLE_MAP = {"b": "bold", "i": "italic", "sup": "sup", "sub": "sub"}
PART_TYPE_BY_INDEX = {1: "single_choice", 2: "true_false_group", 3: "short_answer"}
PART_NAME_BY_INDEX = {1: "PHẦN I", 2: "PHẦN II", 3: "PHẦN III"}


@dataclass(slots=True)
class _SectionDescriptor:
    sequence: int
    part_id: str
    name: str
    declared_type: str
    declared_question_start: int | None = None
    declared_question_end: int | None = None

    def contains_question(self, question_no: int | None) -> bool:
        if question_no is None:
            return False
        if self.declared_question_start is None or self.declared_question_end is None:
            return False
        return self.declared_question_start <= question_no <= self.declared_question_end


@dataclass(slots=True)
class _QuestionBuffer:
    id: str
    source_number: int | None
    part_id: str
    qtype: str
    declared_qtype: str | None = None
    declared_question_start: int | None = None
    declared_question_end: int | None = None
    stem_lines: list[str] = field(default_factory=list)
    choices: dict[str, list[str]] = field(default_factory=dict)
    statements: dict[str, list[str]] = field(default_factory=dict)
    answer_raw: str | None = None
    last_bucket: tuple[str, str] | None = None


def _strip_markup_for_detection(text: str) -> str:
    out = text or ""
    while True:
        replaced = re.sub(r"\[!(?:b|i|sup|sub):\$(.*?)\$\]", r"\1", out, flags=re.DOTALL)
        if replaced == out:
            break
        out = replaced
    out = re.sub(r"\[img:\$[^\$]+\$\]", " ", out)
    out = re.sub(r"\[math:\$(.*?)\$\]", r"\1", out, flags=re.DOTALL)
    out = re.sub(r"\[br\]", " ", out, flags=re.IGNORECASE)
    return SPACE_RE.sub(" ", out).strip()


def _is_image_line(line: str) -> bool:
    return bool(IMAGE_TOKEN_RE.fullmatch(line.strip()))


def _is_table_line(line: str) -> bool:
    return bool(TABLE_ROW_RE.fullmatch(line.strip()))


def _is_text_candidate(line: str) -> bool:
    stripped = line.strip()
    return bool(stripped) and not _is_image_line(stripped) and not _is_table_line(stripped)


def _default_qtype(part_id: str, section_name: str | None) -> str:
    part_num = int(part_id.replace("part", "")) if part_id.startswith("part") and part_id[4:].isdigit() else None
    if part_num in PART_TYPE_BY_INDEX:
        return PART_TYPE_BY_INDEX[part_num]
    text = (section_name or "").lower()
    if "đúng sai" in text or "dung sai" in text or "true false" in text:
        return "true_false_group"
    if "trả lời ngắn" in text or "short answer" in text or "tự luận" in text or "tu luan" in text:
        return "short_answer"
    return "single_choice"


def _extract_declared_question_range(section_name: str | None) -> tuple[int | None, int | None]:
    text = _strip_markup_for_detection(section_name or "")
    match = QUESTION_RANGE_RE.search(text)
    if not match:
        return None, None
    start = int(match.group(1))
    end = int(match.group(2))
    if end < start:
        start, end = end, start
    return start, end


def _build_section_descriptor(plain_line: str, *, sequence: int) -> _SectionDescriptor | None:
    section = match_section_header(plain_line or "")
    if not section:
        return None
    part_idx = section.part_index
    part_id = f"part{part_idx}"
    start, end = _extract_declared_question_range(plain_line)
    return _SectionDescriptor(
        sequence=sequence,
        part_id=part_id,
        name=plain_line.strip() or PART_NAME_BY_INDEX.get(part_idx, part_id.upper()),
        declared_type=_default_qtype(part_id, plain_line),
        declared_question_start=start,
        declared_question_end=end,
    )


def _collect_section_descriptors_from_lines(lines: list[str]) -> list[_SectionDescriptor]:
    descriptors: list[_SectionDescriptor] = []
    seen_by_part_id: dict[str, int] = {}
    sequence = 1
    for line in lines:
        plain_line = _strip_markup_for_detection(line)
        descriptor = _build_section_descriptor(plain_line, sequence=sequence)
        if not descriptor:
            continue
        sequence = max(sequence + 1, int(descriptor.part_id.replace("part", "")) + 1)
        existing_index = seen_by_part_id.get(descriptor.part_id)
        if existing_index is None:
            seen_by_part_id[descriptor.part_id] = len(descriptors)
            descriptors.append(descriptor)
            continue
        existing = descriptors[existing_index]
        if (
            existing.declared_question_start is None
            and existing.declared_question_end is None
            and descriptor.declared_question_start is not None
            and descriptor.declared_question_end is not None
        ):
            descriptors[existing_index] = descriptor
    return descriptors


def _supports_global_question_ranges(descriptors: list[_SectionDescriptor]) -> bool:
    if len(descriptors) < 2:
        return False
    for index, descriptor in enumerate(descriptors):
        start = descriptor.declared_question_start
        end = descriptor.declared_question_end
        if start is None or end is None:
            return False
        if end < start:
            return False
        if index == 0:
            continue
        previous = descriptors[index - 1]
        if previous.declared_question_end is None or previous.declared_question_end >= start:
            return False
    return True


def _resolve_descriptor_index_for_question(
    question_no: int | None,
    descriptors: list[_SectionDescriptor],
    current_index: int,
    *,
    allow_global_range_inference: bool,
) -> int:
    if not descriptors:
        return current_index
    if current_index < 0 or current_index >= len(descriptors):
        current_index = 0
    current = descriptors[current_index]
    if current.contains_question(question_no):
        return current_index
    if not allow_global_range_inference or question_no is None:
        return current_index
    for index, descriptor in enumerate(descriptors):
        if descriptor.contains_question(question_no):
            return index
    return current_index


def collect_section_descriptors(full_raw_markup: str) -> list[_SectionDescriptor]:
    lines = _merge_multiline_table_blocks((full_raw_markup or "").splitlines())
    exam_lines, _ = _split_exam_and_answer_lines(lines)
    return _collect_section_descriptors_from_lines(exam_lines)


def _normalize_answer_value(value: str) -> str:
    s = SPACE_RE.sub(" ", (value or "").strip().strip(".,;"))
    if ANSWER_SINGLE_RE.fullmatch(s):
        return s.upper()
    if ANSWER_TF_TEXT_RE.fullmatch(s):
        compact = s.replace(" ", "").replace(",", "").replace(".", "").upper()
        compact = compact.replace("T", "Đ").replace("F", "S")
        return compact
    return s


def _split_answer_inline(line: str) -> tuple[str, str | None]:
    plain_line = _strip_markup_for_detection(line)
    match = ANSWER_INLINE_RE.search(plain_line)
    if not match:
        return line, None
    answer = _normalize_answer_value(match.group(1))
    cleaned = line[: len(line) - len(plain_line[match.start() :])].strip()
    if cleaned == line:
        cleaned = line[: match.start()].strip()
    return cleaned, answer


def _split_table_cells(line: str) -> list[str] | None:
    match = TABLE_ROW_RE.match(line.strip())
    if not match:
        return None
    return [cell.strip() for cell in match.group(1).split("|")]


def _merge_multiline_table_blocks(lines: list[str]) -> list[str]:
    merged: list[str] = []
    buffer: list[str] = []

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if buffer:
            buffer.append(stripped)
            if stripped.endswith("*]"):
                merged.append(" ".join(buffer))
                buffer = []
            continue
        if stripped.startswith("[*") and not stripped.endswith("*]"):
            buffer = [stripped]
            continue
        merged.append(stripped)

    if buffer:
        merged.extend(buffer)
    return merged


def _looks_like_answer_zone_start(plain_line: str) -> bool:
    compact = SPACE_RE.sub(" ", plain_line).strip()
    if not compact:
        return False
    if ANSWER_HEADER_RE.match(compact):
        return True
    if DETAILED_ANSWER_RE.match(compact):
        return True
    return False


def _split_exam_and_answer_lines(lines: list[str]) -> tuple[list[str], list[str]]:
    exam_lines: list[str] = []
    answer_lines: list[str] = []
    in_answer_zone = False

    for line in _expand_embedded_section_lines(lines):
        plain_line = _strip_markup_for_detection(line)
        if not in_answer_zone and END_MARKER_RE.search(plain_line):
            in_answer_zone = True
            continue
        if not in_answer_zone and _looks_like_answer_zone_start(plain_line):
            in_answer_zone = True
        if in_answer_zone:
            answer_lines.append(line)
        else:
            exam_lines.append(line)
    return exam_lines, answer_lines


def _split_embedded_question_line(line: str) -> tuple[str, str] | None:
    match = EMBEDDED_QUESTION_RE.search(line)
    if not match:
        return None
    prefix = line[: match.start()].strip()
    suffix = line[match.start() :].strip()
    if not suffix:
        return None
    return prefix, suffix


def _split_embedded_section_line(line: str) -> tuple[str, str] | None:
    stripped = line.strip()
    if not stripped:
        return None
    plain_line = _strip_markup_for_detection(stripped)
    if match_section_header(plain_line):
        return None
    section_start = find_embedded_section_start(stripped)
    if section_start is None:
        return None
    prefix = stripped[:section_start].strip()
    suffix = stripped[section_start:].strip()
    if not prefix or not suffix:
        return None
    return prefix, suffix


def _expand_embedded_section_lines(lines: list[str]) -> list[str]:
    expanded: list[str] = []
    for line in lines:
        split = _split_embedded_section_line(line)
        if not split:
            expanded.append(line)
            continue
        prefix, suffix = split
        expanded.append(prefix)
        expanded.append(suffix)
    return expanded


def _split_inline_choices_from_stem(line: str) -> tuple[str, dict[str, list[str]]] | None:
    matches = list(INLINE_CHOICE_RE.finditer(line))
    if len(matches) < 2:
        return None
    labels = [match.group(1).upper() for match in matches]
    if labels[:4] != ["A", "B", "C", "D"]:
        return None
    stem = line[: matches[0].start()].strip()
    choices: dict[str, list[str]] = {}
    for idx, match in enumerate(matches):
        label = match.group(1).upper()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(line)
        content = line[match.end() : end].strip()
        if idx + 1 == len(matches):
            content = re.sub(r"\s*\*\]\s*$", "", content).strip()
        if not content:
            return None
        choices[label] = [content]
    if line.startswith("[*") and line.endswith("*]") and stem and not stem.endswith("*]"):
        stem = stem.rstrip() + " *]"
    return stem, choices


def _parse_question_start(line: str, *, allow_numeric_fallback: bool = True) -> tuple[int | None, str] | None:
    table_cells = _split_table_cells(line)
    candidate_line = table_cells[0] if table_cells else line
    plain_line = _strip_markup_for_detection(candidate_line)
    direct = QUESTION_RE.match(plain_line)
    if direct:
        stem = re.sub(
            r"^\s*(?:Câu|Cau|Question|Q)\s*(?:số|so|number|no\.?)?\s*\d{1,4}(?:\s*[:\.\)\-])?\s*",
            "",
            candidate_line,
            flags=re.IGNORECASE,
        ).strip()
        if table_cells:
            rebuilt_cells = list(table_cells)
            rebuilt_cells[0] = stem or direct.group(2).strip()
            return int(direct.group(1)), "[* " + " | ".join(rebuilt_cells) + " *]"
        return int(direct.group(1)), (stem or direct.group(2).strip())
    if not allow_numeric_fallback:
        return None
    fallback = NUMERIC_QUESTION_RE.match(plain_line)
    if fallback:
        stem = re.sub(r"^\s*\d{1,4}\s*[\.\)]\s*", "", candidate_line).strip()
        if table_cells:
            rebuilt_cells = list(table_cells)
            rebuilt_cells[0] = stem or fallback.group(2).strip()
            return int(fallback.group(1)), "[* " + " | ".join(rebuilt_cells) + " *]"
        return int(fallback.group(1)), (stem or fallback.group(2).strip())
    return None


def _append_to_bucket(question: _QuestionBuffer, line: str) -> None:
    bucket = question.last_bucket
    if not bucket:
        question.stem_lines.append(line)
        return
    where, key = bucket
    if where == "choice" and key in question.choices:
        question.choices[key].append(line)
        return
    if where == "statement" and key in question.statements:
        question.statements[key].append(line)
        return
    question.stem_lines.append(line)


def _parse_inline_fragments(text: str) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for part in TOKEN_SPLIT_RE.split(text):
        if not part:
            continue
        sm = STYLE_TOKEN_RE.fullmatch(part)
        if sm:
            style = STYLE_MAP.get(sm.group(1).lower(), "plain")
            payload = {"type": "text", "text": sm.group(2)}
            if style != "plain":
                payload["marks"] = [style]
            out.append(payload)
            continue
        mm = MATH_TOKEN_RE.fullmatch(part)
        if mm:
            out.append({"type": "math", "latex": mm.group(1)})
            continue
        im = IMAGE_TOKEN_RE.fullmatch(part)
        if im:
            out.append({"type": "image", "image_id": im.group(1)})
            continue
        normalized = re.sub(r"[ \t]+", " ", re.sub(r"\[br\]", "\n", part, flags=re.IGNORECASE))
        normalized = re.sub(r" *\n *", "\n", normalized)
        normalized = normalized.strip(" ")
        if normalized:
            out.append({"type": "text", "text": normalized})
    return out


def _parse_table_row(line: str) -> dict[str, Any] | None:
    match = TABLE_ROW_RE.match(line.strip())
    if not match:
        return None
        
    raw_content = match.group(1).strip()
    if not raw_content:
        return {"type": "table_row", "cells": []}
        
    cells = [cell.strip() for cell in raw_content.split("|")]
    parsed_cells: list[dict[str, Any]] = []
    
    for cell in cells:
        colspan, rowspan = 1, 1
        m = re.match(r"^\{\{([cr=\d,]+)\}\}\s*(.*)$", cell)
        if m:
            props = m.group(1).split(',')
            for p in props:
                if p.startswith("c="): colspan = int(p[2:])
                if p.startswith("r="): rowspan = int(p[2:])
            content = m.group(2)
        else:
            content = cell
            
        parsed_cells.append({
            "colspan": colspan,
            "rowspan": rowspan,
            "content": _parse_inline_fragments(content)
        })
        
    return {"type": "table_row", "cells": parsed_cells}


def _join_wrapped_lines(lines: list[str]) -> str:
    compact = [line.strip() for line in lines if line and line.strip()]
    if not compact:
        return ""

    joined = compact[0]
    for line in compact[1:]:
        if not joined:
            joined = line
            continue
        if line[:1] in {",", ".", ";", ":", "!", "?", "%", ")", "]", "}"}:
            joined += line
            continue
        if SUPSUB_ONLY_LINE_RE.fullmatch(line) and joined[-1:].isalnum():
            joined += line
            continue
        if joined[-1:] in {"(", "[", "{", "/"}:
            joined += line
            continue
        joined += f" {line}"

    joined = re.sub(r"\s+([,.;:!?%)\]}])", r"\1", joined)
    joined = re.sub(r"([(\[{])\s+", r"\1", joined)
    return SPACE_RE.sub(" ", joined).strip()


def _lines_to_blocks(lines: list[str]) -> list[dict[str, Any]]:
    blocks: list[dict[str, Any]] = []
    pending_rows: list[dict[str, Any]] = []
    pending_paragraph_lines: list[str] = []

    def flush_table() -> None:
        nonlocal pending_rows
        if pending_rows:
            blocks.append({"type": "table", "rows": pending_rows})
            pending_rows = []

    def flush_paragraph() -> None:
        nonlocal pending_paragraph_lines
        if not pending_paragraph_lines:
            return
        merged = _join_wrapped_lines(pending_paragraph_lines)
        pending_paragraph_lines = []
        if merged:
            blocks.append({"type": "paragraph", "inlines": _parse_inline_fragments(merged)})

    for line in lines:
        tline = line.strip()
        if not tline:
            continue
        table_row = _parse_table_row(tline)
        if table_row:
            flush_paragraph()
            pending_rows.append(table_row)
            continue
        flush_table()
        if IMAGE_ONLY_LINE_RE.fullmatch(tline):
            flush_paragraph()
            blocks.append({"type": "paragraph", "inlines": _parse_inline_fragments(tline)})
            continue
        pending_paragraph_lines.append(tline)
    flush_paragraph()
    flush_table()
    return blocks


def _to_tf_answer_map(answer_raw: str | None, statement_keys: list[str]) -> dict[str, bool] | None:
    if not answer_raw:
        return None
    compact = _normalize_answer_value(answer_raw)
    if not compact:
        return None
    out: dict[str, bool] = {}
    for idx, ch in enumerate(compact):
        if idx >= len(statement_keys):
            break
        key = statement_keys[idx]
        if ch == "Đ":
            out[key] = True
        elif ch == "S":
            out[key] = False
    return out or None


def _recover_unlabeled_choices(buffer: _QuestionBuffer) -> None:
    if (buffer.declared_qtype or buffer.qtype) != "single_choice":
        return
    if set(buffer.choices.keys()) <= {"C", "D"}:
        for idx, line in enumerate(buffer.stem_lines):
            plain = _strip_markup_for_detection(line)
            split_b = re.split(r"\bB\.\s*", plain, maxsplit=1)
            if len(split_b) == 2 and split_b[0].strip() and split_b[1].strip():
                buffer.choices.setdefault("A", [split_b[0].strip()])
                buffer.choices.setdefault("B", [split_b[1].strip()])
                buffer.stem_lines = [item for pos, item in enumerate(buffer.stem_lines) if pos != idx]
                break
    if buffer.choices:
        return
    candidate_indexes = [idx for idx, line in enumerate(buffer.stem_lines) if _is_text_candidate(line)]
    if len(candidate_indexes) < 5:
        return
    selected = candidate_indexes[-4:]
    recovered: dict[str, list[str]] = {}
    for label, idx in zip(("A", "B", "C", "D"), selected):
        content = re.sub(r"^\s*[A-Da-d][\.\):]\s*", "", buffer.stem_lines[idx]).strip()
        if not content:
            return
        recovered[label] = [content]
    buffer.choices = recovered
    buffer.stem_lines = [line for idx, line in enumerate(buffer.stem_lines) if idx not in set(selected)]


def _recover_unlabeled_statements(buffer: _QuestionBuffer) -> None:
    if (buffer.declared_qtype or buffer.qtype) != "true_false_group":
        return
    existing_keys = list(buffer.statements.keys())
    if len(existing_keys) >= 4:
        return
    missing_keys = [key for key in ("a", "b", "c", "d") if key not in buffer.statements]
    candidate_indexes = [idx for idx, line in enumerate(buffer.stem_lines) if _is_text_candidate(line)]
    if len(candidate_indexes) < len(missing_keys) + 1:
        return
    selected = candidate_indexes[-len(missing_keys) :]
    for key, idx in zip(missing_keys, selected):
        content = re.sub(r"^\s*[a-dA-D][\.\):]\s*", "", buffer.stem_lines[idx]).lstrip(".").strip()
        if not content:
            return
        buffer.statements[key] = [content]
    buffer.stem_lines = [line for idx, line in enumerate(buffer.stem_lines) if idx not in set(selected)]


def _coerce_answer_value(raw_value: str, qtype: str, question_payload: dict[str, Any]) -> Any:
    normalized = _normalize_answer_value(raw_value)
    if not normalized:
        return None
    if qtype == "single_choice":
        return normalized if ANSWER_SINGLE_RE.fullmatch(normalized) else None
    if qtype == "true_false_group":
        keys = [statement.get("id") for statement in question_payload.get("statements", [])]
        return _to_tf_answer_map(normalized, keys)
    return normalized


def _parse_answer_rows(answer_lines: list[str]) -> tuple[dict[int, str], dict[str, dict[int, str]]]:
    global_mapping: dict[int, str] = {}
    part_mapping: dict[str, dict[int, str]] = {}
    table_rows: list[tuple[str | None, list[str]]] = []
    current_part_id: str | None = None
    for line in answer_lines:
        plain_line = _strip_markup_for_detection(line)
        section = match_section_header(plain_line)
        if section:
            part_idx = section.part_index
            current_part_id = f"part{part_idx}"
            part_mapping.setdefault(current_part_id, {})
            continue
        match = TABLE_ROW_RE.match(line.strip())
        if not match:
            continue
        cells = [_strip_markup_for_detection(cell).strip() for cell in match.group(1).split("|")]
        cells = [cell for cell in cells if cell]
        if not cells:
            continue
        if all(re.fullmatch(r"-{2,}", cell) for cell in cells):
            continue
        table_rows.append((current_part_id, cells))

    for part_id, cells in table_rows:
        if len(cells) >= 2 and re.fullmatch(r"\d{1,4}", cells[0]):
            value = _normalize_answer_value(cells[1])
            if value:
                if part_id:
                    part_mapping.setdefault(part_id, {})[int(cells[0])] = value
                else:
                    global_mapping[int(cells[0])] = value

    for idx in range(0, len(table_rows) - 1, 2):
        part_id, number_row = table_rows[idx]
        next_part_id, value_row = table_rows[idx + 1]
        if not number_row or not value_row:
            continue
        if part_id != next_part_id:
            continue
        if not all(re.fullmatch(r"\d{1,4}", cell) for cell in number_row):
            continue
        if len(number_row) != len(value_row):
            continue
        for qno, value in zip(number_row, value_row):
            normalized = _normalize_answer_value(value)
            if part_id:
                part_mapping.setdefault(part_id, {})[int(qno)] = normalized
            else:
                global_mapping[int(qno)] = normalized
    return global_mapping, part_mapping


def _finalize_question(buffer: _QuestionBuffer) -> tuple[dict[str, Any], Any]:
    _recover_unlabeled_choices(buffer)
    _recover_unlabeled_statements(buffer)

    part_num = int(buffer.part_id.replace("part", "")) if buffer.part_id[4:].isdigit() else None
    has_slot = any("[[" in line and "]]" in line for line in buffer.stem_lines)
    has_choices = bool(buffer.choices)
    has_statements = bool(buffer.statements)
    in_declared_range = (
        buffer.source_number is not None
        and buffer.declared_question_start is not None
        and buffer.declared_question_end is not None
        and buffer.declared_question_start <= buffer.source_number <= buffer.declared_question_end
    )

    qtype = buffer.qtype
    if in_declared_range and buffer.declared_qtype:
        qtype = buffer.declared_qtype
    elif part_num == 1:
        qtype = "single_choice"
    elif part_num == 2:
        qtype = "true_false_group"
    elif part_num == 3:
        qtype = "short_answer"

    if not in_declared_range:
        if qtype == "short_answer" and has_choices and not has_slot:
            qtype = "single_choice"
        if qtype == "true_false_group" and not has_statements and has_slot:
            qtype = "short_answer"
        if qtype == "single_choice" and has_statements and not has_choices:
            qtype = "true_false_group"

    public_q: dict[str, Any] = {
        "id": buffer.id,
        "source_number": buffer.source_number,
        "type": qtype,
        "stem_blocks": _lines_to_blocks(buffer.stem_lines),
    }
    private_answer: Any = None

    if qtype == "single_choice":
        ordered_labels = [label for label in ("A", "B", "C", "D") if label in buffer.choices]
        for label in sorted(buffer.choices.keys()):
            if label not in ordered_labels:
                ordered_labels.append(label)
        public_q["choices"] = [
            {"id": label, "content_blocks": _lines_to_blocks(buffer.choices[label])} for label in ordered_labels
        ]
        if buffer.answer_raw:
            normalized = _normalize_answer_value(buffer.answer_raw)
            if ANSWER_SINGLE_RE.fullmatch(normalized):
                private_answer = normalized.upper()

    elif qtype == "true_false_group":
        ordered_keys = [k for k in ("a", "b", "c", "d") if k in buffer.statements]
        for key in sorted(buffer.statements.keys()):
            if key not in ordered_keys:
                ordered_keys.append(key)
        public_q["statements"] = [
            {"id": key, "content_blocks": _lines_to_blocks(buffer.statements[key])} for key in ordered_keys
        ]
        private_answer = _to_tf_answer_map(buffer.answer_raw, ordered_keys)

    else:
        public_q["answer_slot_count"] = sum(line.count("[[") for line in buffer.stem_lines)
        if buffer.answer_raw:
            private_answer = _normalize_answer_value(buffer.answer_raw)

    return public_q, private_answer


def parse_full_raw_markup(full_raw_markup: str, *, title: str = "Imported exam") -> ParseResult:
    lines = _expand_embedded_section_lines(_merge_multiline_table_blocks((full_raw_markup or "").splitlines()))
    exam_lines, answer_section_lines = _split_exam_and_answer_lines(lines)
    section_descriptors = _collect_section_descriptors_from_lines(exam_lines)
    allow_global_range_inference = _supports_global_question_ranges(section_descriptors)

    parts: list[dict[str, Any]] = []
    answer_key: dict[str, Any] = {}
    answer_key_template: dict[str, Any] = {}
    question_sequence: list[dict[str, Any]] = []

    if section_descriptors:
        current_descriptor_index = 0
        current_descriptor = section_descriptors[0]
    else:
        current_descriptor_index = 0
        current_descriptor = _SectionDescriptor(
            sequence=1,
            part_id="part1",
            name=PART_NAME_BY_INDEX.get(1, "PHẦN I"),
            declared_type=_default_qtype("part1", PART_NAME_BY_INDEX.get(1, "PHẦN I")),
        )
        section_descriptors = [current_descriptor]
    part_seq = max((descriptor.sequence for descriptor in section_descriptors), default=1) + 1
    current_part_id = current_descriptor.part_id
    current_part_name = current_descriptor.name
    current_part_qtype = current_descriptor.declared_type
    current_part_questions: list[dict[str, Any]] = []
    part_question_counter: dict[str, int] = {current_part_id: 0}
    pending_part_lines: list[str] = []
    seen_section = False

    current_question: _QuestionBuffer | None = None

    def flush_question() -> None:
        nonlocal current_question
        if not current_question:
            return
        public_q, private_answer = _finalize_question(current_question)
        current_part_questions.append(public_q)
        answer_key_template[current_question.id] = None
        if private_answer is not None:
            answer_key[current_question.id] = private_answer
        question_sequence.append({"id": current_question.id, "type": public_q["type"], "question": public_q})
        current_question = None

    def flush_part() -> None:
        if not current_part_questions:
            return
        parts.append(
            {
                "id": current_part_id,
                "name": current_part_name,
                "type": current_part_qtype,
                "questions": list(current_part_questions),
            }
        )
        current_part_questions.clear()

    for line in exam_lines:
        if current_question:
            embedded = _split_embedded_question_line(line)
            if embedded:
                flush_question()
                prefix, line = embedded
                if prefix:
                    pending_part_lines.append(prefix)
        plain_line = _strip_markup_for_detection(line)

        section = match_section_header(plain_line)
        if section:
            flush_question()
            pending_part_lines.clear()
            seen_section = True
            part_idx = section.part_index
            next_part_id = f"part{part_idx}"
            next_descriptor_index = next(
                (index for index, descriptor in enumerate(section_descriptors) if descriptor.part_id == next_part_id),
                None,
            )
            if next_descriptor_index is None:
                current_descriptor = _SectionDescriptor(
                    sequence=part_idx,
                    part_id=next_part_id,
                    name=plain_line,
                    declared_type=_default_qtype(next_part_id, plain_line),
                    declared_question_start=_extract_declared_question_range(plain_line)[0],
                    declared_question_end=_extract_declared_question_range(plain_line)[1],
                )
                section_descriptors.append(current_descriptor)
                current_descriptor_index = len(section_descriptors) - 1
            else:
                current_descriptor_index = next_descriptor_index
                current_descriptor = section_descriptors[current_descriptor_index]
            if current_part_id != current_descriptor.part_id:
                flush_part()
            part_seq = max(part_seq + 1, part_idx + 1)
            current_part_id = current_descriptor.part_id
            current_part_name = current_descriptor.name
            current_part_qtype = current_descriptor.declared_type
            part_question_counter.setdefault(current_part_id, 0)
            continue

        qstart = _parse_question_start(line, allow_numeric_fallback=current_question is None)
        if qstart:
            source_number, stem = qstart
            next_descriptor_index = _resolve_descriptor_index_for_question(
                source_number,
                section_descriptors,
                current_descriptor_index,
                allow_global_range_inference=allow_global_range_inference,
            )
            next_descriptor = section_descriptors[next_descriptor_index]
            if next_descriptor.part_id != current_part_id:
                flush_question()
                flush_part()
                pending_part_lines.clear()
                seen_section = True
                current_descriptor_index = next_descriptor_index
                current_descriptor = next_descriptor
                current_part_id = current_descriptor.part_id
                current_part_name = current_descriptor.name
                current_part_qtype = current_descriptor.declared_type
                part_question_counter.setdefault(current_part_id, 0)
            else:
                flush_question()
            part_question_counter[current_part_id] = part_question_counter.get(current_part_id, 0) + 1
            qid = f"{current_part_id}.q{part_question_counter[current_part_id]}"
            current_question = _QuestionBuffer(
                id=qid,
                source_number=source_number,
                part_id=current_part_id,
                qtype=current_part_qtype,
                declared_qtype=current_descriptor.declared_type,
                declared_question_start=current_descriptor.declared_question_start,
                declared_question_end=current_descriptor.declared_question_end,
            )
            if pending_part_lines:
                current_question.stem_lines.extend(pending_part_lines)
                pending_part_lines.clear()
            stem, inline_answer = _split_answer_inline(stem)
            if stem:
                inline_choice_split = None
                if current_question.qtype == "single_choice":
                    inline_choice_split = _split_inline_choices_from_stem(stem)
                if inline_choice_split:
                    stem_line, recovered_choices = inline_choice_split
                    if stem_line:
                        current_question.stem_lines.append(stem_line)
                    for label in ("A", "B", "C", "D"):
                        if label in recovered_choices:
                            current_question.choices[label] = recovered_choices[label]
                    current_question.last_bucket = ("choice", "D")
                else:
                    current_question.stem_lines.append(stem)
            if inline_answer:
                current_question.answer_raw = inline_answer
            continue

        if not current_question:
            if seen_section:
                pending_part_lines.append(line)
            continue

        only_answer = ANSWER_ONLY_RE.match(plain_line)
        if only_answer:
            current_question.answer_raw = _normalize_answer_value(only_answer.group(1))
            current_question.last_bucket = None
            continue

        cleaned_line, inline_answer = _split_answer_inline(line)
        if inline_answer:
            current_question.answer_raw = inline_answer
        if not cleaned_line:
            continue

        plain_cleaned = _strip_markup_for_detection(cleaned_line)

        option_match = None
        option_content = None
        if _is_table_line(cleaned_line):
            cells = _split_table_cells(cleaned_line)
            if cells:
                first_cell_plain = _strip_markup_for_detection(cells[0])
                om = OPTION_RE.match(first_cell_plain)
                if om:
                    option_match = om
                    option_content = cells[0]
        else:
            om = OPTION_RE.match(plain_cleaned)
            if om:
                option_match = om
                option_content = cleaned_line

        if option_match and current_question.qtype != "short_answer" and option_content is not None:
            label = option_match.group(1).upper()
            content = re.sub(r"^\s*([A-D])\s*[\.\):\-]\s*", "", option_content).strip()
            current_question.choices.setdefault(label, [])
            if content:
                current_question.choices[label].append(content)
            current_question.last_bucket = ("choice", label)
            continue

        statement_match = None
        statement_content = None
        if _is_table_line(cleaned_line):
            cells = _split_table_cells(cleaned_line)
            if cells:
                first_cell_plain = _strip_markup_for_detection(cells[0])
                sm = TF_RE.match(first_cell_plain)
                if sm:
                    statement_match = sm
                    statement_content = cells[0]
        else:
            sm = TF_RE.match(plain_cleaned)
            if sm:
                statement_match = sm
                statement_content = cleaned_line

        if statement_match and statement_content is not None:
            sid = statement_match.group(1).lower()
            content = re.sub(r"^\s*([a-dA-D])\)\s*", "", statement_content).strip()
            current_question.statements.setdefault(sid, [])
            if content:
                current_question.statements[sid].append(content)
            current_question.last_bucket = ("statement", sid)
            continue

        _append_to_bucket(current_question, cleaned_line)

    flush_question()
    flush_part()

    answer_by_global_no, answer_by_part = _parse_answer_rows(answer_section_lines)
    if answer_by_global_no or answer_by_part:
        for idx, question_meta in enumerate(question_sequence, start=1):
            question_payload = question_meta["question"]
            part_id = question_meta["id"].split(".")[0]
            source_number = question_payload.get("source_number")
            raw_answer = None
            if isinstance(source_number, int):
                raw_answer = answer_by_part.get(part_id, {}).get(source_number)
            if raw_answer is None:
                raw_answer = answer_by_global_no.get(idx)
            if raw_answer is None:
                continue
            coerced = _coerce_answer_value(raw_answer, question_meta["type"], question_payload)
            if coerced is not None:
                answer_key[question_meta["id"]] = coerced

    public_payload: dict[str, Any] = {
        "schema_version": "2026-03-19",
        "title": title,
        "parts": parts,
        "meta": {
            "part_count": len(parts),
            "question_count": sum(len(p["questions"]) for p in parts),
            "answer_section_detected": bool(answer_section_lines),
        },
    }
    private_payload: dict[str, Any] = {
        "schema_version": "2026-03-19",
        "title": title,
        "answer_key": answer_key,
        "answer_key_template": answer_key_template,
        "meta": {"question_count": len(answer_key_template)},
    }
    return ParseResult(exam_public_json=public_payload, exam_private_json=private_payload)
