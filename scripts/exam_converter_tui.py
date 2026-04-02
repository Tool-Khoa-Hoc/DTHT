from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

try:
    from convert_exam_with_llm import (
        DEFAULT_MODELS,
        DEFAULT_PROVIDER,
        convert_exam_file,
        default_model_for_provider,
        list_available_models,
    )
except ImportError:
    from scripts.convert_exam_with_llm import (
        DEFAULT_MODELS,
        DEFAULT_PROVIDER,
        convert_exam_file,
        default_model_for_provider,
        list_available_models,
    )

SETTINGS_PATH = PROJECT_ROOT / ".exam_converter_tui.settings.json"
SUPPORTED_EXTENSIONS = {".docx", ".txt", ".md"}

RESET = "\033[0m"
CYAN = "\033[96m"
RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
DIM = "\033[2m"
WHITE = "\033[97m"


@dataclass
class Job:
    input_path: Path
    output_path: Path


@dataclass
class AppState:
    provider: str = DEFAULT_PROVIDER
    auto_model: bool = True
    model: str = DEFAULT_MODELS.get(DEFAULT_PROVIDER, "gpt-4o-mini")
    api_key: str = ""
    remember_api_key: bool = False
    output_dir: str = ""
    asset_dir: str = ""
    dump_raw_dir: str = ""
    max_retries: int = 2
    max_chunk_chars: int = 6000
    max_concurrency: int = 3


def _enable_ansi() -> None:
    if os.name == "nt":
        os.system("")


def _clear() -> None:
    os.system("cls" if os.name == "nt" else "clear")


def _slugify(value: str) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(ch for ch in text if not unicodedata.combining(ch)).lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = re.sub(r"-{2,}", "-", text).strip("-")
    return text or "exam"


def _find_input_root(path: Path) -> Path | None:
    parent = path.resolve().parent
    for candidate in (parent, *parent.parents):
        if candidate.name.lower() == "input":
            return candidate
    return None


def _output_bucket_name(input_path: Path) -> str:
    if input_path.suffix.lower() == ".docx":
        return _slugify(input_path.stem)
    input_root = _find_input_root(input_path)
    if input_root is not None:
        rel = input_path.resolve().relative_to(input_root)
        if len(rel.parts) >= 2:
            return _slugify(rel.parts[0])
    return _slugify(input_path.parent.name or input_path.stem)


def _compute_output_path(state: AppState, input_path: Path) -> Path:
    output_bucket = _output_bucket_name(input_path)
    if input_path.suffix.lower() == ".docx":
        if state.output_dir.strip():
            return Path(state.output_dir).expanduser() / output_bucket / "exam.json"
        if state.asset_dir.strip():
            return Path(state.asset_dir).expanduser() / output_bucket / "exam.json"
    if state.output_dir.strip():
        base = Path(state.output_dir).expanduser()
    else:
        input_root = _find_input_root(input_path)
        base = input_root.parent / "output" if input_root is not None else input_path.parent
    return base / output_bucket / "exam.json"


def _load_settings() -> AppState:
    if not SETTINGS_PATH.exists():
        return AppState()
    try:
        raw = json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
        state = AppState()
        for field in state.__dataclass_fields__:
            if field in raw:
                setattr(state, field, raw[field])
        return state
    except Exception:
        return AppState()


def _save_settings(state: AppState) -> None:
    data = state.__dict__.copy()
    if not state.remember_api_key:
        data["api_key"] = ""
    SETTINGS_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _scan_folder(folder: Path) -> list[Path]:
    return sorted([p for p in folder.rglob("*") if p.is_file() and p.suffix.lower() in SUPPORTED_EXTENSIONS])


def _refresh_index() -> None:
    script = PROJECT_ROOT / "scripts" / "generate-exam-index.mjs"
    if not script.exists():
        return
    subprocess.run(["node", str(script), "--root", str(PROJECT_ROOT)], cwd=str(PROJECT_ROOT), capture_output=True)


