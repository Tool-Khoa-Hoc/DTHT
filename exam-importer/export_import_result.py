from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.import_pipeline import run_import_pipeline


def _to_jsonable(value: Any) -> Any:
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, dict):
        return {str(key): _to_jsonable(val) for key, val in value.items()}
    if isinstance(value, list):
        return [_to_jsonable(item) for item in value]
    if isinstance(value, tuple):
        return [_to_jsonable(item) for item in value]
    return value


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Export Python import-pipeline result as a single JSON blob.")
    parser.add_argument("docx_path", help="Path to the input DOCX file.")
    parser.add_argument("--asset-dir", required=True, help="Directory to write extracted assets.")
    parser.add_argument("--title", default=None, help="Optional title override.")
    parser.add_argument("--max-chunk-chars", type=int, default=6000, help="Chunk size used by the pipeline.")
    return parser


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")
        except Exception:
            pass

    args = build_parser().parse_args()
    docx_path = Path(args.docx_path).resolve()
    asset_dir = Path(args.asset_dir).resolve()
    asset_dir.mkdir(parents=True, exist_ok=True)

    result = run_import_pipeline(
        docx_path=docx_path,
        asset_dir=asset_dir,
        title=args.title or docx_path.stem,
        max_chunk_chars=args.max_chunk_chars,
    )

    payload = {
        "full_raw_markup": result.full_raw_markup,
        "exam_public_json": _to_jsonable(result.exam_public_json),
        "exam_private_json": _to_jsonable(result.exam_private_json),
        "validation_report": {
            "errors": list(result.validation.errors),
            "warnings": list(result.validation.warnings),
            "stats": _to_jsonable(result.validation.stats),
        },
    }
    json.dump(payload, sys.stdout, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
