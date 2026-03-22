from __future__ import annotations

import hashlib
import mimetypes
import posixpath
import re
import struct
import zipfile
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET

from .types import ExtractedWordData


W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
M_NS = "http://schemas.openxmlformats.org/officeDocument/2006/math"
V_NS = "urn:schemas-microsoft-com:vml"
O_NS = "urn:schemas-microsoft-com:office:office"
REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"

NS = {"w": W_NS, "r": R_NS, "a": A_NS, "m": M_NS, "v": V_NS, "o": O_NS, "pr": REL_NS}

W_P = f"{{{W_NS}}}p"
W_TBL = f"{{{W_NS}}}tbl"
W_TR = f"{{{W_NS}}}tr"
W_TC = f"{{{W_NS}}}tc"
W_R = f"{{{W_NS}}}r"
W_T = f"{{{W_NS}}}t"
W_TAB = f"{{{W_NS}}}tab"
W_BR = f"{{{W_NS}}}br"
W_CR = f"{{{W_NS}}}cr"
W_RPR = f"{{{W_NS}}}rPr"
W_B = f"{{{W_NS}}}b"
W_I = f"{{{W_NS}}}i"
W_VERT_ALIGN = f"{{{W_NS}}}vertAlign"
W_VAL = f"{{{W_NS}}}val"

A_BLIP = f"{{{A_NS}}}blip"
R_EMBED = f"{{{R_NS}}}embed"
R_ID = f"{{{R_NS}}}id"

CFB_SIGNATURE = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
FREESECT = 0xFFFFFFFF
ENDOFCHAIN = 0xFFFFFFFE
STYLE_PRIORITY = ("b", "i", "sup", "sub")
MATH_PROGID_RE = re.compile(r"(mathtype|equation|dsmt)", re.IGNORECASE)


def _normalize_spacing(text: str) -> str:
    return re.sub(r"[ \t]+", " ", text.replace("\u00a0", " ")).strip()


def _local_name(tag: str | None) -> str:
    if not tag:
        return ""
    if "}" in tag:
        return tag.rsplit("}", 1)[1]
    return tag


def _find_child_local(node: ET.Element | None, name: str) -> ET.Element | None:
    if node is None:
        return None
    for child in list(node):
        if _local_name(child.tag) == name:
            return child
    return None


def _node_val(node: ET.Element | None) -> str:
    if node is None:
        return ""
    return (node.get(f"{{{M_NS}}}val") or node.get("val") or node.get("m:val") or "").strip()


def _wrap_base(base: str) -> str:
    candidate = base.strip()
    if not candidate:
        return ""
    if len(candidate) == 1 or candidate.startswith("\\"):
        return candidate
    return f"{{{candidate}}}"


def _omml_to_latex(node: ET.Element | None) -> str:
    def render(elem: ET.Element | None) -> str:
        if elem is None:
            return ""
        name = _local_name(elem.tag)
        if name == "t":
            return elem.text or ""
        if name in {"oMath", "oMathPara", "r", "e", "num", "den", "sub", "sup", "deg", "sPre", "sSubSupPr"}:
            return "".join(render(child) for child in list(elem))
        if name == "f":
            num = render(_find_child_local(elem, "num"))
            den = render(_find_child_local(elem, "den"))
            return f"\\frac{{{num}}}{{{den}}}"
        if name == "sSup":
            base = render(_find_child_local(elem, "e"))
            sup = render(_find_child_local(elem, "sup"))
            return f"{_wrap_base(base)}^{{{sup}}}"
        if name == "sSub":
            base = render(_find_child_local(elem, "e"))
            sub = render(_find_child_local(elem, "sub"))
            return f"{_wrap_base(base)}_{{{sub}}}"
        if name == "sSubSup":
            base = render(_find_child_local(elem, "e"))
            sub = render(_find_child_local(elem, "sub"))
            sup = render(_find_child_local(elem, "sup"))
            return f"{_wrap_base(base)}_{{{sub}}}^{{{sup}}}"
        if name == "rad":
            base = render(_find_child_local(elem, "e"))
            deg = render(_find_child_local(elem, "deg"))
            if deg:
                return f"\\sqrt[{deg}]{{{base}}}"
            return f"\\sqrt{{{base}}}"
        if name == "d":
            dpr = _find_child_local(elem, "dPr")
            beg = _node_val(_find_child_local(dpr, "begChr")) or "("
            end = _node_val(_find_child_local(dpr, "endChr")) or ")"
            body = render(_find_child_local(elem, "e"))
            return f"\\left{beg}{body}\\right{end}"
        if name == "nary":
            nary_pr = _find_child_local(elem, "naryPr")
            op = _node_val(_find_child_local(nary_pr, "chr")) or "\\sum"
            op_map = {"∑": "\\sum", "∏": "\\prod", "∫": "\\int"}
            op_latex = op_map.get(op, op)
            sub = render(_find_child_local(elem, "sub"))
            sup = render(_find_child_local(elem, "sup"))
            body = render(_find_child_local(elem, "e"))
            if sub or sup:
                return f"{op_latex}_{{{sub}}}^{{{sup}}} {body}".strip()
            return f"{op_latex} {body}".strip()
        if name == "func":
            fname = render(_find_child_local(elem, "fName"))
            farg = render(_find_child_local(elem, "e"))
            return f"{fname}{farg}"
        if name == "fName":
            return "".join(render(child) for child in list(elem))
        return "".join(render(child) for child in list(elem))

    latex = re.sub(r"\s+", " ", render(node)).strip()
    return latex or "\\text{}"


