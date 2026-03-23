from __future__ import annotations

import re
from dataclasses import dataclass


SECTION_KEYWORD_RE = r"(?:PHẦN|PHAN|PART)"
SECTION_INDEX_RE = r"(?:IV|III|II|I|[1234])"
SECTION_TRAILER_RE = r"(?=[\s\.\:\)\-]|$)"

# Note: We now use match_section_header logic to filter out false positives
SECTION_HEADER_RE = re.compile(
    rf"^\s*({SECTION_KEYWORD_RE})\s*({SECTION_INDEX_RE}){SECTION_TRAILER_RE}\s*[\.\:\)\-]?\s*(.*)$",
    re.IGNORECASE,
)

_SECTION_INDEX_TO_PART_INDEX = {
    "I": 1,
    "II": 2,
    "III": 3,
    "1": 1,
    "2": 2,
    "3": 3,
}
_PART_INDEX_TO_ROMAN = {1: "I", 2: "II", 3: "III"}


@dataclass(frozen=True, slots=True)
class SectionHeader:
    part_index: int
    raw_index: str
    normalized_index: str
    tail: str


def _coerce_part_index(raw_index: str | None) -> int | None:
    if not raw_index:
        return None
    return _SECTION_INDEX_TO_PART_INDEX.get(raw_index.upper())


def match_section_header(text: str) -> SectionHeader | None:
    match = SECTION_HEADER_RE.match(text or "")
    if not match:
        return None
        
    keyword = match.group(1)
    raw_index = match.group(2)
    tail = match.group(3) or ""
    
    # Strict heuristic for false positives:
    # If the word 'PHẦN' is not completely uppercase, it might be a description like 'Phần 1 ADN'.
    # In that case, the tail MUST be empty or contain exam-related instructions.
    if not keyword.isupper():
        if tail.strip():
            exam_keywords = re.compile(r"(trắc nghiệm|thí sinh|phương án|lựa chọn|câu|điểm|tự luận|trả lời|ngắn|đúng|sai)", re.IGNORECASE)
            if not exam_keywords.search(tail):
                return None
                
    part_index = _coerce_part_index(raw_index)
    if part_index is None:
        return None
    return SectionHeader(
        part_index=part_index,
        raw_index=raw_index,
        normalized_index=_PART_INDEX_TO_ROMAN[part_index],
        tail=match.group(2) or "",
    )


def find_embedded_section_start(text: str) -> int | None:
    return None
