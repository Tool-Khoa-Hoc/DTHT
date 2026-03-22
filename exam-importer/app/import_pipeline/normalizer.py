from __future__ import annotations

import html
import re

from .section_headers import find_embedded_section_start, match_section_header


SPACE_RE = re.compile(r"\s+")
OPTION_LEADING_RE = re.compile(r"^\s*(?:\*?\s*)?([A-D])\s*[\.\):]\s*(.+)$")
OPTION_MARK_RE = re.compile(r"(?:(?<=^)|(?<=\s)|(?<=\]))([A-D])\s*[\.\):]\s*")
TF_LEADING_RE = re.compile(r"^\s*(?:\*?\s*)?([a-d])\s*[\)\.\:-]\s*(.+)$")
TF_MARK_RE = re.compile(r"(?:(?<=^)|(?<=\s)|(?<=\])|(?<=;\s)|(?<=\.\s))([a-d])\s*[\)\.\:-]\s*")
FRACTION_LINE_RE = re.compile(r"^\s*(\d+)\s*/\s*(\d+)\s*$")
TRAILING_FRACTION_RE = re.compile(r"^(.*?\b(\d+)\s*)/\s*$")
QUESTION_RE = re.compile(
    r"^\s*(?:Câu|Cau|Question|Q)\s*(?:số|so|number|no\.?)?\s*\d{1,4}\s*[:\.\)\-]",
    re.IGNORECASE,
)
MARKDOWN_TABLE_RE = re.compile(r"^\s*\|.*\|\s*$")
TABLE_DIVIDER_RE = re.compile(r"^\s*:?-{3,}:?\s*$")
ANSWER_HEADER_RE = re.compile(r"^\s*(?:ĐÁP\s*ÁN|DAP\s*AN|ĐA|ANSWER)\s*$", re.IGNORECASE)
END_HEADER_RE = re.compile(r"^\s*-*\s*HẾT\s*-*\s*$", re.IGNORECASE)
STRUCT_QUESTION_TOKEN_RE = re.compile(r"\[!b:\$\s*Câu\s*(\d{1,4})\s*[\.\):\-]\s*\$\]", re.IGNORECASE)
STRUCT_OPTION_TOKEN_RE = re.compile(r"\[!b:\$\s*([A-D])\s*[\.\):\-]\s*\$\]")
STRUCT_STATEMENT_TOKEN_RE = re.compile(r"\[!b:\$\s*([a-d])\s*[\)\.\:\-]\s*\$\]")
STYLE_TOKEN_BODY_RE = re.compile(r"\[!(?:b|i|sup|sub):\$(.*?)\$\]", re.IGNORECASE | re.DOTALL)
LEGACY_STYLE_BODY_RE = re.compile(r"\[!(?:b|i|sup|sub):([^\]]*)\]", re.IGNORECASE | re.DOTALL)
MATH_TOKEN_RE = re.compile(r"\[(?:!m|math):\$(.*?)\$\]", re.IGNORECASE | re.DOTALL)
IMAGE_TOKEN_RE = re.compile(r"\[img:\$([^\$]+)\$\]", re.IGNORECASE)
def _strip_markup_for_detection(text: str) -> str:
    out = html.unescape(text or "")
    for _ in range(12):
        updated = STYLE_TOKEN_BODY_RE.sub(r"\1", out)
        updated = LEGACY_STYLE_BODY_RE.sub(r"\1", updated)
        if updated == out:
            break
        out = updated
    out = IMAGE_TOKEN_RE.sub(" ", out)
    out = MATH_TOKEN_RE.sub(r"\1", out)
    out = re.sub(r"\[br\]", " ", out, flags=re.IGNORECASE)
    return SPACE_RE.sub(" ", out).strip()


def _find_style_token_end(text: str, start: int) -> int:
    depth = 0
    idx = start
    while idx < len(text):
        if text.startswith("[!", idx):
            depth += 1
            idx += 2
            continue
        if text[idx] == "]":
            depth -= 1
            if depth == 0:
                return idx
        idx += 1
    return -1


def _flatten_style_body(body: str) -> str:
    candidate = html.unescape(body or "").replace("\u200b", "")
    candidate = candidate.replace("<br>", "\n").replace("<br/>", "\n").replace("<br />", "\n")
    if "[!" in candidate:
        candidate = _canonicalize_inline_tokens(candidate)
    candidate = re.sub(r"^\$+", "", candidate)
    candidate = re.sub(r"\$+$", "", candidate)
    for _ in range(12):
        updated = STYLE_TOKEN_BODY_RE.sub(r"\1", candidate)
        updated = LEGACY_STYLE_BODY_RE.sub(r"\1", updated)
        if updated == candidate:
            break
        candidate = updated
    return candidate


