from __future__ import annotations

import importlib
from pathlib import Path
from typing import Any


WD_FORMAT_XML_DOCUMENT = 16


def _load_word_client() -> Any:
    try:
        return importlib.import_module("win32com.client")
    except ModuleNotFoundError as exc:
        raise RuntimeError("pywin32 is not installed; cannot convert .doc files.") from exc


def _create_word_application(client_module: Any) -> Any:
    if hasattr(client_module, "DispatchEx"):
        return client_module.DispatchEx("Word.Application")
    gencache = getattr(client_module, "gencache", None)
    if gencache is not None and hasattr(gencache, "EnsureDispatch"):
        return gencache.EnsureDispatch("Word.Application")
    if hasattr(client_module, "Dispatch"):
        return client_module.Dispatch("Word.Application")
    raise RuntimeError("win32com client does not expose a Word dispatcher.")


def convert_doc_to_docx(doc_path: Path, output_dir: Path, *, client_module: Any | None = None) -> Path:
    source_path = Path(doc_path).resolve()
    if source_path.suffix.lower() != ".doc":
        raise ValueError(f"Expected a .doc file, got: {source_path}")
    if not source_path.exists():
        raise FileNotFoundError(f".doc file not found: {source_path}")

    output_dir = Path(output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    target_path = output_dir / f"{source_path.stem}.docx"

    client = client_module or _load_word_client()
    word = None
    document = None
    try:
        word = _create_word_application(client)
        word.Visible = False
        word.DisplayAlerts = 0
        document = word.Documents.Open(str(source_path))
        document.SaveAs2(str(target_path), FileFormat=WD_FORMAT_XML_DOCUMENT)
    except Exception as exc:
        raise RuntimeError(f"Failed to convert .doc to .docx: {source_path}") from exc
    finally:
        if document is not None:
            try:
                document.Close(False)
            except Exception:
                pass
        if word is not None:
            try:
                word.Quit()
            except Exception:
                pass

    if not target_path.exists():
        raise RuntimeError(f"Word conversion did not create output file: {target_path}")
    return target_path
