"""
lib/raw_extractor.py — Raw Extractor cho dự án Đấu Trường Học Tập
==================================================================
Chuyển đổi file .docx sang Markdown sơ khai, sau đó tùy chọn dùng
Gemini AI để làm sạch và chuẩn hóa nội dung.

Public API:
  convert_to_raw_markdown(docx_path, assets_dir) -> (raw_md: str, image_map: dict)
  clean_with_ai(raw_text, api_key)               -> clean_md: str
  extract(docx_path, assets_dir, use_ai, api_key) -> (clean_md: str, image_map: dict)

Yêu cầu thư viện:
  pip install python-docx lxml google-generativeai
  # OMML→LaTeX (tùy chọn nâng cao): pip install latex2mathml
"""

from __future__ import annotations

import hashlib
import os
import re
import shutil
import sys
import zipfile
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET

# ──────────────────────────────────────────────────────────────
# Optional imports — degrade gracefully
# ──────────────────────────────────────────────────────────────
try:
    from docx import Document
    from docx.oxml.ns import qn
    _HAS_DOCX = True
except ImportError:
    _HAS_DOCX = False

try:
    import google.generativeai as genai
    _HAS_GENAI = True
except ImportError:
    _HAS_GENAI = False

# ──────────────────────────────────────────────────────────────
# OMML Namespace & XSL (built-in fallback)
# ──────────────────────────────────────────────────────────────
_OMML_NS = "http://schemas.openxmlformats.org/officeDocument/2006/math"
_W_NS    = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"

# XSL path for OMML → MathML conversion (Office provides OMML2MML.XSL)
# Fallback: we do a best-effort text extraction from OMML tree
_OMML2MML_XSL = Path(os.environ.get(
    "OMML2MML_XSL",
    r"C:\Program Files\Microsoft Office\root\Office16\OMML2MML.XSL"
))

# ──────────────────────────────────────────────────────────────
# Runtime Prompt (do user cung cấp)
# ──────────────────────────────────────────────────────────────
CLEAN_PROMPT = """\
Bạn là một chuyên gia tiền xử lý dữ liệu giáo dục cho dự án 'Trạm Sinh Viên'. Nhiệm vụ của bạn là chuẩn hóa văn bản thô từ đề thi Word sang định dạng Markdown chất lượng cao.

Các quy tắc bắt buộc:

Chuẩn hóa câu hỏi: Đảm bảo mọi câu hỏi bắt đầu bằng 'Câu X:' (X là số). Sửa các lỗi trích xuất như 'Câu1', 'Cau 1.', 'Q1:' thành định dạng 'Câu 1:'.

Xử lý lựa chọn: Các lựa chọn A, B, C, D phải nằm trên các dòng riêng biệt hoặc cách nhau rõ ràng. Định dạng chuẩn: 'A. [Nội dung]', 'B. [Nội dung]'.

Bảo tồn Assets: Tuyệt đối giữ nguyên các tag ảnh: [img:$asset_id$]. Không được thay đổi mã ID bên trong.

Giữ nguyên công thức toán học trong tag: [math:$latex$]. Nếu thấy công thức bị lỗi hiển thị nhẹ, hãy cố gắng đưa về định dạng LaTeX chuẩn.

Cấu trúc Bảng: Chuyển đổi các khối văn bản có dạng bảng [* cell1 | cell2 *] sang bảng Markdown chuẩn. Nếu bảng chứa hình ảnh hoặc công thức, hãy giữ nguyên các tag đó bên trong ô của bảng.

Phân cấp Header: Sử dụng ## cho các phần lớn (ví dụ: ## PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn).

Lọc nhiễu: Loại bỏ hoàn toàn: Trang số, chân trang (footer), tiêu đề lặp lại của sở giáo dục, các ghi chú 'Trang 1/4', 'Mã đề thi...'.

Sửa lỗi dính chữ: Tự động thêm dấu cách vào các từ bị dính nhau do lỗi trích xuất XML (ví dụ: 'nănglượng' -> 'năng lượng').

Yêu cầu đầu ra: Chỉ trả về văn bản Markdown đã làm sạch. Không giải thích, không thêm chữ 'Đây là kết quả'.
"""

# ──────────────────────────────────────────────────────────────
# Internal helpers
# ──────────────────────────────────────────────────────────────

def _file_hash(data: bytes, length: int = 8) -> str:
    """Tạo hash ngắn từ nội dung binary."""
    return hashlib.sha1(data).hexdigest()[:length]


