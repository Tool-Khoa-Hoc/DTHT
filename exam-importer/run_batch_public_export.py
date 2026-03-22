from __future__ import annotations

import argparse
import json
import shutil
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.doc_conversion import convert_doc_to_docx
from app.import_pipeline import run_import_pipeline
from app.public_exam_export import normalize_slug, write_public_exam_package

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Batch import Word exam files and export public exam.json folders."
    )
    parser.add_argument("input_dir", help="Directory containing .docx/.doc files.")
    parser.add_argument(
        "output_dir",
        nargs="?",
        help=(
            "Directory to write exported exam folders. "
            "Defaults to a sibling folder named from the input directory parent."
        ),
    )
    parser.add_argument("--subject", required=True, help="Subject value for all exported exams.")
    parser.add_argument("--time", type=int, required=True, help="Time in minutes for all exported exams.")
    parser.add_argument(
        "--max-chunk-chars",
        type=int,
        default=6000,
        help="Chunk size used by the import pipeline.",
    )
    return parser


def _list_word_files(input_dir: Path) -> list[Path]:
    files = [
        path
        for path in input_dir.rglob("*")
        if path.is_file()
        and path.suffix.lower() in {".docx", ".doc"}
        and not path.name.startswith("~$")
    ]
    return sorted(
        files,
        key=lambda path: (
            str(path.parent).lower(),
            path.name.lower(),
            str(path).lower(),
        ),
    )


def _allocate_slug(base_slug: str, seen: dict[str, int]) -> str:
    current = seen.get(base_slug, 0) + 1
    seen[base_slug] = current
    if current == 1:
        return base_slug
    return f"{base_slug}-{current}"


def _write_batch_report(output_dir: Path, report: dict[str, object]) -> None:
    report_path = output_dir / "batch_report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")


def _looks_like_numbered_exam_folder(path: Path) -> bool:
    return bool(re.match(r"^\d+(?:-.*)?$", normalize_slug(path.name)))


def _find_collection_exam_folder(input_dir: Path) -> Path | None:
    for candidate in [input_dir, *input_dir.parents]:
        if candidate.parent == candidate or not _looks_like_numbered_exam_folder(candidate):
            continue
        try:
            sibling_dirs = [path for path in candidate.parent.iterdir() if path.is_dir()]
        except OSError:
            continue
        sibling_match_count = sum(1 for path in sibling_dirs if _looks_like_numbered_exam_folder(path))
        if sibling_match_count >= 2:
            return candidate
    return None


def _resolve_export_dir_name(input_dir: Path) -> str:
    collection_exam_dir = _find_collection_exam_folder(input_dir)
    if collection_exam_dir is not None:
        return normalize_slug(collection_exam_dir.name)

    input_slug = normalize_slug(input_dir.name)
    if "de-goc" in input_slug and input_dir.parent != input_dir:
        parent_slug = normalize_slug(input_dir.parent.name)
        if parent_slug:
            return parent_slug
    return input_slug


def _resolve_exam_group_dir(source_path: Path, input_dir: Path) -> Path:
    collection_exam_dir = _find_collection_exam_folder(source_path.parent)
    if collection_exam_dir is not None:
        return collection_exam_dir
    return source_path.parent if source_path.parent != input_dir else input_dir


def _select_word_files(input_dir: Path) -> list[tuple[Path, Path]]:
    first_file_by_group: dict[Path, Path] = {}
    for source_path in _list_word_files(input_dir):
        group_dir = _resolve_exam_group_dir(source_path, input_dir)
        first_file_by_group.setdefault(group_dir, source_path)
    return sorted(
        first_file_by_group.items(),
        key=lambda item: (
            str(item[0]).lower(),
            item[1].name.lower(),
            str(item[1]).lower(),
        ),
    )


def _resolve_output_dir(input_dir: Path, output_dir_arg: str | None) -> Path:
    if output_dir_arg:
        return Path(output_dir_arg).resolve()

    export_dir_name = _resolve_export_dir_name(input_dir)
    return (input_dir.parent / export_dir_name).resolve()


