from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
VENDOR_DIR = PROJECT_ROOT / ".vendor"

if VENDOR_DIR.exists():
    sys.path.insert(0, str(VENDOR_DIR))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import pymupdf  # type: ignore


def resolve_path(raw_path: str, base_dir: Path) -> Path:
    path = Path(raw_path)
    return path if path.is_absolute() else (base_dir / path).resolve()


def find_anchor(page, text: str, min_y: float | None = None):
    matches = sorted(page.search_for(text), key=lambda rect: (rect.y0, rect.x0))
    if min_y is not None:
        matches = [rect for rect in matches if rect.y0 >= min_y - 1]

    if not matches:
        raise ValueError(f'Could not find anchor "{text}" on page {page.number + 1}')

    return matches[0]


def export_crop(doc, spec: dict, output_dir: Path, defaults: dict):
    page = doc.load_page(spec["page"] - 1)
    page_rect = page.rect

    x_margin = spec.get("xMargin", defaults.get("xMargin", 20))
    top_padding = spec.get("topPadding", defaults.get("topPadding", 10))
    bottom_padding = spec.get("bottomPadding", defaults.get("bottomPadding", 10))
    page_bottom_trim = spec.get("pageBottomTrim", defaults.get("pageBottomTrim", 26))
    scale = spec.get("scale", defaults.get("scale", 2))

    start_rect = find_anchor(page, spec["start"], spec.get("startMinY"))
    end_text = spec.get("end")
    end_rect = find_anchor(page, end_text, start_rect.y1) if end_text else None

    x0 = page_rect.x0 + x_margin
    x1 = page_rect.x1 - x_margin
    y0 = max(page_rect.y0, start_rect.y0 - top_padding)
    y1 = (end_rect.y0 - bottom_padding) if end_rect else (page_rect.y1 - page_bottom_trim)
    y1 = min(page_rect.y1, y1)

    if y1 <= y0:
        raise ValueError(f'Invalid crop bounds for "{spec["output"]}" on page {page.number + 1}')

    clip = pymupdf.Rect(x0, y0, x1, y1)
    pixmap = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), clip=clip, alpha=False)

    output_path = output_dir / spec["output"]
    output_path.parent.mkdir(parents=True, exist_ok=True)
    pixmap.save(str(output_path))

    print(
        f'[ok] {output_path.relative_to(PROJECT_ROOT)} '
        f'(page={page.number + 1}, y0={y0:.1f}, y1={y1:.1f})'
    )


def main():
    parser = argparse.ArgumentParser(description="Export question crops from a PDF using text anchors.")
    parser.add_argument("config_path")
    args = parser.parse_args()

    config_path = resolve_path(args.config_path, PROJECT_ROOT)
    config_dir = config_path.parent
    config = json.loads(config_path.read_text(encoding="utf-8"))

    pdf_path = resolve_path(config["pdfPath"], config_dir)
    output_dir = resolve_path(config["outputDir"], PROJECT_ROOT)
    defaults = config.get("defaults", {})

    doc = pymupdf.open(str(pdf_path))
    for question_spec in config.get("questions", []):
        export_crop(doc, question_spec, output_dir, defaults)


if __name__ == "__main__":
    main()
