from __future__ import annotations

import re
from typing import Any

from .parser import collect_section_descriptors
from .types import ExtractedWordData, ValidationReport

QUESTION_RE = re.compile(
    r"^\s*(?:Câu|Cau|Question|Q)\s*(?:số|so|number|no\.?)?\s*\d{1,4}\s*[:\.\)\-]",
    re.IGNORECASE | re.MULTILINE,
)
IMAGE_RE = re.compile(r"\[img:\$([^\$]+)\$\]")
TABLE_ROW_RE = re.compile(r"^\[\*\s*.*?\s*\*\]$", re.MULTILINE)
FORBIDDEN_PUBLIC_KEYS = {"answer", "answer_key", "correct_answer", "raw_text", "raw_markup", "debug"}
ANSWER_SECTION_RE = re.compile(r"^\s*(?:\[!b:\$)?(?:ĐÁP\s*ÁN|DAP\s*AN|ĐA|DA|ANSWER)(?:\$\])?\s*$", re.IGNORECASE | re.MULTILINE)
END_MARKER_RE = re.compile(r"^\s*[-–—_=.\s]*H[ẾE]T[-–—_=.\s]*\s*$", re.IGNORECASE)
DETAILED_ANSWER_RE = re.compile(r"^\s*(?:ĐÁP\s*ÁN|DAP\s*AN|ANSWER)\s+CHI\s+TIẾT\s*$", re.IGNORECASE)
EMBEDDED_QUESTION_RE = re.compile(
    r"(?<=[^\s])((?:Câu|Cau|Question|Q)\s*(?:số|so|number|no\.?)?\s*\d{1,4}\s*[:\.\)\-])",
    re.IGNORECASE,
)


def _collect_question_list(public_json: dict[str, Any]) -> list[dict[str, Any]]:
    parts = public_json.get("parts", [])
    questions: list[dict[str, Any]] = []
    for part in parts:
        for q in part.get("questions", []):
            enriched = dict(q)
            enriched["_part_id"] = part.get("id")
            questions.append(enriched)
    return questions


def _iter_dict_nodes(payload: Any, path: str = "$"):
    if isinstance(payload, dict):
        for key, value in payload.items():
            key_path = f"{path}.{key}"
            yield key_path, key, value
            yield from _iter_dict_nodes(value, key_path)
    elif isinstance(payload, list):
        for idx, value in enumerate(payload):
            yield from _iter_dict_nodes(value, f"{path}[{idx}]")


def _collect_public_image_ids(public_json: dict[str, Any]) -> set[str]:
    ids: set[str] = set()
    for _, key, value in _iter_dict_nodes(public_json):
        if key == "image_id" and isinstance(value, str):
            ids.add(value)
    return ids


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
    return re.sub(r"\s+", " ", out).strip()


def _split_table_cells(line: str) -> list[str] | None:
    match = re.match(r"^\[\*\s*(.*?)\s*\*\]$", line.strip())
    if not match:
        return None
    return [cell.strip() for cell in match.group(1).split("|")]


def _merge_multiline_table_blocks(lines: list[str]) -> list[str]:
    merged: list[str] = []
    buffer: list[str] = []

    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            continue
        if buffer:
            buffer.append(line)
            if line.endswith("*]"):
                merged.append(" ".join(buffer))
                buffer = []
            continue
        if line.startswith("[*") and not line.endswith("*]"):
            buffer = [line]
            continue
        merged.append(line)

    if buffer:
        merged.extend(buffer)
    return merged


def _split_embedded_question_lines(lines: list[str]) -> list[str]:
    expanded: list[str] = []
    for line in lines:
        match = EMBEDDED_QUESTION_RE.search(line)
        if not match:
            expanded.append(line)
            continue
        prefix = line[: match.start()].strip()
        suffix = line[match.start() :].strip()
        if prefix:
            expanded.append(prefix)
        if suffix:
            expanded.append(suffix)
    return expanded