def main(argv: list[str] | None = None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")
        except Exception:
            pass

    parser = build_parser()
    args = parser.parse_args(argv)

    input_dir = Path(args.input_dir).resolve()
    if not input_dir.exists() or not input_dir.is_dir():
        parser.error(f"Input directory not found: {input_dir}")
    selected_files = _select_word_files(input_dir)
    if not selected_files:
        parser.error(f"No .docx or .doc files found in: {input_dir}")

    output_dir = _resolve_output_dir(input_dir, args.output_dir)

    output_dir.mkdir(parents=True, exist_ok=True)
    temp_root_dir = output_dir / "._tmp"
    temp_root_dir.mkdir(parents=True, exist_ok=True)

    seen_slugs: dict[str, int] = {}
    report_items: list[dict[str, object]] = []
    success_count = 0
    failure_count = 0

    single_export_dir = args.output_dir is None and len(selected_files) == 1

    for group_dir, source_path in selected_files:
        title = source_path.stem
        slug_base = output_dir.name if single_export_dir else normalize_slug(group_dir.name)
        slug = _allocate_slug(slug_base, seen_slugs)
        exam_output_dir = output_dir if single_export_dir else output_dir / slug
        if exam_output_dir.exists():
            shutil.rmtree(exam_output_dir, ignore_errors=True)
        exam_output_dir.mkdir(parents=True, exist_ok=True)

        report_item: dict[str, object] = {
            "source_file": str(source_path),
            "source_group_dir": str(group_dir),
            "status": "failed",
            "slug": slug,
            "title": title,
            "output_dir": str(exam_output_dir),
            "converted_from_doc": source_path.suffix.lower() == ".doc",
        }

        try:
            temp_root = temp_root_dir / f"exam-batch-{uuid.uuid4().hex}"
            temp_root.mkdir(parents=True, exist_ok=True)
            try:
                pipeline_docx_path = source_path
                if source_path.suffix.lower() == ".doc":
                    pipeline_docx_path = convert_doc_to_docx(source_path, temp_root / "converted")
                    report_item["converted_docx"] = str(pipeline_docx_path)

                result = run_import_pipeline(
                    docx_path=pipeline_docx_path,
                    asset_dir=temp_root / "assets",
                    title=title,
                    max_chunk_chars=args.max_chunk_chars,
                )

                payload = write_public_exam_package(
                    exam_public_json=result.exam_public_json,
                    exam_private_json=result.exam_private_json,
                    output_dir=exam_output_dir,
                    subject=args.subject,
                    time_minutes=args.time,
                    slug=slug,
                    title=title,
                )

                report_item["status"] = "success"
                report_item["question_count"] = sum(
                    len(part.get("questions", [])) for part in payload.get("parts", [])
                )
                report_item["validation"] = {
                    "errors": list(result.validation.errors),
                    "warnings": list(result.validation.warnings),
                    "stats": dict(result.validation.stats),
                }
                success_count += 1
            finally:
                shutil.rmtree(temp_root, ignore_errors=True)
        except Exception as exc:
            failure_count += 1
            shutil.rmtree(exam_output_dir, ignore_errors=True)
            report_item["error"] = str(exc)

        report_items.append(report_item)

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "input_dir": str(input_dir),
        "output_dir": str(output_dir),
        "subject": args.subject,
        "time": int(args.time),
        "summary": {
            "total_files": len(selected_files),
            "success_count": success_count,
            "failure_count": failure_count,
        },
        "files": report_items,
    }
    _write_batch_report(output_dir, report)
    shutil.rmtree(temp_root_dir, ignore_errors=True)

    print(f"Input dir: {input_dir}")
    print(f"Output dir: {output_dir}")
    print(f"Files processed: {len(selected_files)}")
    print(f"Success: {success_count}")
    print(f"Failed: {failure_count}")
    print(f"Batch report: {output_dir / 'batch_report.json'}")
    return 1 if failure_count else 0


if __name__ == "__main__":
    raise SystemExit(main())
