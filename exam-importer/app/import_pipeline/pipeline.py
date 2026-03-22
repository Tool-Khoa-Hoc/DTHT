from __future__ import annotations

from pathlib import Path

from .chunker import build_question_boundary_chunks
from .extractor import extract_word_data
from .normalizer import normalize_full_raw_markup, normalize_raw_markup_chunk
from .parser import parse_full_raw_markup
from .types import ImportPipelineResult
from .validator import validate_pipeline_output


def run_import_pipeline(
    *,
    docx_path: Path,
    asset_dir: Path,
    title: str = "Imported exam",
    max_chunk_chars: int = 6000,
) -> ImportPipelineResult:
    extracted = extract_word_data(docx_path=docx_path, asset_dir=asset_dir)
    chunks = build_question_boundary_chunks(extracted, max_chunk_chars=max_chunk_chars)
    raw_markup_chunks = [normalize_raw_markup_chunk(chunk.raw_markup_input) for chunk in chunks]
    full_raw_markup = normalize_full_raw_markup(raw_markup_chunks)

    parsed = parse_full_raw_markup(full_raw_markup, title=title)
    parsed.exam_public_json["assets"] = {
        "images": extracted.assets.get("images", {}),
        "math": extracted.assets.get("math", {}),
    }

    validation = validate_pipeline_output(
        extracted_word_data=extracted,
        full_raw_markup=full_raw_markup,
        exam_public_json=parsed.exam_public_json,
        exam_private_json=parsed.exam_private_json,
    )

    return ImportPipelineResult(
        extracted_word_data=extracted,
        chunked_input=chunks,
        raw_markup_chunks=raw_markup_chunks,
        full_raw_markup=full_raw_markup,
        exam_public_json=parsed.exam_public_json,
        exam_private_json=parsed.exam_private_json,
        validation=validation,
        asset_dir=asset_dir,
    )