def _looks_like_answer_zone_start(plain_line: str) -> bool:
    compact = re.sub(r"\s+", " ", plain_line).strip()
    if not compact:
        return False
    if ANSWER_SECTION_RE.match(compact):
        return True
    if DETAILED_ANSWER_RE.match(compact):
        return True
    return False


def _split_exam_and_answer_lines(full_raw_markup: str) -> tuple[list[str], list[str]]:
    exam_lines: list[str] = []
    answer_lines: list[str] = []
    in_answer_zone = False

    merged_lines = _split_embedded_question_lines(_merge_multiline_table_blocks((full_raw_markup or "").splitlines()))
    for line in merged_lines:
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


def _line_starts_question(line: str) -> bool:
    if QUESTION_RE.match(_strip_markup_for_detection(line)):
        return True
    cells = _split_table_cells(line)
    if cells and QUESTION_RE.match(_strip_markup_for_detection(cells[0])):
        return True
    return False


def _slice_question_body(lines: list[str]) -> list[str]:
    for idx, line in enumerate(lines):
        if _line_starts_question(line):
            return lines[idx:]
    return lines


def _count_raw_questions(lines: list[str]) -> int:
    return sum(1 for line in lines if _line_starts_question(line))


def _count_public_table_rows(public_json: dict[str, Any]) -> int:
    count = 0
    for _, key, value in _iter_dict_nodes(public_json):
        if key == "type" and value == "table":
            # The sibling "rows" list is counted where available.
            continue
    for _, key, value in _iter_dict_nodes(public_json):
        if key == "rows" and isinstance(value, list):
            count += len(value)
    return count


def _validate_part_shapes(public_json: dict[str, Any], report: ValidationReport) -> None:
    for part in public_json.get("parts", []):
        part_id = part.get("id", "")
        questions = part.get("questions", [])
        for q in questions:
            qid = q.get("id", "unknown")
            qtype = q.get("type")
            full_qid = str(qid)
            if "." not in full_qid and part_id:
                full_qid = f"{part_id}.{qid}"

            if qtype == "single_choice":
                labels = [c.get("id") for c in q.get("choices", [])]
                if labels[:4] != ["A", "B", "C", "D"]:
                    report.errors.append(f"{full_qid}: single_choice must contain A/B/C/D in order.")
            elif qtype == "true_false_group":
                labels = [s.get("id") for s in q.get("statements", [])]
                if labels[:4] != ["a", "b", "c", "d"]:
                    report.errors.append(f"{full_qid}: true_false_group must contain a/b/c/d in order.")
            elif qtype == "short_answer":
                # Part III should be short_answer by convention.
                if str(part_id) == "part3":
                    continue
            else:
                report.warnings.append(f"{full_qid}: unknown question type '{qtype}'.")


def _validate_public_private_shape(public_json: dict[str, Any], private_json: dict[str, Any], report: ValidationReport) -> None:
    for key_path, key, _ in _iter_dict_nodes(public_json):
        if key in FORBIDDEN_PUBLIC_KEYS:
            report.errors.append(f"public leak: forbidden key '{key}' at {key_path}")

    template = private_json.get("answer_key_template")
    if not isinstance(template, dict):
        report.errors.append("private_json.answer_key_template must be an object")
    answer_key = private_json.get("answer_key")
    if not isinstance(answer_key, dict):
        report.errors.append("private_json.answer_key must be an object")
    if isinstance(template, dict) and isinstance(answer_key, dict):
        unknown = sorted(set(answer_key.keys()) - set(template.keys()))
        if unknown:
            report.warnings.append(f"private answer_key has unknown question ids: {unknown}")


