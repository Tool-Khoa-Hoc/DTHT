from __future__ import annotations

import re
import shutil
import unicodedata
from pathlib import Path
from typing import Any


LEGACY_RESOURCE_TEMPLATE = {
    "exam_file_url": None,
    "answer_file_url": None,
    "answer_file_name": None,
    "video_url": None,
    "edit_link": None,
}

PART_DESCRIPTION_BY_TYPE = {
    "single_choice": (
        "Câu trắc nghiệm nhiều phương án lựa chọn. "
        "Thí sinh trả lời từ câu 1 đến câu {count}. "
        "Mỗi câu hỏi thí sinh chỉ chọn một phương án."
    ),
    "true_false_group": (
        "Câu trắc nghiệm đúng sai. "
        "Thí sinh trả lời từ câu 1 đến câu {count}. "
        "Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai."
    ),
    "short_answer": (
        "Thí sinh trả lời từ câu 1 đến câu {count}. "
        "Thí sinh điền kết quả mỗi câu vào ô trả lời tương ứng theo hướng dẫn của phiếu trả lời."
    ),
}

MARK_NAMES = {"bold", "italic", "sup", "sub"}


def normalize_slug(value: str) -> str:
    text = str(value or "").replace("Đ", "D").replace("đ", "d")
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("utf-8")
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text.lower())
    return text.strip("-") or "exam"


def _normalize_question_type(value: str | None) -> str:
    text = str(value or "").strip().lower()
    if text == "true_false":
        return "true_false_group"
    if text in {"single_choice", "true_false_group", "short_answer"}:
        return text
    return "single_choice"


def _is_math_subject(subject: str) -> bool:
    normalized = normalize_slug(subject)
    return "toan" in normalized or "math" in normalized


def _question_points(question_type: str, subject: str) -> Any:
    if question_type == "single_choice":
        return 0.25
    if question_type == "true_false_group":
        return [0.1, 0.25, 0.5, 1]
    return 0.5 if _is_math_subject(subject) else 0.25


def _part_description(question_type: str, question_count: int) -> str:
    template = PART_DESCRIPTION_BY_TYPE.get(question_type, PART_DESCRIPTION_BY_TYPE["single_choice"])
    return template.format(count=max(1, question_count))


def _infer_extension(image_meta: dict[str, Any]) -> str:
    candidates = [
        image_meta.get("filename"),
        image_meta.get("path"),
        image_meta.get("source"),
    ]
    for candidate in candidates:
        suffix = Path(str(candidate or "")).suffix.strip()
        if suffix:
            return suffix.lower()
    content_type = str(image_meta.get("content_type") or "").lower()
    if "png" in content_type:
        return ".png"
    if "jpeg" in content_type or "jpg" in content_type:
        return ".jpg"
    if "gif" in content_type:
        return ".gif"
    if "webp" in content_type:
        return ".webp"
    return ".bin"


class _ImageExporter:
    def __init__(self, images: dict[str, dict[str, Any]], output_dir: Path) -> None:
        self._images = images
        self._output_dir = output_dir
        self._name_by_id: dict[str, str] = {}
        self._counter = 0

    def export(self, image_id: str) -> str:
        normalized_id = str(image_id or "").strip()
        if not normalized_id:
            raise ValueError("Image id is required.")
        if normalized_id in self._name_by_id:
            return self._name_by_id[normalized_id]

        image_meta = self._images.get(normalized_id)
        if not isinstance(image_meta, dict):
            raise KeyError(f"Image asset not found: {normalized_id}")

        source_path = Path(str(image_meta.get("path") or "")).resolve()
        if not source_path.exists():
            raise FileNotFoundError(f"Image asset file not found: {source_path}")

        self._counter += 1
        filename = f"{self._counter}{_infer_extension(image_meta)}"
        target_path = self._output_dir / filename
        shutil.copy2(source_path, target_path)
        self._name_by_id[normalized_id] = filename
        return filename


def _merge_inline_text(items: list[Any], value: str) -> None:
    if not value:
        return
    if items and isinstance(items[-1], str):
        items[-1] = items[-1] + value
    else:
        items.append(value)


def _normalize_marks(marks: Any) -> list[str]:
    normalized: list[str] = []
    for mark in marks or []:
        text = str(mark or "").strip().lower()
        if text in MARK_NAMES:
            normalized.append(text)
    return normalized