def _read_sector(blob: bytes, sector: int, sector_size: int) -> bytes:
    offset = (sector + 1) * sector_size
    return blob[offset : offset + sector_size]


def _iter_chain(start: int, fat: list[int]) -> list[int]:
    out: list[int] = []
    current = start
    seen: set[int] = set()
    while current not in {FREESECT, ENDOFCHAIN} and current >= 0:
        if current in seen or current >= len(fat):
            break
        out.append(current)
        seen.add(current)
        current = fat[current]
    return out


def _read_cfb_stream(blob: bytes, stream_name: str) -> bytes | None:
    if len(blob) < 512 or blob[:8] != CFB_SIGNATURE:
        return None

    sector_shift = struct.unpack_from("<H", blob, 0x1E)[0]
    mini_sector_shift = struct.unpack_from("<H", blob, 0x20)[0]
    sector_size = 1 << sector_shift
    mini_sector_size = 1 << mini_sector_shift
    num_fat = struct.unpack_from("<I", blob, 0x2C)[0]
    first_dir_sector = struct.unpack_from("<I", blob, 0x30)[0]
    mini_cutoff = struct.unpack_from("<I", blob, 0x38)[0]
    first_minifat_sector = struct.unpack_from("<I", blob, 0x3C)[0]
    num_minifat_sectors = struct.unpack_from("<I", blob, 0x40)[0]

    difat = [struct.unpack_from("<I", blob, 0x4C + idx * 4)[0] for idx in range(109)]
    fat_sectors = [sector for sector in difat if sector not in {FREESECT, ENDOFCHAIN}][:num_fat]

    fat: list[int] = []
    for fat_sector in fat_sectors:
        sector = _read_sector(blob, fat_sector, sector_size)
        fat.extend(struct.unpack_from(f"<{sector_size // 4}I", sector))

    minifat: list[int] = []
    if first_minifat_sector not in {FREESECT, ENDOFCHAIN} and num_minifat_sectors:
        for sector_id in _iter_chain(first_minifat_sector, fat)[:num_minifat_sectors]:
            sector = _read_sector(blob, sector_id, sector_size)
            minifat.extend(struct.unpack_from(f"<{sector_size // 4}I", sector))

    dir_bytes = bytearray()
    for sector_id in _iter_chain(first_dir_sector, fat):
        dir_bytes.extend(_read_sector(blob, sector_id, sector_size))

    stream_start: int | None = None
    stream_size = 0
    root_start: int | None = None
    root_size = 0

    for offset in range(0, len(dir_bytes), 128):
        entry = bytes(dir_bytes[offset : offset + 128])
        if len(entry) < 128:
            break
        name_len = struct.unpack_from("<H", entry, 64)[0]
        if name_len < 2:
            continue
        raw_name = entry[: name_len - 2]
        try:
            name = raw_name.decode("utf-16le")
        except UnicodeDecodeError:
            continue
        obj_type = entry[66]
        start_sector = struct.unpack_from("<I", entry, 116)[0]
        size = struct.unpack_from("<I", entry, 120)[0]
        if obj_type == 5 and name == "Root Entry":
            root_start = start_sector
            root_size = size
        if obj_type == 2 and name == stream_name:
            stream_start = start_sector
            stream_size = size

    if stream_start is None:
        return None

    if stream_size >= mini_cutoff:
        out = bytearray()
        for sector_id in _iter_chain(stream_start, fat):
            out.extend(_read_sector(blob, sector_id, sector_size))
            if len(out) >= stream_size:
                break
        return bytes(out[:stream_size])

    if root_start is None:
        return None

    mini_stream = bytearray()
    for sector_id in _iter_chain(root_start, fat):
        mini_stream.extend(_read_sector(blob, sector_id, sector_size))
        if len(mini_stream) >= root_size:
            break
    mini_stream = mini_stream[:root_size]

    out = bytearray()
    for sector_id in _iter_chain(stream_start, minifat):
        start = sector_id * mini_sector_size
        out.extend(mini_stream[start : start + mini_sector_size])
        if len(out) >= stream_size:
            break
    return bytes(out[:stream_size])