def _extract_images_from_zip(
    docx_path: Path,
    assets_dir: Path,
) -> dict[str, str]:
    """
    Giải nén tất cả ảnh từ file .docx (thực chất là ZIP),
    lưu vào assets_dir, trả về dict: {rId -> asset_id}.
    
    asset_id = <stem>_<hash>.<ext>  (vd: "img_a3f92b1c.png")
    """
    assets_dir.mkdir(parents=True, exist_ok=True)
    rid_to_asset: dict[str, str] = {}
    
    try:
        with zipfile.ZipFile(docx_path, "r") as z:
            # Lấy thông tin relationship từ word/_rels/document.xml.rels
            rels_path = "word/_rels/document.xml.rels"
            if rels_path not in z.namelist():
                return rid_to_asset
            
            rels_xml = z.read(rels_path)
            rels_root = ET.fromstring(rels_xml)
            
            # Build rid → internal media path
            rid_to_target: dict[str, str] = {}
            for rel in rels_root:
                rel_type = rel.get("Type", "")
                if "image" in rel_type:
                    rid  = rel.get("Id", "")
                    tgt  = rel.get("Target", "")  # e.g. "media/image1.png"
                    rid_to_target[rid] = "word/" + tgt
            
            # Extract và lưu từng ảnh
            for rid, zip_path in rid_to_target.items():
                if zip_path not in z.namelist():
                    continue
                data   = z.read(zip_path)
                ext    = Path(zip_path).suffix.lower() or ".png"
                h      = _file_hash(data)
                fname  = f"img_{h}{ext}"
                dest   = assets_dir / fname
                if not dest.exists():
                    dest.write_bytes(data)
                rid_to_asset[rid] = fname
    except Exception as e:
        print(f"[raw_extractor] ⚠ Không thể trích xuất ảnh: {e}", file=sys.stderr)
    
    return rid_to_asset


def _build_rid_lookup(doc) -> dict[str, str]:
    """
    Xây dựng mapping từ rId → asset filename bằng cách đọc
    relationship part của document.
    """
    rels = doc.part.rels
    lookup: dict[str, str] = {}
    for rid, rel in rels.items():
        if "image" in rel.reltype:
            # rel.target_ref là đường dẫn relative như "media/image1.png"
            lookup[rid] = Path(rel.target_ref).name
    return lookup


def _omml_to_latex_text(math_elem) -> str:
    """
    Chuyển đổi phần tử OMML (Office Math) sang LaTeX text.
    
    Phương pháp: Best-effort text extraction từ XML.
    Với môi trường có OMML2MML.XSL, có thể nâng cấp lên chuyển đổi đầy đủ.
    """
    # Thu thập tất cả text trong OMML element
    texts = []
    for elem in math_elem.iter():
        ns = elem.tag.split("}")[0].lstrip("{") if "}" in elem.tag else ""
        local = elem.tag.split("}")[-1]
        
        # Lấy text từ các phần tử chứa nội dung toán
        if local in ("r", "t") and elem.text:
            texts.append(elem.text.strip())
    
    raw = " ".join(t for t in texts if t)
    
    # Nếu chuỗi trống, thử đọc toàn bộ text
    if not raw:
        raw = "".join(math_elem.itertext()).strip()
    
    # Escape cơ bản để đưa vào tag [math:...]
    raw = raw.replace("\n", " ").replace("  ", " ")
    return raw


def _is_enabled_toggle(elem) -> bool:
    """Word toggle element: missing w:val means enabled."""
    if elem is None:
        return False
    val = elem.get(f"{{{_W_NS}}}val")
    if val is None:
        val = elem.get("val")
    if val is None:
        return True
    return str(val).strip().lower() not in {"0", "false", "off", "none"}


def _extract_run_marks(run_elem) -> list[str]:
    """
    Extract rich-text marks from run properties.
    Marker tokens follow existing parser convention: b/i/sup/sub.
    """
    marks: list[str] = []
    rpr = run_elem.find(f"{{{_W_NS}}}rPr")
    if rpr is None:
        return marks

    if _is_enabled_toggle(rpr.find(f"{{{_W_NS}}}b")):
        marks.append("b")
    if _is_enabled_toggle(rpr.find(f"{{{_W_NS}}}i")):
        marks.append("i")

    vert = rpr.find(f"{{{_W_NS}}}vertAlign")
    if vert is not None:
        val = vert.get(f"{{{_W_NS}}}val") or vert.get("val") or ""
        v = str(val).strip().lower()
        if v == "superscript":
            marks.append("sup")
        elif v == "subscript":
            marks.append("sub")

    return marks