def _inline_to_legacy_items(
    inline: dict[str, Any] | str,
    image_exporter: _ImageExporter,
    *,
    table_context: bool = False,
) -> list[Any]:
    if isinstance(inline, str):
        return [inline] if inline else []
    if not isinstance(inline, dict):
        return []

    inline_type = str(inline.get("type") or "").strip().lower()
    if inline_type == "text":
        text = str(inline.get("text") or "")
        if not text:
            return []
        marks = _normalize_marks(inline.get("marks"))
        if marks:
            return [{"type": "text", "text": text, "marks": marks}]
        return [text]

    if inline_type == "math":
        latex = str(inline.get("latex") or inline.get("text") or "").strip()
        return [{"math": latex}] if latex else []

    if inline_type == "image":
        image_id = str(inline.get("image_id") or "").strip()
        if not image_id:
            return []
        image_name = image_exporter.export(image_id)
        if table_context:
            return [{"type": "image", "src": image_name, "alt": image_id}]
        return [{"image": image_name, "align": "center", "width": 100}]

    if "text" in inline:
        text = str(inline.get("text") or "")
        if not text:
            return []
        marks = _normalize_marks(inline.get("marks"))
        if marks:
            return [{"type": "text", "text": text, "marks": marks}]
        return [text]

    if "math" in inline:
        latex = str(inline.get("math") or "").strip()
        return [{"math": latex}] if latex else []

    if "image_id" in inline:
        image_id = str(inline.get("image_id") or "").strip()
        if not image_id:
            return []
        image_name = image_exporter.export(image_id)
        if table_context:
            return [{"type": "image", "src": image_name, "alt": image_id}]
        return [{"image": image_name, "align": "center", "width": 100}]

    return []


def _paragraph_block_to_legacy_blocks(block: dict[str, Any], image_exporter: _ImageExporter) -> list[Any]:
    legacy_blocks: list[Any] = []
    current_paragraph: list[Any] = []
    children = block.get("children")
    if not isinstance(children, list):
        children = block.get("inlines")
    if not isinstance(children, list):
        children = []

    def flush_paragraph() -> None:
        nonlocal current_paragraph
        if current_paragraph:
            legacy_blocks.append(current_paragraph)
            current_paragraph = []

    for inline in children:
        items = _inline_to_legacy_items(inline, image_exporter, table_context=False)
        for item in items:
            if isinstance(item, dict) and "image" in item:
                flush_paragraph()
                legacy_blocks.append(item)
                continue
            if isinstance(item, str):
                _merge_inline_text(current_paragraph, item)
            else:
                current_paragraph.append(item)

    flush_paragraph()
    return legacy_blocks


def _table_block_to_legacy_block(block: dict[str, Any], image_exporter: _ImageExporter) -> dict[str, Any]:
    legacy_rows: list[list[list[Any]]] = []
    for row in block.get("rows") or []:
        cells = row if isinstance(row, list) else row.get("cells") or []
        legacy_row: list[list[Any]] = []
        for cell in cells:
            items: list[Any] = []
            for inline in cell or []:
                for legacy_item in _inline_to_legacy_items(inline, image_exporter, table_context=True):
                    if isinstance(legacy_item, str):
                        _merge_inline_text(items, legacy_item)
                    else:
                        items.append(legacy_item)
            legacy_row.append(items)
        legacy_rows.append(legacy_row)
    return {"type": "table", "rows": legacy_rows}


def _blocks_to_legacy_content(blocks: list[dict[str, Any]] | None, image_exporter: _ImageExporter) -> Any:
    legacy_blocks: list[Any] = []
    for block in blocks or []:
        if not isinstance(block, dict):
            continue
        block_type = str(block.get("type") or "").strip().lower()
        if block_type == "paragraph":
            legacy_blocks.extend(_paragraph_block_to_legacy_blocks(block, image_exporter))
            continue
        if block_type == "table":
            legacy_blocks.append(_table_block_to_legacy_block(block, image_exporter))
            continue

    if not legacy_blocks:
        return ""
    if len(legacy_blocks) == 1:
        only_block = legacy_blocks[0]
        if isinstance(only_block, list):
            if len(only_block) == 1 and isinstance(only_block[0], str):
                return only_block[0]
            return only_block
        return only_block
    return legacy_blocks


def _statement_answer_for_id(answer_map: dict[str, Any] | None, source_id: str, public_id: str) -> Any:
    if not isinstance(answer_map, dict):
        return None
    for key in (source_id, public_id, source_id.lower(), public_id.lower()):
        if key in answer_map:
            return answer_map[key]
    return None


def _single_choice_answer_value(raw_answer: Any, option_labels: list[str]) -> int | None:
    label = str(raw_answer or "").strip().upper()
    try:
        return option_labels.index(label)
    except ValueError:
        return None


def _short_answer_value(raw_answer: Any) -> Any:
    if isinstance(raw_answer, list):
        values = [str(item).strip() for item in raw_answer if str(item).strip()]
        if not values:
            return None
        if len(values) == 1:
            return values[0]
        return values
    text = str(raw_answer or "").strip()
    return text or None