def _extract_mtef_candidate(eq_bytes: bytes) -> str:
    chars: list[str] = []
    idx = 0
    length = len(eq_bytes)
    while idx < length - 1:
        current = eq_bytes[idx]
        nxt = eq_bytes[idx + 1]
        if current in {0x81, 0x83, 0x86, 0x88, 0x96} and idx + 2 < length:
            code = eq_bytes[idx + 1] + (eq_bytes[idx + 2] << 8)
            if code == 0x2212:
                chars.append("-")
                idx += 3
                continue
        if current in {0x81, 0x83, 0x88, 0x96} and 32 <= nxt <= 126 and nxt != 34:
            chars.append(chr(nxt))
            idx += 2
            continue
        if current == 0x86:
            if nxt == 0xD7:
                chars.append("×")
                idx += 2
                continue
            if 32 <= nxt <= 126 and nxt != 34:
                chars.append(chr(nxt))
                idx += 2
                continue
            chosen: int | None = None
            for lookahead in range(2, 5):
                if idx + lookahead >= length:
                    break
                probe = eq_bytes[idx + lookahead]
                if 32 <= probe <= 126 and probe != 34:
                    chosen = probe
                    break
            if chosen is not None:
                chars.append(chr(chosen))
                idx += 2
                continue
        idx += 1
    return "".join(chars).strip()


def _format_genotype_side(raw: str) -> str:
    if not raw:
        return ""
    frac_match = re.fullmatch(r"([A-Z]{2,})([a-z]{2,})([A-Za-z]*)", raw)
    if frac_match and len(frac_match.group(1)) == len(frac_match.group(2)):
        head = f"\\dfrac{{{frac_match.group(1)}}}{{{frac_match.group(2)}}}"
        tail = frac_match.group(3)
        return f"{head} {_format_genotype_side(tail)}".strip() if tail else head
    if "X" not in raw and "Y" not in raw:
        return raw

    tokens: list[str] = []
    idx = 0
    while idx < len(raw):
        ch = raw[idx]
        if ch == "X":
            if idx + 1 < len(raw) and raw[idx + 1] in "AaBbCcDdEe":
                tokens.append(f"X^{{{raw[idx + 1]}}}")
                idx += 2
                continue
            tokens.append("X")
            idx += 1
            continue
        if ch == "Y":
            tokens.append("Y")
            idx += 1
            continue
        tail = idx
        while tail < len(raw) and raw[tail] not in {"X", "Y"}:
            tail += 1
        chunk = raw[idx:tail]
        if chunk:
            tokens.append(chunk)
        idx = tail
    return " ".join(tokens)


def _candidate_to_latex(candidate: str) -> str:
    text = candidate.strip()
    if not text:
        return ""
    if text == "%":
        return "\\%"
    if "×" in text:
        parts = [_format_genotype_side(item.strip()) for item in text.split("×")]
        return " \\times ".join(part for part in parts if part)
    return _format_genotype_side(text)


