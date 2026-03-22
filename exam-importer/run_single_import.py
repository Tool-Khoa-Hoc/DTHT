from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.import_pipeline import run_import_pipeline


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run the exam import pipeline for a single DOCX file and export raw/json outputs."
    )
    parser.add_argument(
        "docx_path",
        help="Path to the input .docx file, or a directory/current dot to auto-pick a single .docx inside it",
    )
    parser.add_argument(
        "--out-dir",
        default=str(ROOT / "out" / "single-import"),
        help="Directory to write output files",
    )
    parser.add_argument(
        "--title",
        default=None,
        help="Optional exam title override",
    )
    parser.add_argument(
        "--max-chunk-chars",
        type=int,
        default=6000,
        help="Chunk size used by the pipeline",
    )
    return parser


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")
        except Exception:
            pass

    parser = build_parser()
    args = parser.parse_args()

    docx_path = Path(args.docx_path).resolve()
    if docx_path.is_dir():
        matches = sorted(docx_path.glob("*.docx"))
        if len(matches) != 1:
            parser.error(f"Expected exactly 1 .docx in directory, found {len(matches)}: {docx_path}")
        docx_path = matches[0]
    if not docx_path.exists():
        parser.error(f"DOCX not found: {docx_path}")

    slug = docx_path.stem
    out_dir = Path(args.out_dir).resolve() / slug
    asset_dir = out_dir / "assets"
    out_dir.mkdir(parents=True, exist_ok=True)

    result = run_import_pipeline(
        docx_path=docx_path,
        asset_dir=asset_dir,
        title=args.title or docx_path.stem,
        max_chunk_chars=args.max_chunk_chars,
    )

    (out_dir / "full_raw_markup.txt").write_text(result.full_raw_markup, encoding="utf-8")
    (out_dir / "raw_markup_chunks.json").write_text(
        json.dumps(result.raw_markup_chunks, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (out_dir / "exam_public.json").write_text(
        json.dumps(result.exam_public_json, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (out_dir / "exam_private.json").write_text(
        json.dumps(result.exam_private_json, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (out_dir / "validation.json").write_text(
        json.dumps(
            {
                "errors": result.validation.errors,
                "warnings": result.validation.warnings,
                "stats": result.validation.stats,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    print(f"Input DOCX: {docx_path}")
    print(f"Output dir: {out_dir}")
    print(f"Raw markup: {out_dir / 'full_raw_markup.txt'}")
    print(f"Public JSON: {out_dir / 'exam_public.json'}")
    print(f"Private JSON: {out_dir / 'exam_private.json'}")
    print(f"Validation: {out_dir / 'validation.json'}")
    print(
        "Validation summary:",
        json.dumps(
            {
                "errors": len(result.validation.errors),
                "warnings": len(result.validation.warnings),
                "stats": result.validation.stats,
            },
            ensure_ascii=False,
        ),
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