def _extract_plain_text_from_run(run_elem) -> str:
    """
    Convert run content into plain text while preserving line-break/tab intent.
    """
    parts: list[str] = []
    for node in run_elem:
        local = node.tag.split("}")[-1] if "}" in node.tag else node.tag
        if local == "t":
            if node.text:
                parts.append(node.text)
            continue
        if local == "tab":
            parts.append(" ")
            continue
        if local in ("br", "cr"):
            parts.append("\n")
            continue

        # Fallback: include nested text nodes in less common wrappers.
        for tnode in node.iter(f"{{{_W_NS}}}t"):
            if tnode.text:
                parts.append(tnode.text)
    return "".join(parts)


def _wrap_run_text_with_marks(text: str, marks: list[str]) -> str:
    """
    Wrap text with parser-compatible rich-text markers.
    Example: [!b:$text$], [!i:$text$], [!sup:$text$], [!sub:$text$]
    """
    if not text or not marks:
        return text

    # Keep raw text if it already contains delimiter used by marker format.
    if "$" in text:
        return text

    wrapped = text
    for mark in marks:
        wrapped = f"[!{mark}:${wrapped}$]"
    return wrapped


def _append_run_content(
    parts: list[str],
    run_elem,
    rid_to_asset: dict[str, str],
) -> None:
    """
    Append converted run content (image/math-safe text + rich-text marks).
    """
    found_drawing = False
    for drawing in run_elem.iter(f"{{{_W_NS}}}drawing"):
        found_drawing = True
        # Tìm blip (embedded image reference)
        for blip in drawing.iter(
            "{http://schemas.openxmlformats.org/drawingml/2006/main}blip"
        ):
            embed = blip.get(
                "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed",
                ""
            )
            if embed and embed in rid_to_asset:
                asset_id = rid_to_asset[embed]
                parts.append(f"[img:{asset_id}]")
        break

    if found_drawing:
        return

    text = _extract_plain_text_from_run(run_elem)
    if not text:
        return
    marks = _extract_run_marks(run_elem)
    parts.append(_wrap_run_text_with_marks(text, marks))


def _para_to_markdown(
    para,
    rid_to_asset: dict[str, str],
) -> str:
    """
    Chuyển 1 paragraph sang Markdown text, xử lý:
      - Ảnh inline → [img:asset_id]
      - OMML / Math → [math:...]
      - Text runs thông thường
    """
    parts: list[str] = []
    
    elem = para._element
    
    for child in elem:
        tag_local = child.tag.split("}")[-1] if "}" in child.tag else child.tag
        
        # ── OMML math ──────────────────────────────────────────
        if child.tag == f"{{{_OMML_NS}}}oMath" or tag_local == "oMath":
            latex = _omml_to_latex_text(child)
            if latex:
                parts.append(f"[math:{latex}]")
            continue
        
        # ── oMathPara (block math) ─────────────────────────────
        if child.tag == f"{{{_OMML_NS}}}oMathPara" or tag_local == "oMathPara":
            for math_child in child:
                if "oMath" in math_child.tag:
                    latex = _omml_to_latex_text(math_child)
                    if latex:
                        parts.append(f"[math:{latex}]")
            continue
        
        # ── Run (w:r) ──────────────────────────────────────────
        if tag_local == "r":
            _append_run_content(parts, child, rid_to_asset)
            continue
        
        # ── Hyperlink (w:hyperlink) ────────────────────────────
        if tag_local == "hyperlink":
            has_run = False
            for link_child in child:
                link_local = (
                    link_child.tag.split("}")[-1]
                    if "}" in link_child.tag else link_child.tag
                )
                if link_local == "r":
                    has_run = True
                    _append_run_content(parts, link_child, rid_to_asset)

            if not has_run:
                text = "".join(
                    t.text or ""
                    for t in child.iter(f"{{{_W_NS}}}t")
                )
                if text:
                    parts.append(text)
            continue
    
    return "".join(parts)