def _extract_math_from_ole(blob: bytes, fallback_id: str) -> tuple[str, str]:
    stream = _read_cfb_stream(blob, "Equation Native")
    if not stream:
        return (f"\\text{{{fallback_id}}}", "ole_placeholder")
    candidate = _extract_mtef_candidate(stream)
    latex = _candidate_to_latex(candidate)
    if latex:
        return (latex, "ole_mtef")
    return (f"\\text{{{fallback_id}}}", "ole_placeholder")


def _normalize_zip_target(rel_target: str) -> str:
    target = rel_target.replace("\\", "/").strip()
    if not target:
        return ""
    candidates = [target]
    if not target.startswith("word/"):
        candidates.append(f"word/{target}")
    if target.startswith("../"):
        candidates.append(target[3:])
    for candidate in candidates:
        normalized = posixpath.normpath(candidate).replace("\\", "/")
        if normalized.startswith("word/"):
            return normalized
    return posixpath.normpath(posixpath.join("word", target)).replace("\\", "/")


def _load_relationships(zf: zipfile.ZipFile) -> dict[str, str]:
    try:
        rel_xml = zf.read("word/_rels/document.xml.rels")
    except KeyError:
        return {}
    root = ET.fromstring(rel_xml)
    rels: dict[str, str] = {}
    for rel in root.findall("pr:Relationship", NS):
        rid = rel.get("Id")
        target = rel.get("Target")
        if rid and target:
            rels[rid] = _normalize_zip_target(target)
    return rels


def _register_math_asset(
    *,
    latex: str,
    source: str,
    math_map: dict[str, dict[str, Any]],
) -> None:
    digest = hashlib.sha1(f"{source}:{latex}".encode("utf-8", errors="ignore")).hexdigest()[:12]
    asset_id = f"math_{digest}"
    math_map.setdefault(asset_id, {"id": asset_id, "math": latex, "source": source})


def _save_image_asset(
    *,
    zf: zipfile.ZipFile,
    rel_target: str,
    asset_dir: Path,
    image_map: dict[str, dict[str, Any]],
) -> str | None:
    normalized_target = _normalize_zip_target(rel_target)
    try:
        payload = zf.read(normalized_target)
    except KeyError:
        return None

    digest = hashlib.sha1(payload).hexdigest()[:12]
    guessed_ext = Path(rel_target).suffix.lower()
    ext = guessed_ext or mimetypes.guess_extension(mimetypes.guess_type(rel_target)[0] or "") or ".bin"
    asset_id = f"img_{digest}"
    if asset_id not in image_map:
        asset_dir.mkdir(parents=True, exist_ok=True)
        target_path = asset_dir / f"{asset_id}{ext}"
        if not target_path.exists():
            target_path.write_bytes(payload)
        image_map[asset_id] = {
            "id": asset_id,
            "filename": target_path.name,
            "path": str(target_path),
            "source": normalized_target,
            "content_type": mimetypes.guess_type(target_path.name)[0],
        }
    return asset_id


def _wrap_text(text: str, marks: list[str]) -> str:
    if not text:
        return ""
    preferred: str | None = None
    for mark in marks:
        if mark in STYLE_PRIORITY:
            preferred = mark
    if not preferred:
        return text
    return f"[!{preferred}:${text}$]"


def _extract_run_marks(run: ET.Element) -> list[str]:
    marks: list[str] = []
    rpr = run.find(W_RPR)
    if rpr is None:
        return marks
    if rpr.find(W_B) is not None:
        marks.append("b")
    if rpr.find(W_I) is not None:
        marks.append("i")
    vert = rpr.find(W_VERT_ALIGN)
    if vert is not None:
        val = (vert.get(W_VAL) or vert.get("val") or "").lower()
        if val == "superscript":
            marks.append("sup")
        elif val == "subscript":
            marks.append("sub")
    return marks