def _print_banner(state: AppState, jobs: list[Job]) -> None:
    print(f"{CYAN}███╗   ███╗ █████╗ ███████╗████████╗███████╗██████╗     ████████╗ ██████╗  ██████╗ ██╗{RESET}")
    print(f"{CYAN}████╗ ████║██╔══██╗██╔════╝╚══██╔══╝██╔════╝██╔══██╗    ╚══██╔══╝██╔═══██╗██╔═══██╗██║{RESET}")
    print(f"{CYAN}██╔████╔██║███████║███████╗   ██║   █████╗  ██████╔╝       ██║   ██║   ██║██║   ██║██║{RESET}")
    print(f"{CYAN}██║╚██╔╝██║██╔══██║╚════██║   ██║   ██╔══╝  ██╔══██╗       ██║   ██║   ██║██║   ██║██║{RESET}")
    print(f"{CYAN}██║ ╚═╝ ██║██║  ██║███████║   ██║   ███████╗██║  ██║       ██║   ╚██████╔╝╚██████╔╝███████╗{RESET}")
    print(f"{CYAN}╚═╝     ╚═╝╚═╝  ╚═╝╚══════╝   ╚═╝   ╚══════╝╚═╝  ╚═╝       ╚═╝    ╚═════╝  ╚═════╝ ╚══════╝{RESET}")
    print(f"{DIM}Converter TUI | provider={state.provider} | model={'default' if state.auto_model else state.model}{RESET}")
    print(f"{DIM}Queue: {len(jobs)} | retries={state.max_retries} | chunk={state.max_chunk_chars} | concurrency={state.max_concurrency}{RESET}")
    print("")
    print(f"{RED}[01]{RESET} Add files (comma-separated paths)      {RED}[10]{RESET} Set output dir")
    print(f"{RED}[02]{RESET} Add folder (recursive)                 {RED}[11]{RESET} Set asset dir (docx)")
    print(f"{RED}[03]{RESET} Show queue                              {RED}[12]{RESET} Set dump raw dir")
    print(f"{RED}[04]{RESET} Remove queue item                       {RED}[13]{RESET} Set max retries")
    print(f"{RED}[05]{RESET} Clear queue                             {RED}[14]{RESET} Set max chunk chars")
    print(f"{RED}[06]{RESET} Set provider                            {RED}[15]{RESET} Set max concurrency")
    print(f"{RED}[07]{RESET} Toggle auto model                       {RED}[16]{RESET} Run batch convert")
    print(f"{RED}[08]{RESET} Set model (manual)                      {RED}[17]{RESET} Save settings")
    print(f"{RED}[09]{RESET} Set API key / toggle remember key       {RED}[00]{RESET} Exit")
    print("")


def _input_paths(prompt: str) -> list[Path]:
    raw = input(prompt).strip()
    if not raw:
        return []
    return [Path(p.strip().strip('"')) for p in raw.split(",") if p.strip()]


def _append_jobs(state: AppState, jobs: list[Job], paths: Iterable[Path]) -> tuple[int, int]:
    existing = {str(job.input_path.resolve()).lower() for job in jobs}
    out_existing = {str(job.output_path.resolve()).lower() for job in jobs}
    added, skipped = 0, 0
    for path in paths:
        try:
            rp = path.resolve()
        except Exception:
            skipped += 1
            continue
        if not rp.exists() or rp.suffix.lower() not in SUPPORTED_EXTENSIONS:
            skipped += 1
            continue
        in_key = str(rp).lower()
        if in_key in existing:
            skipped += 1
            continue
        out = _compute_output_path(state, rp)
        out_key = str(out.resolve()).lower()
        if out_key in out_existing:
            skipped += 1
            continue
        jobs.append(Job(input_path=rp, output_path=out))
        existing.add(in_key)
        out_existing.add(out_key)
        added += 1
    return added, skipped


def _run_batch(state: AppState, jobs: list[Job]) -> None:
    if not jobs:
        print(f"{YELLOW}Queue is empty.{RESET}")
        input("Press Enter...")
        return
    provider = state.provider.strip() or DEFAULT_PROVIDER
    model = None if state.auto_model else (state.model.strip() or default_model_for_provider(provider))
    api_key = state.api_key.strip() or None
    ok, fail = 0, 0
    for idx, job in enumerate(jobs, start=1):
        print(f"{CYAN}[{idx}/{len(jobs)}]{RESET} {job.input_path.name} -> {job.output_path}")
        try:
            asset_dir = None
            if job.input_path.suffix.lower() == ".docx":
                asset_dir = job.output_path.parent
            dump_raw = None
            if state.dump_raw_dir.strip():
                dump_raw = Path(state.dump_raw_dir).expanduser() / f"{job.input_path.stem}.raw.md"

            result = convert_exam_file(
                input_path=job.input_path,
                output_path=job.output_path,
                provider=provider,
                model=model,
                api_key=api_key,
                max_retries=int(state.max_retries),
                max_chunk_chars=int(state.max_chunk_chars),
                max_concurrency=int(state.max_concurrency),
                asset_dir=asset_dir,
                dump_raw=dump_raw,
                docx_parser="auto",
            )
            ok += 1
            print(f"{GREEN}  OK{RESET} id={result.get('id')}")
        except Exception as exc:
            fail += 1
            print(f"{RED}  FAIL{RESET} {exc}")
    _refresh_index()
    print("")
    print(f"{GREEN}Done:{RESET} success={ok} fail={fail}")
    input("Press Enter...")


