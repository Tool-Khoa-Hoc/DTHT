#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
UI/UX Pro Max Automated Static Auditor (Zero-Dependency Python 3 Stdlib)
Designed for Argon 4 + DeepSeek V4.1 Flash Multi-Agent UI/UX Workflows.

Usage:
  python .agents/skills/ui-ux-pro-max/scripts/audit_ui_ux.py [target_path] [--json] [--strict]

Checks (.jsx, .tsx, .js, .ts, .css):
  1. blocking-dialog                : window.alert() / window.confirm() blocking UI threads
  2. decorative-icon-aria           : .material-symbols-outlined <span> missing aria-hidden="true"
  3. legacy-dark-only-token         : Hardcoded dark-only classes/hexes (bg-ink-950, text-ember-*, bg-[#150a0d], bg-[#201216])
  4. img-missing-alt                : <img> elements missing explicit alt attribute
  5. icon-only-button-missing-label : Icon-only <button> elements without aria-label, aria-labelledby, or visible text
"""

import argparse
import bisect
import io
import json
import os
import re
import sys
from pathlib import Path
from typing import Dict, Iterator, List, Optional, Tuple

# Force UTF-8 for stdout/stderr on Windows (cp1252 default)
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if sys.stderr.encoding and sys.stderr.encoding.lower() != "utf-8":
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

SCANNABLE_EXTENSIONS = {".jsx", ".tsx", ".js", ".ts", ".css"}
MARKUP_EXTENSIONS = {".jsx", ".tsx", ".js", ".ts"}
IGNORED_DIRS = {
    "node_modules",
    ".git",
    "dist",
    "build",
    ".next",
    "coverage",
    ".turbo",
    ".vercel",
    "__pycache__",
}

# Rule 1: Blocking browser dialogs
BLOCKING_DIALOG_RE = re.compile(
    r"(?:\bwindow\.(?:alert|confirm|prompt)\s*\(|(?<![.\w$])(?:alert|confirm)\s*\()"
)
NON_CALL_PREFIX_RE = re.compile(
    r"(?:function|const|let|var|async)\s+(?:alert|confirm)\s*\($"
)

# Rule 3: Legacy dark-only classes / hardcoded dark hex tokens
LEGACY_TOKEN_PATTERNS: List[Tuple[re.Pattern, str]] = [
    (
        re.compile(r"\b(?:bg|text|border|from|via|to|ring)-ink-(?:950|900|800)\b"),
        "Legacy ink-* dark-only utility; migrate to semantic tokens (bg-background, bg-paper, bg-surface, border-border).",
    ),
    (
        re.compile(r"\b(?:bg|text|border|from|via|to|ring)-ember-[\w/-]+\b"),
        "Legacy ember-* utility; migrate to semantic tokens (bg-primary, text-primary, text-accent).",
    ),
    (
        re.compile(r"(?:bg-\[#150a0d\]|#150a0d)\b", re.IGNORECASE),
        "Hardcoded legacy dark hex #150a0d; migrate to semantic Dual-Theme token (bg-background / var(--color-background)).",
    ),
    (
        re.compile(r"(?:bg-\[#201216\]|#201216)\b", re.IGNORECASE),
        "Hardcoded legacy dark surface hex #201216; migrate to semantic Dual-Theme token (bg-surface / var(--color-surface)).",
    ),
]

MATERIAL_ICON_CLASS_RE = re.compile(
    r"\bmaterial-symbols-(?:outlined|rounded|sharp)\b"
)
ARIA_HIDDEN_RE = re.compile(
    r"\baria-hidden(?:\s*=\s*(?:[\"']true[\"']|\{\s*true\s*\}))?(?=[\s/>])"
)
ARIA_LABEL_RE = re.compile(r"\baria-(?:label|labelledby)\s*=")
ROLE_IMG_RE = re.compile(r"\brole\s*=\s*[\"']img[\"']")
ALT_ATTR_RE = re.compile(r"\balt\s*=")
SPREAD_ATTR_RE = re.compile(r"\{\s*\.\.\.")

# Strips Material Symbols ligature spans and inline SVGs inside buttons
MATERIAL_SPAN_BLOCK_RE = re.compile(
    r"<span\b[^>]*material-symbols-(?:outlined|rounded|sharp)[^>]*>[\s\S]*?</span>",
    re.IGNORECASE,
)
SVG_BLOCK_RE = re.compile(r"<svg\b[\s\S]*?</svg>", re.IGNORECASE)
ICON_COMPONENT_HINT_RE = re.compile(
    r"(?:<svg\b|material-symbols-(?:outlined|rounded|sharp)|<[A-Z][A-Za-z0-9_.]*\b[^>]*/>|<i\b[^>]*class(?:Name)?=)"
)
ANY_JSX_TAG_RE = re.compile(r"<[^>]+>")


def build_line_offsets(text: str) -> List[int]:
    """Return 0-based character offsets where each 1-based line starts."""
    offsets = [0]
    for idx, ch in enumerate(text):
        if ch == "\n":
            offsets.append(idx + 1)
    return offsets


def offset_to_line(line_offsets: List[int], offset: int) -> int:
    """Convert 0-based character offset to 1-based line number."""
    return bisect.bisect_right(line_offsets, offset)


def mask_comments_preserve_newlines(text: str, is_css: bool = False) -> str:
    """
    Replace JS/TS/CSS comments with spaces while preserving all newlines and character offsets.
    Prevents false positives inside commented-out code.
    """
    chars = list(text)
    n = len(chars)
    i = 0
    state = "code"  # code | single | double | template | line_comment | block_comment

    while i < n:
        ch = chars[i]
        nxt = chars[i + 1] if i + 1 < n else ""

        if state == "code":
            if ch == "/" and nxt == "*":
                chars[i] = " "
                chars[i + 1] = " "
                i += 2
                state = "block_comment"
                continue
            if not is_css and ch == "/" and nxt == "/":
                chars[i] = " "
                chars[i + 1] = " "
                i += 2
                state = "line_comment"
                continue
            if ch == "'":
                state = "single"
            elif ch == '"':
                state = "double"
            elif not is_css and ch == "`":
                state = "template"
            i += 1

        elif state == "line_comment":
            if ch == "\n":
                state = "code"
            else:
                chars[i] = " "
            i += 1

        elif state == "block_comment":
            if ch == "*" and nxt == "/":
                chars[i] = " "
                chars[i + 1] = " "
                i += 2
                state = "code"
                continue
            if ch != "\n":
                chars[i] = " "
            i += 1

        elif state == "single":
            if ch == "\\" and i + 1 < n:
                i += 2
                continue
            if ch == "'" or ch == "\n":
                state = "code"
            i += 1

        elif state == "double":
            if ch == "\\" and i + 1 < n:
                i += 2
                continue
            if ch == '"' or ch == "\n":
                state = "code"
            i += 1

        elif state == "template":
            if ch == "\\" and i + 1 < n:
                i += 2
                continue
            if ch == "`":
                state = "code"
            i += 1

    return "".join(chars)


def iter_jsx_opening_tags(
    text: str, tag_name: str
) -> Iterator[Tuple[int, int, str, bool]]:
    """
    Yield (start_offset, end_offset, raw_opening_tag, is_self_closing) for `<tag_name ...>`.
    Safely skips `>` inside `{...}` JSX expressions (e.g., arrow functions) and quotes.
    """
    pattern = re.compile(rf"<{re.escape(tag_name)}(?=[\s/>])")
    n = len(text)

    for match in pattern.finditer(text):
        start = match.start()
        i = match.end()
        brace_depth = 0
        quote: Optional[str] = None

        while i < n:
            ch = text[i]
            if quote is not None:
                if ch == "\\" and i + 1 < n:
                    i += 2
                    continue
                if ch == quote:
                    quote = None
                i += 1
                continue

            if ch in ("'", '"', "`"):
                quote = ch
            elif ch == "{":
                brace_depth += 1
            elif ch == "}":
                if brace_depth > 0:
                    brace_depth -= 1
            elif ch == ">" and brace_depth == 0:
                raw_tag = text[start : i + 1]
                stripped = raw_tag[:-1].rstrip()
                is_self_closing = stripped.endswith("/")
                yield (start, i + 1, raw_tag, is_self_closing)
                break
            i += 1


def find_matching_closing_tag(text: str, open_end: int, tag_name: str) -> Optional[int]:
    """Find matching `</tag_name>` offset starting from open_end, handling nested tags."""
    token_re = re.compile(rf"</?{re.escape(tag_name)}(?=[\s/>])")
    depth = 1
    pos = open_end
    limit = min(len(text), open_end + 8000)

    while pos < limit:
        m = token_re.search(text, pos, limit)
        if not m:
            return None
        token = m.group(0)
        if token.startswith("</"):
            depth -= 1
            if depth == 0:
                return m.start()
            pos = m.end()
        else:
            # Determine if nested tag is self-closing
            sub_iter = iter_jsx_opening_tags(text[m.start() : limit], tag_name)
            sub = next(sub_iter, None)
            if sub is None:
                return None
            _, rel_end, _, is_self = sub
            if not is_self:
                depth += 1
            pos = m.start() + rel_end

    return None


def make_issue(
    rel_path: str,
    line: int,
    rule: str,
    severity: str,
    message: str,
    snippet: str,
) -> Dict[str, object]:
    clean_snippet = " ".join(snippet.strip().split())
    if len(clean_snippet) > 140:
        clean_snippet = clean_snippet[:137] + "..."
    return {
        "file": rel_path.replace("\\", "/"),
        "line": line,
        "rule": rule,
        "severity": severity,
        "message": message,
        "snippet": clean_snippet,
    }


def scan_file(file_path: Path, base_dir: Path) -> List[Dict[str, object]]:
    issues: List[Dict[str, object]] = []
    ext = file_path.suffix.lower()
    if ext not in SCANNABLE_EXTENSIONS:
        return issues

    try:
        raw_text = file_path.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        return [
            make_issue(
                str(file_path),
                1,
                "file-read-error",
                "error",
                f"Unable to read file: {exc}",
                "",
            )
        ]

    try:
        rel_path = str(file_path.relative_to(base_dir))
    except ValueError:
        rel_path = str(file_path)

    is_css = ext == ".css"
    masked = mask_comments_preserve_newlines(raw_text, is_css=is_css)
    raw_lines = raw_text.splitlines()
    line_offsets = build_line_offsets(raw_text)

    def get_line_snippet(line_no: int) -> str:
        if 1 <= line_no <= len(raw_lines):
            return raw_lines[line_no - 1]
        return ""

    # 1. Blocking browser dialogs (JS/TS/JSX/TSX only)
    if ext in MARKUP_EXTENSIONS:
        for match in BLOCKING_DIALOG_RE.finditer(masked):
            start = match.start()
            # Ignore function/variable declarations named alert or confirm
            prefix_slice = masked[max(0, start - 20) : match.end()]
            if NON_CALL_PREFIX_RE.search(prefix_slice):
                continue
            line_no = offset_to_line(line_offsets, start)
            issues.append(
                make_issue(
                    rel_path,
                    line_no,
                    "blocking-dialog",
                    "error",
                    "Avoid blocking window.alert() / window.confirm(); use non-blocking Toast or accessible Modal confirmation.",
                    get_line_snippet(line_no),
                )
            )

    # 3. Legacy dark-only classes & hardcoded hexes (all scannable files)
    for pattern, msg in LEGACY_TOKEN_PATTERNS:
        for match in pattern.finditer(masked):
            line_no = offset_to_line(line_offsets, match.start())
            issues.append(
                make_issue(
                    rel_path,
                    line_no,
                    "legacy-dark-only-token",
                    "warning",
                    f"{msg} (found `{match.group(0)}`)",
                    get_line_snippet(line_no),
                )
            )

    if ext not in MARKUP_EXTENSIONS:
        return issues

    # 2. Decorative Material Symbols <span> missing aria-hidden="true"
    for start, _, raw_tag, _ in iter_jsx_opening_tags(masked, "span"):
        if MATERIAL_ICON_CLASS_RE.search(raw_tag):
            has_aria_hidden = bool(ARIA_HIDDEN_RE.search(raw_tag))
            is_labeled_img = bool(
                ROLE_IMG_RE.search(raw_tag) and ARIA_LABEL_RE.search(raw_tag)
            )
            if not has_aria_hidden and not is_labeled_img:
                line_no = offset_to_line(line_offsets, start)
                issues.append(
                    make_issue(
                        rel_path,
                        line_no,
                        "decorative-icon-aria",
                        "warning",
                        'Font-ligature icon `.material-symbols-outlined` is missing `aria-hidden="true"` (screen readers will announce raw ligature text).',
                        raw_text[start : start + len(raw_tag)],
                    )
                )

    # 4. <img> missing alt attribute
    for start, _, raw_tag, _ in iter_jsx_opening_tags(masked, "img"):
        if not ALT_ATTR_RE.search(raw_tag) and not SPREAD_ATTR_RE.search(raw_tag):
            line_no = offset_to_line(line_offsets, start)
            issues.append(
                make_issue(
                    rel_path,
                    line_no,
                    "img-missing-alt",
                    "error",
                    '<img> element is missing an `alt` attribute (use descriptive alt text or `alt=""` if purely decorative).',
                    raw_text[start : start + len(raw_tag)],
                )
            )

    # 5. Icon-only <button> without aria-label / aria-labelledby or visible text
    for start, end, raw_tag, is_self_closing in iter_jsx_opening_tags(masked, "button"):
        if ARIA_LABEL_RE.search(raw_tag) or SPREAD_ATTR_RE.search(raw_tag):
            continue

        if is_self_closing:
            line_no = offset_to_line(line_offsets, start)
            issues.append(
                make_issue(
                    rel_path,
                    line_no,
                    "icon-only-button-missing-label",
                    "error",
                    "Self-closing <button /> has no accessible name (`aria-label` or visible text).",
                    raw_text[start:end],
                )
            )
            continue

        close_start = find_matching_closing_tag(masked, end, "button")
        if close_start is None:
            continue

        inner_raw = raw_text[end:close_start]
        if not ICON_COMPONENT_HINT_RE.search(inner_raw):
            continue

        # Remove font-ligature icon spans and inline SVGs before checking remaining visible text
        cleaned = MATERIAL_SPAN_BLOCK_RE.sub(" ", inner_raw)
        cleaned = SVG_BLOCK_RE.sub(" ", cleaned)
        cleaned = ANY_JSX_TAG_RE.sub(" ", cleaned)
        cleaned_text = cleaned.strip()

        if not cleaned_text:
            line_no = offset_to_line(line_offsets, start)
            issues.append(
                make_issue(
                    rel_path,
                    line_no,
                    "icon-only-button-missing-label",
                    "error",
                    "Icon-only <button> lacks `aria-label` (or visible/sr-only text); screen readers cannot identify its action.",
                    raw_text[start : min(len(raw_text), close_start + 9)],
                )
            )

    return issues


def collect_files(target: Path) -> List[Path]:
    if target.is_file():
        return [target] if target.suffix.lower() in SCANNABLE_EXTENSIONS else []

    collected: List[Path] = []
    for root, dirs, files in os.walk(target):
        dirs[:] = sorted(d for d in dirs if d not in IGNORED_DIRS)
        for fname in sorted(files):
            fpath = Path(root) / fname
            if fpath.suffix.lower() in SCANNABLE_EXTENSIONS:
                collected.append(fpath)
    return collected


def format_human_report(
    target_str: str, files_scanned: int, issues: List[Dict[str, object]]
) -> str:
    lines: List[str] = []
    lines.append("=" * 72)
    lines.append("UI/UX PRO MAX — STATIC ACCESSIBILITY & DUAL-THEME AUDIT")
    lines.append("=" * 72)
    lines.append(f"Target        : {target_str}")
    lines.append(f"Files Scanned : {files_scanned}")
    lines.append(f"Total Issues  : {len(issues)}")

    by_rule: Dict[str, int] = {}
    for item in issues:
        rule = str(item["rule"])
        by_rule[rule] = by_rule.get(rule, 0) + 1

    if by_rule:
        lines.append("-" * 72)
        lines.append("Summary by Rule:")
        for rule_name, count in sorted(by_rule.items()):
            lines.append(f"  - {rule_name:<32} : {count}")
        lines.append("-" * 72)
        for item in issues:
            sev = str(item["severity"]).upper()
            loc = f"{item['file']}:{item['line']}"
            lines.append(f"[{sev}] {loc} ({item['rule']})")
            lines.append(f"  -> {item['message']}")
            if item.get("snippet"):
                lines.append(f"     Snippet: {item['snippet']}")
    else:
        lines.append("-" * 72)
        lines.append("PASS: Zero UI/UX static violations detected.")

    lines.append("=" * 72)
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Zero-dependency UI/UX & Dual-Theme static auditor for Web SPAs."
    )
    parser.add_argument(
        "target",
        nargs="?",
        default="src",
        help="Target directory or file to scan (default: src)",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit structured JSON output for Argon 4 / DeepSeek V4.1 Flash pipelines",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Return exit code 1 when one or more issues are found",
    )
    args = parser.parse_args()

    target_path = Path(args.target)
    if not target_path.exists():
        err_msg = f"Target path does not exist: {target_path}"
        if args.json:
            print(json.dumps({"error": err_msg}, ensure_ascii=False, indent=2))
        else:
            print(f"Error: {err_msg}", file=sys.stderr)
        return 2

    base_dir = Path.cwd()
    files = collect_files(target_path)
    all_issues: List[Dict[str, object]] = []
    for fpath in files:
        all_issues.extend(scan_file(fpath, base_dir))

    all_issues.sort(key=lambda x: (str(x["file"]), int(x["line"]), str(x["rule"])))

    by_rule: Dict[str, int] = {}
    errors_count = 0
    warnings_count = 0
    for item in all_issues:
        r = str(item["rule"])
        by_rule[r] = by_rule.get(r, 0) + 1
        if item["severity"] == "error":
            errors_count += 1
        else:
            warnings_count += 1

    if args.json:
        payload = {
            "target": str(target_path).replace("\\", "/"),
            "files_scanned": len(files),
            "summary": {
                "total": len(all_issues),
                "errors": errors_count,
                "warnings": warnings_count,
                "by_rule": by_rule,
            },
            "issues": all_issues,
        }
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print(
            format_human_report(
                str(target_path).replace("\\", "/"), len(files), all_issues
            )
        )

    if args.strict and len(all_issues) > 0:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