def _extract_math_tokens(
    element: ET.Element,
    *,
    zf: zipfile.ZipFile,
    rels: dict[str, str],
    math_map: dict[str, dict[str, Any]],
) -> list[str]:
    tokens: list[str] = []

    if element.tag in {f"{{{M_NS}}}oMath", f"{{{M_NS}}}oMathPara"}:
        latex = _omml_to_latex(element)
        _register_math_asset(latex=latex, source="omml", math_map=math_map)
        return [f"[math:${latex}$]"]

    for omath in element.findall(".//m:oMath", NS) + element.findall(".//m:oMathPara", NS):
        latex = _omml_to_latex(omath)
        _register_math_asset(latex=latex, source="omml", math_map=math_map)
        tokens.append(f"[math:${latex}$]")

    if tokens:
        return tokens

    for ole in element.findall(".//o:OLEObject", NS):
        rid = ole.get(R_ID) or ole.get("id") or ole.get("r:id")
        prog_id = ole.get("ProgID") or ""
        if prog_id and not MATH_PROGID_RE.search(prog_id):
            continue
        rel_target = rels.get(rid or "")
        if not rel_target:
            continue
        try:
            payload = zf.read(rel_target)
        except KeyError:
            continue
        fallback_id = f"mathtype_{hashlib.sha1(payload).hexdigest()[:12]}"
        latex, source = _extract_math_from_ole(payload, fallback_id)
        _register_math_asset(latex=latex, source=source, math_map=math_map)
        tokens.append(f"[math:${latex}$]")
    return tokens


def _extract_image_tokens(
    element: ET.Element,
    *,
    zf: zipfile.ZipFile,
    rels: dict[str, str],
    asset_dir: Path,
    image_map: dict[str, dict[str, Any]],
) -> list[str]:
    tokens: list[str] = []
    for blip in element.findall(f".//{A_BLIP}"):
        rid = blip.get(R_EMBED)
        rel_target = rels.get(rid or "")
        if not rel_target:
            continue
        asset_id = _save_image_asset(
            zf=zf,
            rel_target=rel_target,
            asset_dir=asset_dir,
            image_map=image_map,
        )
        if asset_id:
            tokens.append(f"[img:${asset_id}$]")

    for imagedata in element.findall(".//v:imagedata", NS):
        rid = imagedata.get(R_ID) or imagedata.get("id") or imagedata.get("r:id")
        rel_target = rels.get(rid or "")
        if not rel_target:
            continue
        asset_id = _save_image_asset(
            zf=zf,
            rel_target=rel_target,
            asset_dir=asset_dir,
            image_map=image_map,
        )
        if asset_id:
            tokens.append(f"[img:${asset_id}$]")
    return tokens


def _render_run(
    run: ET.Element,
    *,
    zf: zipfile.ZipFile,
    rels: dict[str, str],
    asset_dir: Path,
    image_map: dict[str, dict[str, Any]],
    math_map: dict[str, dict[str, Any]],
) -> str:
    parts: list[str] = []
    marks = _extract_run_marks(run)
    text_buffer: list[str] = []

    def flush_text() -> None:
        if not text_buffer:
            return
        text = "".join(text_buffer)
        text_buffer.clear()
        if text:
            parts.append(_wrap_text(text, marks))

    for child in list(run):
        tag = child.tag
        if tag == W_T:
            text_buffer.append(child.text or "")
            continue
        if tag == W_TAB:
            text_buffer.append(" ")
            continue
        if tag in {W_BR, W_CR}:
            text_buffer.append("\n")
            continue

        math_tokens = _extract_math_tokens(child, zf=zf, rels=rels, math_map=math_map)
        if math_tokens:
            flush_text()
            parts.extend(math_tokens)
            continue

        image_tokens = _extract_image_tokens(
            child,
            zf=zf,
            rels=rels,
            asset_dir=asset_dir,
            image_map=image_map,
        )
        if image_tokens:
            flush_text()
            parts.extend(image_tokens)

    flush_text()
    return "".join(parts)