def main() -> int:
    _enable_ansi()
    state = _load_settings()
    jobs: list[Job] = []

    while True:
        _clear()
        _print_banner(state, jobs)
        choice = input(f"{WHITE}> Select Tool:{RESET} ").strip()

        if choice == "00":
            _save_settings(state)
            return 0
        if choice == "01":
            paths = _input_paths("Input file paths (.docx/.txt/.md), separated by comma: ")
            added, skipped = _append_jobs(state, jobs, paths)
            print(f"Added={added}, Skipped={skipped}")
            input("Press Enter...")
        elif choice == "02":
            folder = Path(input("Folder path: ").strip().strip('"'))
            files = _scan_folder(folder) if folder.exists() else []
            added, skipped = _append_jobs(state, jobs, files)
            print(f"Added={added}, Skipped={skipped}")
            input("Press Enter...")
        elif choice == "03":
            if not jobs:
                print("Queue empty.")
            else:
                for i, job in enumerate(jobs, start=1):
                    print(f"[{i:02d}] {job.input_path} -> {job.output_path}")
            input("Press Enter...")
        elif choice == "04":
            idx = int(input("Queue index to remove: ").strip() or "0")
            if 1 <= idx <= len(jobs):
                jobs.pop(idx - 1)
        elif choice == "05":
            jobs.clear()
        elif choice == "06":
            provider = input("Provider (openai/gemini/anthropic/auto): ").strip().lower()
            if provider in {"openai", "gemini", "anthropic", "auto"}:
                state.provider = provider
                if state.auto_model:
                    state.model = default_model_for_provider(provider if provider != "auto" else DEFAULT_PROVIDER)
        elif choice == "07":
            state.auto_model = not state.auto_model
        elif choice == "08":
            provider = state.provider if state.provider != "auto" else DEFAULT_PROVIDER
            _, models = list_available_models(provider=provider, api_key=state.api_key.strip() or None, requested_model=state.model)
            print("Available models:", ", ".join(models[:20]) if models else "(no list)")
            state.model = input("Model name: ").strip() or state.model
            state.auto_model = False
            input("Press Enter...")
        elif choice == "09":
            sub = input("1) Set API key  2) Toggle remember key: ").strip()
            if sub == "1":
                state.api_key = input("API key: ").strip()
            elif sub == "2":
                state.remember_api_key = not state.remember_api_key
        elif choice == "10":
            state.output_dir = input("Output dir (empty = auto): ").strip().strip('"')
            for job in jobs:
                job.output_path = _compute_output_path(state, job.input_path)
        elif choice == "11":
            state.asset_dir = input("Asset dir (empty = auto): ").strip().strip('"')
            for job in jobs:
                job.output_path = _compute_output_path(state, job.input_path)
        elif choice == "12":
            state.dump_raw_dir = input("Dump raw dir (empty = off): ").strip().strip('"')
        elif choice == "13":
            state.max_retries = max(0, int(input("Max retries: ").strip() or str(state.max_retries)))
        elif choice == "14":
            state.max_chunk_chars = max(1000, int(input("Max chunk chars: ").strip() or str(state.max_chunk_chars)))
        elif choice == "15":
            state.max_concurrency = max(1, int(input("Max concurrency: ").strip() or str(state.max_concurrency)))
        elif choice == "16":
            _run_batch(state, jobs)
        elif choice == "17":
            _save_settings(state)
            print("Saved settings.")
            input("Press Enter...")


if __name__ == "__main__":
    raise SystemExit(main())