def _canonicalize_inline_tokens(text: str) -> str:
    source = html.unescape(text or "")
    out: list[str] = []
    idx = 0
    while idx < len(source):
        if source.startswith("[!m:$", idx):
            end = source.find("$]", idx + 5)
            if end != -1:
                body = source[idx + 5 : end]
                out.append(f"[math:${body.strip()}$]")
                idx = end + 2
                continue
        if source.startswith("[math:$", idx):
            end = source.find("$]", idx + 7)
            if end != -1:
                body = source[idx + 7 : end]
                out.append(f"[math:${body.strip()}$]")
                idx = end + 2
                continue
        if source.startswith("[img:$", idx):
            end = source.find("$]", idx + 6)
            if end != -1:
                body = source[idx + 6 : end]
                out.append(f"[img:${body.strip()}$]")
                idx = end + 2
                continue
        if source.startswith("[!", idx):
            colon = source.find(":", idx + 2)
            if colon != -1:
                style = source[idx + 2 : colon].strip().lower()
                if style in {"b", "i", "sup", "sub"}:
                    end = _find_style_token_end(source, idx)
                    if end != -1:
                        body = _flatten_style_body(source[colon + 1 : end])
                        if body:
                            out.append(f"[!{style}:${body}$]")
                        idx = end + 1
                        continue
        out.append(source[idx])
        idx += 1
    return "".join(out)


def _merge_adjacent_style_tokens(line: str) -> str:
    current = line
    while True:
        updated = re.sub(
            r"\[!(b|i|sup|sub):\$(.*?)\$\]\s*\[!\1:\$(.*?)\$\]",
            lambda match: f"[!{match.group(1).lower()}:${match.group(2)}{match.group(3)}$]",
            current,
            flags=re.IGNORECASE | re.DOTALL,
        )
        if updated == current:
            return updated
        current = updated


def _convert_markdown_tables(raw_markup: str) -> str:
    converted: list[str] = []
    for raw_line in raw_markup.splitlines():
        line = raw_line.rstrip()
        if not MARKDOWN_TABLE_RE.match(line):
            converted.append(line)
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if cells and all(TABLE_DIVIDER_RE.match(cell or "") for cell in cells):
            continue
        converted.append(f"[* {' | '.join(cells)} *]")
    return "\n".join(converted)


def _normalize_fraction_line(line: str) -> str:
    match = FRACTION_LINE_RE.match(line)
    if not match:
        return line
    num, den = match.group(1), match.group(2)
    return f"[math:$\\frac{{{num}}}{{{den}}}$]"


def _split_inline_marks(line: str, mark_re: re.Pattern[str]) -> list[str]:
    marks = list(mark_re.finditer(line))
    if len(marks) < 2:
        return [line]
    chunks: list[str] = []
    for idx, mark in enumerate(marks):
        start = mark.start()
        end = marks[idx + 1].start() if idx + 1 < len(marks) else len(line)
        chunk = line[start:end].strip(" ;")
        if chunk:
            chunks.append(chunk)
    prefix = line[: marks[0].start()].strip()
    if prefix and not QUESTION_RE.match(_strip_markup_for_detection(prefix)):
        return [line]
    return chunks or [line]


def _normalize_option_line(line: str) -> str:
    match = OPTION_LEADING_RE.match(line)
    if not match:
        return line
    label, content = match.group(1).upper(), match.group(2).strip()
    return f"{label}. {content}".strip()


def _normalize_tf_line(line: str) -> str:
    match = TF_LEADING_RE.match(line)
    if not match:
        return line
    label, content = match.group(1).lower(), match.group(2).strip()
    return f"{label}) {content}".strip()


def _split_inline_blocks(line: str) -> list[str]:
    prepared = re.sub(r"\s*(\[\* .*? \*\])\s*", r"\n\1\n", line)
    prepared = re.sub(r"\s*(\[(?:img|math):\$.*?\$\])\s*", r"\n\1\n", prepared)
    return [part.strip() for part in prepared.splitlines() if part.strip()]


def _split_embedded_headers(line: str) -> list[str]:
    stripped = line.strip()
    if not stripped or match_section_header(_strip_markup_for_detection(stripped)):
        return [stripped]
    section_start = find_embedded_section_start(stripped)
    if section_start is None:
        return [stripped]
    prefix = stripped[:section_start].strip()
    suffix = stripped[section_start:].strip()
    if prefix and suffix:
        return [prefix, suffix]
    return [stripped]


def _cleanup_garbage(line: str) -> str:
    updated = re.sub(r"^[!\"#\$]+", "", line).strip()
    updated = re.sub(r"(?<=\s)[!\"#\$]{2,}(?=\s)", " ", updated)
    updated = re.sub(r"\s{2,}", " ", updated)
    if updated in {"[!b:$", "]", "[!i:$", "$", "$$"}:
        return ""
    return updated.strip()