def _render_paragraph_node(
    node: ET.Element,
    *,
    zf: zipfile.ZipFile,
    rels: dict[str, str],
    asset_dir: Path,
    image_map: dict[str, dict[str, Any]],
    math_map: dict[str, dict[str, Any]],
) -> list[str]:
    if node.tag == W_R:
        rendered = _render_run(
            node,
            zf=zf,
            rels=rels,
            asset_dir=asset_dir,
            image_map=image_map,
            math_map=math_map,
        )
        return [rendered] if rendered else []

    math_tokens = _extract_math_tokens(node, zf=zf, rels=rels, math_map=math_map)
    if math_tokens:
        return math_tokens

    image_tokens = _extract_image_tokens(
        node,
        zf=zf,
        rels=rels,
        asset_dir=asset_dir,
        image_map=image_map,
    )
    if image_tokens:
        return image_tokens

    parts: list[str] = []
    for child in list(node):
        parts.extend(
            _render_paragraph_node(
                child,
                zf=zf,
                rels=rels,
                asset_dir=asset_dir,
                image_map=image_map,
                math_map=math_map,
            )
        )
    return parts


def _render_paragraph(
    paragraph: ET.Element,
    *,
    zf: zipfile.ZipFile,
    rels: dict[str, str],
    asset_dir: Path,
    image_map: dict[str, dict[str, Any]],
    math_map: dict[str, dict[str, Any]],
) -> list[str]:
    rendered = "".join(
        part
        for child in list(paragraph)
        for part in _render_paragraph_node(
            child,
            zf=zf,
            rels=rels,
            asset_dir=asset_dir,
            image_map=image_map,
            math_map=math_map,
        )
    )
    if not rendered.strip():
        return []
    lines: list[str] = []
    for chunk in rendered.splitlines():
        cleaned = _normalize_spacing(chunk)
        if cleaned:
            lines.append(cleaned)
    return lines


def _render_cell(
    cell: ET.Element,
    *,
    zf: zipfile.ZipFile,
    rels: dict[str, str],
    asset_dir: Path,
    image_map: dict[str, dict[str, Any]],
    math_map: dict[str, dict[str, Any]],
) -> str:
    cell_lines: list[str] = []
    for paragraph in cell.findall(f"./{W_P}"):
        cell_lines.extend(
            _render_paragraph(
                paragraph,
                zf=zf,
                rels=rels,
                asset_dir=asset_dir,
                image_map=image_map,
                math_map=math_map,
            )
        )
    return " [br] ".join(line for line in (_normalize_spacing(item) for item in cell_lines) if line)


def _render_table(
    table: ET.Element,
    *,
    zf: zipfile.ZipFile,
    rels: dict[str, str],
    asset_dir: Path,
    image_map: dict[str, dict[str, Any]],
    math_map: dict[str, dict[str, Any]],
) -> list[str]:
    rows: list[str] = []
    for row in table.findall(f"./{W_TR}"):
        cells = [
            _render_cell(
                cell,
                zf=zf,
                rels=rels,
                asset_dir=asset_dir,
                image_map=image_map,
                math_map=math_map,
            )
            for cell in row.findall(f"./{W_TC}")
        ]
        if any(cells):
            rows.append(f"[* {' | '.join(cells)} *]")
    return rows


def extract_word_data(*, docx_path: Path, asset_dir: Path) -> ExtractedWordData:
    docx_path = Path(docx_path)
    with zipfile.ZipFile(docx_path) as zf:
        document_xml = zf.read("word/document.xml")
        rels = _load_relationships(zf)
        root = ET.fromstring(document_xml)
        body = root.find("w:body", NS)
        if body is None:
            return ExtractedWordData(
                raw_markup_input="",
                lines=[],
                assets={"images": {}, "math": {}},
                source_path=docx_path,
            )

        image_map: dict[str, dict[str, Any]] = {}
        math_map: dict[str, dict[str, Any]] = {}
        lines: list[str] = []

        for child in list(body):
            if child.tag == W_P:
                lines.extend(
                    _render_paragraph(
                        child,
                        zf=zf,
                        rels=rels,
                        asset_dir=asset_dir,
                        image_map=image_map,
                        math_map=math_map,
                    )
                )
            elif child.tag == W_TBL:
                lines.extend(
                    _render_table(
                        child,
                        zf=zf,
                        rels=rels,
                        asset_dir=asset_dir,
                        image_map=image_map,
                        math_map=math_map,
                    )
                )

        raw_markup = "\n".join(lines).strip()
        return ExtractedWordData(
            raw_markup_input=raw_markup,
            lines=lines,
            assets={"images": image_map, "math": math_map},
            source_path=docx_path,
        )