def build_public_exam_json(
    *,
    exam_public_json: dict[str, Any],
    exam_private_json: dict[str, Any],
    output_dir: Path,
    subject: str,
    time_minutes: int,
    slug: str,
    title: str,
) -> dict[str, Any]:
    output_dir = Path(output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    assets = exam_public_json.get("assets") if isinstance(exam_public_json, dict) else {}
    images = assets.get("images") if isinstance(assets, dict) else {}
    image_exporter = _ImageExporter(images if isinstance(images, dict) else {}, output_dir)

    parts_out: list[dict[str, Any]] = []
    answer_key_out: dict[str, Any] = {}

    parts_in = exam_public_json.get("parts") or []
    private_answer_key = exam_private_json.get("answer_key") or {}

    for part_index, part in enumerate(parts_in):
        if not isinstance(part, dict):
            continue
        part_id = f"part{part_index + 1}"
        question_type = _normalize_question_type(part.get("type"))
        questions_in = part.get("questions") or []
        part_out_questions: list[dict[str, Any]] = []

        for question_index, question in enumerate(questions_in):
            if not isinstance(question, dict):
                continue

            public_question_id = f"q{question_index + 1}"
            composite_key = f"{part_id}.{public_question_id}"
            source_private_key = str(question.get("id") or composite_key)
            source_question_type = _normalize_question_type(question.get("type") or question_type)
            stem_content = _blocks_to_legacy_content(question.get("stem_blocks"), image_exporter)

            public_question: dict[str, Any] = {
                "id": public_question_id,
                "type": "true_false" if source_question_type == "true_false_group" else source_question_type,
                "content": stem_content,
                "points": _question_points(source_question_type, subject),
            }

            raw_private_answer = private_answer_key.get(source_private_key)

            if source_question_type == "single_choice":
                options_out: list[Any] = []
                option_labels: list[str] = []
                for option_index, choice in enumerate(question.get("choices") or []):
                    if not isinstance(choice, dict):
                        continue
                    option_label = str(choice.get("id") or chr(65 + option_index)).strip().upper()
                    option_labels.append(option_label)
                    options_out.append(_blocks_to_legacy_content(choice.get("content_blocks"), image_exporter))
                public_question["options"] = options_out
                selected_index = _single_choice_answer_value(raw_private_answer, option_labels)
                public_question["correct_answer"] = selected_index
                answer_key_out[composite_key] = selected_index

            elif source_question_type == "true_false_group":
                statements_out: list[dict[str, Any]] = []
                answer_map: dict[str, Any] = {}
                for statement_index, statement in enumerate(question.get("statements") or []):
                    if not isinstance(statement, dict):
                        continue
                    source_statement_id = str(
                        statement.get("id") or chr(97 + statement_index)
                    ).strip()
                    public_statement_id = f"q{question_index + 1}{chr(97 + statement_index)}"
                    correct_value = _statement_answer_for_id(raw_private_answer, source_statement_id, public_statement_id)
                    answer_map[public_statement_id] = correct_value if correct_value in {True, False} else None
                    statements_out.append(
                        {
                            "id": public_statement_id,
                            "content": _blocks_to_legacy_content(statement.get("content_blocks"), image_exporter),
                            "correct": correct_value if correct_value in {True, False} else None,
                        }
                    )
                public_question["statements"] = statements_out
                answer_key_out[composite_key] = answer_map

            else:
                public_answer = _short_answer_value(raw_private_answer)
                public_question["correct_answer"] = public_answer
                answer_key_out[composite_key] = public_answer

            part_out_questions.append(public_question)

        part_out = {
            "id": part_id,
            "name": str(part.get("name") or f"PHẦN {part_index + 1}"),
            "description": _part_description(question_type, len(part_out_questions)),
            "questions": part_out_questions,
        }
        parts_out.append(part_out)

    return {
        "id": slug,
        "title": title,
        "subject": subject,
        "time": int(time_minutes),
        "description": None,
        "resources": dict(LEGACY_RESOURCE_TEMPLATE),
        "answer_key": answer_key_out,
        "parts": parts_out,
    }


def write_public_exam_package(
    *,
    exam_public_json: dict[str, Any],
    exam_private_json: dict[str, Any],
    output_dir: Path,
    subject: str,
    time_minutes: int,
    slug: str,
    title: str,
) -> dict[str, Any]:
    payload = build_public_exam_json(
        exam_public_json=exam_public_json,
        exam_private_json=exam_private_json,
        output_dir=output_dir,
        subject=subject,
        time_minutes=time_minutes,
        slug=slug,
        title=title,
    )
    exam_json_path = Path(output_dir).resolve() / "exam.json"
    exam_json_path.write_text(
        __import__("json").dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return payload
