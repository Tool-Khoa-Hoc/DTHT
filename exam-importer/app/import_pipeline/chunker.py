from __future__ import annotations

import re

from .section_headers import match_section_header
from .types import ChunkedInput, ExtractedWordData


QUESTION_RE = re.compile(r"^\s*(?:Câu|Cau|Question|Q)\s*\d{1,4}\s*[:\.\)\-]", re.IGNORECASE)


def build_question_boundary_chunks(
    extracted: ExtractedWordData,
    *,
    max_chunk_chars: int = 6000,
) -> list[ChunkedInput]:
    lines = [line for line in extracted.lines if str(line).strip()]
    if not lines:
        return []

    chunks: list[ChunkedInput] = []
    current_lines: list[str] = []
    chunk_start = 0

    def flush(line_end: int) -> None:
        nonlocal current_lines, chunk_start
        if not current_lines:
            return
        chunks.append(
            ChunkedInput(
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
        is_boundary = QUESTION_RE.match(line) or match_section_header(line)
        if current_lines and len(candidate) > max_chunk_chars and is_boundary:
            flush(idx)
        current_lines.append(line)

    flush(len(lines))
    return chunks
