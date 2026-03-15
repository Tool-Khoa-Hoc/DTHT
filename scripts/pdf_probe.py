from __future__ import annotations

import argparse
import importlib
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
VENDOR_DIR = PROJECT_ROOT / ".vendor"

if VENDOR_DIR.exists():
    sys.path.insert(0, str(VENDOR_DIR))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

def try_import(name: str):
    try:
        module = importlib.import_module(name)
        print(f"[ok] import {name}: {getattr(module, '__file__', 'built-in')}")
        return module
    except Exception as exc:  # pragma: no cover - diagnostics script
        print(f"[fail] import {name}: {exc}")
        return None


def probe_pdf(pdf_path: Path, out_dir: Path | None, page_limit: int = 4):
    pymupdf = try_import("pymupdf")
    fitz = try_import("fitz") if pymupdf is None else pymupdf
    if fitz is None:
        return 1

    try:
        doc = fitz.open(str(pdf_path))
    except Exception as exc:
        print(f"[fail] open pdf: {exc}")
        return 1

    print(f"[ok] pages={doc.page_count}")

    for page_index in range(min(page_limit, doc.page_count)):
        page = doc.load_page(page_index)
        print(f"\n--- page {page_index + 1} text ---")
        try:
            text = page.get_text("text")
        except Exception as exc:
            print(f"[fail] extract text page {page_index + 1}: {exc}")
            continue

        print(text[:4000] if text else "[empty]")

        if out_dir is not None:
            out_dir.mkdir(parents=True, exist_ok=True)
            image_path = out_dir / f"page-{page_index + 1}.png"
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
            pix.save(str(image_path))
            print(f"[ok] rendered {image_path}")

    return 0


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf_path", nargs="?")
    parser.add_argument("--out-dir")
    parser.add_argument("--page-limit", type=int, default=4)
    args = parser.parse_args()

    default_pdf = Path("D:/\u0111\u1ec1 thi/de-thi-thu-tot-nghiep-thpt-2026-mon-toan-lan-1-so-gddt-son-la-pages-1.pdf")
    pdf_path = Path(args.pdf_path) if args.pdf_path else default_pdf
    out_dir = Path(args.out_dir) if args.out_dir else None
    if out_dir is not None:
        out_dir.mkdir(parents=True, exist_ok=True)
    sys.exit(probe_pdf(pdf_path, out_dir, args.page_limit))


if __name__ == "__main__":
    main()
