from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass(slots=True)
class ExtractedWordData:
    raw_markup_input: str
    lines: list[str]
    assets: dict[str, dict[str, Any]] = field(default_factory=lambda: {"images": {}, "math": {}})
    source_path: Path | None = None
    meta: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class ChunkedInput:
    id: str
    raw_markup_input: str
    line_start: int = 0
    line_end: int = 0


@dataclass(slots=True)
class ParseResult:
    exam_public_json: dict[str, Any]
    exam_private_json: dict[str, Any]


@dataclass(slots=True)
class ValidationReport:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    stats: dict[str, Any] = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return not self.errors


@dataclass(slots=True)
class ImportPipelineResult:
    extracted_word_data: ExtractedWordData
    chunked_input: list[ChunkedInput]
    raw_markup_chunks: list[str]
    full_raw_markup: str
    exam_public_json: dict[str, Any]
    exam_private_json: dict[str, Any]
    validation: ValidationReport
    asset_dir: Path