def _table_to_markdown(
    table,
    rid_to_asset: dict[str, str],
) -> str:
    """Chuyển 1 Table object sang Markdown table string, hỗ trợ ảnh/math trong cell."""
    rows: list[list[str]] = []
    for row in table.rows:
        cells: list[str] = []
        for cell in row.cells:
            parts = []
            for para in cell.paragraphs:
                text = _para_to_markdown(para, rid_to_asset)
                if text.strip():
                    parts.append(text.strip())
            cell_text = " ".join(parts).replace("|", "\\|")
            cells.append(cell_text)
        rows.append(cells)
    
    if not rows:
        return ""
    
    # Loại duplicate rows (merged cells tạo ra row giống nhau)
    seen: list[tuple] = []
    unique_rows: list[list[str]] = []
    for row in rows:
        key = tuple(row)
        if key not in seen:
            seen.append(key)
            unique_rows.append(row)
    rows = unique_rows
    
    max_cols = max(len(r) for r in rows)
    rows = [r + [""] * (max_cols - len(r)) for r in rows]
    
    lines = ["| " + " | ".join(rows[0]) + " |"]
    lines.append("| " + " | ".join(["---"] * max_cols) + " |")
    for row in rows[1:]:
        lines.append("| " + " | ".join(row) + " |")
    
    return "\n".join(lines)


# ──────────────────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────────────────

def convert_to_raw_markdown(
    docx_path: Path | str,
    assets_dir: Path | str | None = None,
) -> tuple[str, dict[str, Any]]:
    """
    Trích xuất nội dung file .docx sang Markdown sơ khai.
    
    Args:
        docx_path:  Đường dẫn tới file .docx
        assets_dir: Thư mục lưu ảnh. Mặc định: <thư mục chứa docx>/assets/
    
    Returns:
        (raw_markdown, image_map)
        
        image_map: {
          "img_a3f92b1c.png": {
              "asset_id":  "img_a3f92b1c.png",
              "path":      "/absolute/path/to/assets/img_a3f92b1c.png",
              "source":    "word/_rels/rId5"
          }, ...
        }
    
    Raises:
        ImportError: nếu python-docx chưa được cài
        FileNotFoundError: nếu docx_path không tồn tại
    """
    if not _HAS_DOCX:
        raise ImportError(
            "Thiếu thư viện 'python-docx'. Chạy: pip install python-docx"
        )
    
    docx_path = Path(docx_path)
    if not docx_path.exists():
        raise FileNotFoundError(f"Không tìm thấy file: {docx_path}")
    
    if assets_dir is None:
        assets_dir = docx_path.parent / "assets"
    assets_dir = Path(assets_dir)
    
    # 1. Trích xuất ảnh → assets/
    rid_to_asset = _extract_images_from_zip(docx_path, assets_dir)
    
    # Build image_map (thông tin chi tiết)
    image_map: dict[str, Any] = {}
    for rid, fname in rid_to_asset.items():
        image_map[fname] = {
            "asset_id": fname,
            "path": str(assets_dir / fname),
            "source_rid": rid,
        }
    
    # 2. Đọc document
    doc = Document(str(docx_path))
    
    # Build rid lookup từ docx relationships
    doc_rid_to_asset = _build_rid_lookup(doc)
    # Merge với rid_to_asset (zip extraction)
    combined_rid = {**rid_to_asset}
    for rid, fname in doc_rid_to_asset.items():
        if rid not in combined_rid:
            combined_rid[rid] = fname
    
    # 3. Duyệt body theo thứ tự (paragraph + table)
    output_lines: list[str] = []
    prev_blank = False
    
    body = doc.element.body
    
    # Map element → object
    para_map: dict = {p._element: p for p in doc.paragraphs}
    table_map: dict = {t._element: t for t in doc.tables}
    
    for child in body:
        tag_local = child.tag.split("}")[-1] if "}" in child.tag else child.tag
        
        if tag_local == "p":
            para = para_map.get(child)
            if para is None:
                continue
            
            text = _para_to_markdown(para, combined_rid)
            
            if not text.strip():
                if not prev_blank and output_lines:
                    output_lines.append("")
                    prev_blank = True
                continue
            
            output_lines.append(text)
            prev_blank = False
        
        elif tag_local == "tbl":
            table = table_map.get(child)
            if table is None:
                continue
            
            md_table = _table_to_markdown(table, combined_rid)
            if md_table:
                if output_lines and output_lines[-1] != "":
                    output_lines.append("")
                output_lines.append(md_table)
                output_lines.append("")
                prev_blank = True
        
        # oMathPara ở cấp body (block math)
        elif "oMathPara" in tag_local or "oMath" in tag_local:
            latex = _omml_to_latex_text(child)
            if latex:
                output_lines.append(f"[math:{latex}]")
                prev_blank = False
    
    # Xóa dòng trống cuối
    while output_lines and output_lines[-1] == "":
        output_lines.pop()
    
    raw_md = "\n".join(output_lines)
    return raw_md, image_map