def _rebuild_section_line(plain_line: str) -> str:
    header = match_section_header(plain_line)
    if not header:
        return plain_line
    idx = header.normalized_index
    tail = SPACE_RE.sub(" ", header.tail).strip()
    if tail:
        if "Thí sinh" in tail:
            title, instruction = tail.split("Thí sinh", 1)
            title = title.strip(" .:")
            instruction = f"Thí sinh {instruction.strip()}"
            if title:
                return f"[!b:$PHẦN {idx}. {title}.$] [!i:${instruction}$]".strip()
            return f"[!b:$PHẦN {idx}.$] [!i:${instruction}$]".strip()
        return f"[!b:$PHẦN {idx}. {tail}$]"
    return f"[!b:$PHẦN {idx}$]"


def _dedupe_adjacent_lines(lines: list[str]) -> list[str]:
    out: list[str] = []
    prev_plain = ""
    for line in lines:
        plain = _strip_markup_for_detection(line).lower()
        if out and plain and plain == prev_plain:
            continue
        out.append(line)
        prev_plain = plain
    return out


def normalize_raw_markup_chunk(raw_markup: str) -> str:
    normalized_text = _canonicalize_inline_tokens(raw_markup or "")
    normalized_text = _convert_markdown_tables(normalized_text)

    raw_lines = [line.rstrip() for line in normalized_text.splitlines() if line.strip()]
    lines: list[str] = []
    for raw_line in raw_lines:
        prepared = _merge_adjacent_style_tokens(raw_line.strip())
        prepared = STRUCT_QUESTION_TOKEN_RE.sub(lambda match: f"Câu {match.group(1)}. ", prepared)
        prepared = STRUCT_STATEMENT_TOKEN_RE.sub(lambda match: f"{match.group(1).lower()}) ", prepared)
        prepared = STRUCT_OPTION_TOKEN_RE.sub(lambda match: f"{match.group(1).upper()}. ", prepared)
        prepared = re.sub(r"(?<=[^\s])([A-D]\.\s)", r" \1", prepared)
        prepared = re.sub(r"(?<=[^\s])([a-d]\)\s)", r" \1", prepared)
        prepared = _cleanup_garbage(prepared)
        if not prepared:
            continue
        lines.extend(item for item in _split_embedded_headers(prepared) if item)

    merged_lines: list[str] = []
    idx = 0
    while idx < len(lines):
        current = lines[idx]
        if idx + 1 < len(lines):
            trailing = TRAILING_FRACTION_RE.match(_strip_markup_for_detection(current))
            if trailing:
                next_line = _strip_markup_for_detection(lines[idx + 1])
                if next_line.isdigit():
                    head = trailing.group(1).strip()
                    num = trailing.group(2)
                    current = f"{head} [math:$\\frac{{{num}}}{{{next_line}}}$]".strip()
                    idx += 1
        merged_lines.append(current)
        idx += 1

    expanded: list[str] = []
    for line in merged_lines:
        for chunk in _split_inline_blocks(line):
            plain_chunk = _strip_markup_for_detection(chunk)
            if ANSWER_HEADER_RE.match(plain_chunk):
                expanded.append("[!b:$ĐÁP ÁN$]")
                continue
            if END_HEADER_RE.match(plain_chunk):
                expanded.append("[!b:$-------- HẾT --------$]")
                continue
            if match_section_header(plain_chunk):
                expanded.append(_rebuild_section_line(plain_chunk))
                continue
            if QUESTION_RE.match(plain_chunk):
                expanded.append(chunk)
                continue
            for embedded in _split_embedded_headers(chunk):
                if embedded != chunk:
                    expanded.append(embedded)
                    continue
                split_options = _split_inline_marks(embedded, OPTION_MARK_RE)
                if len(split_options) > 1:
                    expanded.extend(split_options)
                    continue
                split_tf = _split_inline_marks(embedded, TF_MARK_RE)
                expanded.extend(split_tf)

    out_lines: list[str] = []
    for line in expanded:
        table_match = re.match(r"^\[\*\s*(.*?)\s*\*\]$", line)
        if table_match:
            cells = [_strip_markup_for_detection(cell).strip() for cell in table_match.group(1).split("|")]
            line = f"[* {' | '.join(cells)} *]"
        line = _normalize_fraction_line(line)
        line = _normalize_option_line(line)
        line = _normalize_tf_line(line)
        line = SPACE_RE.sub(" ", line).strip()
        line = _cleanup_garbage(line)
        if line:
            out_lines.append(line)

    return "\n".join(_dedupe_adjacent_lines(out_lines))


def normalize_full_raw_markup(raw_markup_chunks: list[str]) -> str:
    cleaned = [normalize_raw_markup_chunk(chunk) for chunk in raw_markup_chunks if chunk and chunk.strip()]
    joined = "\n".join(cleaned)
    return re.sub(r"\n{3,}", "\n\n", joined).strip()