def _validate_declared_single_choice_range(full_raw_markup: str, public_json: dict[str, Any], report: ValidationReport) -> None:
    descriptors = collect_section_descriptors(full_raw_markup)
    if not descriptors:
        return
    first_descriptor = next((descriptor for descriptor in descriptors if descriptor.part_id == "part1"), None)
    if not first_descriptor:
        return
    if first_descriptor.declared_type != "single_choice":
        return
    start = first_descriptor.declared_question_start
    end = first_descriptor.declared_question_end
    if start is None or end is None:
        return

    for question in _collect_question_list(public_json):
        if question.get("_part_id") != first_descriptor.part_id:
            continue
        source_number = question.get("source_number")
        if not isinstance(source_number, int):
            continue
        full_qid = str(question.get("id", "unknown"))
        if "." not in full_qid:
            full_qid = f"{first_descriptor.part_id}.{full_qid}"
        if source_number < start or source_number > end:
            report.errors.append(
                f"{full_qid}: source_number={source_number} is outside declared range {start}-{end} for {first_descriptor.part_id}."
            )
            continue
        if question.get("type") != "single_choice":
            report.errors.append(f"{full_qid}: declared single_choice range must parse as single_choice.")
            continue
        labels = [choice.get("id") for choice in question.get("choices", [])]
        if labels[:4] != ["A", "B", "C", "D"]:
            report.errors.append(f"{full_qid}: declared single_choice range must contain A/B/C/D in order.")
        if question.get("statements"):
            report.errors.append(f"{full_qid}: declared single_choice range must not expose true/false statements.")
        if question.get("answer_slot_count"):
            report.errors.append(f"{full_qid}: declared single_choice range must not expose short-answer slots.")


def validate_pipeline_output(
    *,
    extracted_word_data: ExtractedWordData,
    full_raw_markup: str,
    exam_public_json: dict[str, Any],
    exam_private_json: dict[str, Any],
) -> ValidationReport:
    report = ValidationReport()
    raw_exam_lines, _ = _split_exam_and_answer_lines(full_raw_markup)
    raw_question_body_lines = _slice_question_body(raw_exam_lines)
    raw_question_body = "\n".join(raw_question_body_lines)

    expected_question_count = _count_raw_questions(raw_exam_lines)
    public_questions = _collect_question_list(exam_public_json)
    public_question_count = len(public_questions)
    if expected_question_count and public_question_count != expected_question_count:
        report.errors.append(
            f"question count mismatch: raw={expected_question_count}, public={public_question_count}"
        )

    raw_image_ids = set(IMAGE_RE.findall(raw_question_body))
    public_image_ids = _collect_public_image_ids(exam_public_json)
    if raw_image_ids != public_image_ids:
        missing_in_public = sorted(raw_image_ids - public_image_ids)
        unknown_in_public = sorted(public_image_ids - raw_image_ids)
        if missing_in_public:
            report.errors.append(f"images missing in public JSON: {missing_in_public}")
        if unknown_in_public:
            report.warnings.append(f"public JSON references unknown images: {unknown_in_public}")

    raw_table_row_count = len(TABLE_ROW_RE.findall(raw_question_body))
    public_table_row_count = _count_public_table_rows(exam_public_json)
    if raw_table_row_count != public_table_row_count:
        report.errors.append(
            f"table row mismatch: raw={raw_table_row_count}, public={public_table_row_count}"
        )

    extracted_images = set(extracted_word_data.assets.get("images", {}).keys())
    if not raw_image_ids.issubset(extracted_images):
        report.errors.append("raw markup has image ids not present in extracted assets")

    _validate_part_shapes(exam_public_json, report)
    _validate_declared_single_choice_range(full_raw_markup, exam_public_json, report)
    _validate_public_private_shape(exam_public_json, exam_private_json, report)

    report.stats = {
        "question_count_raw": expected_question_count,
        "question_count_public": public_question_count,
        "image_count_raw": len(raw_image_ids),
        "image_count_public": len(public_image_ids),
        "table_rows_raw": raw_table_row_count,
        "table_rows_public": public_table_row_count,
    }
    return report