def clean_with_ai(
    raw_text: str,
    api_key: str | None = None,
    model_name: str = "gemini-2.0-flash",
) -> str:
    """
    Gửi raw Markdown lên Gemini API để làm sạch và chuẩn hóa.
    
    Args:
        raw_text:   Văn bản Markdown sơ khai từ convert_to_raw_markdown()
        api_key:    Gemini API key. Nếu None, đọc từ env GEMINI_API_KEY
        model_name: Tên model Gemini (mặc định: gemini-2.0-flash)
    
    Returns:
        Chuỗi Markdown đã làm sạch từ AI.
    
    Raises:
        ImportError:  nếu google-generativeai chưa cài
        ValueError:   nếu không tìm thấy API key
        RuntimeError: nếu Gemini API trả về lỗi
    """
    if not _HAS_GENAI:
        raise ImportError(
            "Thiếu thư viện 'google-generativeai'. "
            "Chạy: pip install google-generativeai"
        )
    
    key = api_key or os.environ.get("GEMINI_API_KEY", "")
    if not key:
        raise ValueError(
            "Không tìm thấy Gemini API key. "
            "Đặt biến môi trường GEMINI_API_KEY hoặc truyền api_key= trực tiếp."
        )
    
    genai.configure(api_key=key)
    model = genai.GenerativeModel(model_name)
    
    full_prompt = CLEAN_PROMPT + "\n\n---\n\n" + raw_text
    
    try:
        response = model.generate_content(full_prompt)
        return response.text.strip()
    except Exception as e:
        raise RuntimeError(f"Gemini API lỗi: {e}") from e


def extract(
    docx_path: Path | str,
    assets_dir: Path | str | None = None,
    use_ai: bool = False,
    api_key: str | None = None,
    model_name: str = "gemini-2.0-flash",
) -> tuple[str, dict[str, Any]]:
    """
    Pipeline hoàn chỉnh: docx → (Markdown, image_map).
    
    Args:
        docx_path:  Đường dẫn file .docx
        assets_dir: Thư mục lưu ảnh (mặc định: <thư mục docx>/assets/)
        use_ai:     Nếu True, gọi Gemini để làm sạch Markdown sau khi extract
        api_key:    Gemini API key (chỉ cần khi use_ai=True)
        model_name: Tên Gemini model
    
    Returns:
        (markdown_text, image_map)
    """
    raw_md, image_map = convert_to_raw_markdown(docx_path, assets_dir)
    
    if use_ai:
        try:
            clean_md = clean_with_ai(raw_md, api_key=api_key, model_name=model_name)
            return clean_md, image_map
        except Exception as e:
            print(f"[raw_extractor] ⚠ AI cleaning thất bại: {e}", file=sys.stderr)
            print("[raw_extractor] → Trả về raw Markdown thay thế.", file=sys.stderr)
    
    return raw_md, image_map


# ──────────────────────────────────────────────────────────────
# CLI shortcut
# ──────────────────────────────────────────────────────────────

def _cli():
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Trích xuất .docx → Markdown (với hoặc không có AI)"
    )
    parser.add_argument("docx", type=Path, help="Đường dẫn file .docx")
    parser.add_argument(
        "--assets", "-a", type=Path, default=None,
        help="Thư mục lưu ảnh (mặc định: <docx_dir>/assets/)"
    )
    parser.add_argument(
        "--ai", action="store_true",
        help="Dùng Gemini AI để làm sạch Markdown"
    )
    parser.add_argument(
        "--key", "-k", default=None,
        help="Gemini API key (hoặc đặt env GEMINI_API_KEY)"
    )
    parser.add_argument(
        "--model", default="gemini-2.0-flash",
        help="Tên Gemini model (mặc định: gemini-2.0-flash)"
    )
    parser.add_argument(
        "--out", "-o", type=Path, default=None,
        help="File output .md (mặc định: in ra console)"
    )
    args = parser.parse_args()
    
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    
    print(f"[raw_extractor] Đang xử lý: {args.docx.name}")
    
    md, image_map = extract(
        docx_path=args.docx,
        assets_dir=args.assets,
        use_ai=args.ai,
        api_key=args.key,
        model_name=args.model,
    )
    
    print(f"[raw_extractor] ✓ Trích xuất {len(image_map)} ảnh")
    if image_map:
        for fname, info in image_map.items():
            print(f"   • {fname} → {info['path']}")
    
    if args.out:
        args.out.write_text(md, encoding="utf-8")
        print(f"[raw_extractor] ✓ Đã ghi: {args.out}")
    else:
        print("\n" + "─" * 60)
        print(md)


if __name__ == "__main__":
    _cli()
