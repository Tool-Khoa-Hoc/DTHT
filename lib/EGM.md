# lib — Shared Python Utilities

## Overview

`lib/` is the shared backend utility package for the DTHT exam-processing
pipeline. It is a flat Python package (no subpackages) that provides four
concerns:

| Module | Role |
| --- | --- |
| `__init__.py` | Empty package marker; makes `lib` importable as `lib.*`. |
| `exam_utils.py` | Pure JSON helpers for exam documents: load/save, answer-key detection and extraction, question counting, subject UI metadata, and public-payload sanitization. |
| `raw_extractor.py` | Document pipeline that converts `.docx` source into Markdown, extracts embedded images to an assets directory, renders Office Math (OMML) as LaTeX, and optionally cleans the result with a Gemini model. |
| `supabase_utils.py` | Supabase access layer (service-role client) over the `exam_keys`, `exams`, and `sync_logs` tables. |

These modules are consumed by the repository's Python tooling (e.g.
`exam_utils.py`, `raw_extractor.py`, `supabase_utils.py` import each other via
`from lib...`), and they bridge to external systems: the local filesystem,
`.docx`/ZIP archives, Google Gemini, and a Supabase project.

## Interface

### `exam_utils.py`

- `load_exam_json(path: Path) -> dict` — read UTF-8 JSON from disk.
- `save_exam_json(path: Path, data: dict) -> None` — write UTF-8 JSON with `ensure_ascii=False, indent=2`.
- `has_local_answers(data: dict) -> bool` — defined **twice**; the second definition (module import order) wins. The effective implementation returns `True` when any `answer_key` value is an `int`, a `dict`, or a non-blank `str`.
- `extract_answer_key(data: dict) -> dict` — flatten answers to `{ "partId.questionId" | "questionId": value }` in document order.
- `has_local_links(exam_data: dict) -> bool` — true if `resources` carries any of `solution_url`, `video_url`, `answer_file_url`, `exam_file_url`.
- `get_question_count(data: dict) -> int` — total questions across `parts[].questions`; `0` when `parts` is not a list.
- `get_subject_ui_meta(subject: str = "") -> dict` — returns `{"icon", "color"}` (Tailwind gradient classes) chosen by normalized subject substring.
- `sanitize_exam(data: dict) -> dict` — strip answer-bearing fields for the public payload; returns the same (mutated) object.

### `raw_extractor.py`

- `convert_to_raw_markdown(docx_path: Path | str, assets_dir: Path | str | None = None) -> tuple[str, dict[str, Any]]` — extract paragraphs, tables, images, and block math into raw Markdown; `assets_dir` defaults to `<docx_dir>/assets/`.
- `clean_with_ai(raw_text: str, api_key: str | None = None, model_name: str = "gemini-2.0-flash") -> str` — send raw Markdown plus `CLEAN_PROMPT` to Gemini and return normalized Markdown.
- `extract(docx_path, assets_dir=None, use_ai: bool = False, api_key=None, model_name="gemini-2.0-flash") -> tuple[str, dict[str, Any]]` — end-to-end docx → Markdown pipeline; AI cleaning is best-effort.
- `CLEAN_PROMPT: str` — Vietnamese prompt that enforces `Câu X:` numbering, `A./B./C./D.` option layout, preservation of `[img:$asset_id$]` and `[math:$latex$]` tags, table normalization, and header/noise rules.
- `_cli()` — `argparse` entry point (`docx`, `--assets/-a`, `--ai`).
- Capability flags `_HAS_DOCX`, `_HAS_GENAI` reflect optional-dependency availability at import time.
- `image_map` contract: `{ asset_filename: { "asset_id": str, "path": str, "source_rid": str } }`.

### `supabase_utils.py`

- `get_supabase_client() -> Client` — build a client from `VITE_SUPABASE_URL` and `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY`.
- `check_db_answers(supabase: Client, exam_id: str) -> bool` — whether `exam_keys.answer_key` is populated for an exam.
- `check_db_links(supabase: Client, exam_id: str) -> bool` — whether `exams.solution_url` or `exams.video_url` is populated.
- `get_remote_exam_data(supabase, exam_id: str) -> dict` — row from `exam_keys` (`answer_key`, `resources`, `last_synced_at`), `{}` on miss/error.
- `get_all_remote_exam_data(supabase: Client) -> list` — all `exam_keys` rows, `[]` on error.
- `upload_exam_data(supabase: Client, exam_data: dict, exam_path: Path) -> bool` — upsert into `exam_keys`, then update `solution_url` / `video_url` in `exams`.
- `log_sync_event(supabase: Client, exam_id: str, status: str, action: str, details: Optional[dict] = None)` — insert into `sync_logs`; failures are swallowed.
- `get_recent_sync_logs(supabase: Client, limit: int = 10) -> list` — newest `sync_logs` rows, `[]` on error.

**Child contracts:** none. `lib/` contains no subdirectories.

## Invariants

- **Exam document shape.** Exam JSON is expected to expose a top-level `parts` list; each part has an optional `id` and a `questions` list; questions carry `id`, either `correct_answer` or `statements[].correct`; optional top-level `answer_key` and `resources` maps.
- **Key format.** `extract_answer_key` emits `"{part_id}.{question_id}"` when the part has an `id`, otherwise the bare question id. Questions without an `id` are skipped.
- **Answer precedence.** Extraction order is: (1) top-level `answer_key[key]`, (2) inline `correct_answer`, (3) statement list built from `statements[].correct` preserving `None` placeholders. A statement answer is only emitted if at least one statement is answered.
- **Shallow `answer_key` check.** The effective `has_local_answers` only inspects `answer_key` values, so inline `correct_answer` data is invisible to it; a dict of all-`None` values counts as "no answers".
- **`sanitize_exam` is destructive and in-place.** It deletes `answer_key`, `//answer_key`, `resources`, `//resources`, all `parts[].questions[].correct_answer`, and `statements[].correct` from the caller's object. Always pass a deep copy if the original is still needed.
- **Subject metadata is substring-based.** `get_subject_ui_meta` lowercases the subject and matches `toán` → `lý` → `anh` → `hóa` → `sinh` in that priority order, defaulting to `{"icon": "quiz", "color": "from-slate-500 to-slate-600"}`. Matching is naive, so unrelated strings containing the same substrings inherit the styling.
- **Content-addressed assets.** Image file names are `img_<sha1(body)[:8]><ext>`; identical images reuse the same file, and an existing destination is never overwritten.
- **Markdown tag contract.** Images are emitted as `[img:$asset_id$]` and math as `[math:$latex$]`; the AI clean prompt is only safe because it is instructed to preserve those exact tags and IDs.
- **Markdown is deterministic.** `convert_to_raw_markdown` walks the document body in order (paragraphs, tables, block math), collapses consecutive blank paragraphs, and trims trailing blank lines.
- **Optional dependencies are soft.** Missing `python-docx` or `google-generativeai` does not break import; the affected call raises `ImportError` with an install hint.
- **AI cleaning is non-fatal.** `extract(..., use_ai=True)` logs to `stderr` and returns raw Markdown if `clean_with_ai` raises.
- **Credential preconditions.** `clean_with_ai` requires `api_key=` or `GEMINI_API_KEY` (else `ValueError`); `get_supabase_client` requires both URL and a service key (else `ValueError`).
- **Exam identity mirror.** `upload_exam_data` takes `exam_id` from `exam_data["id"]` and only falls back to `exam_path.parent.name` when absent; `exams` is updated only for link fields actually present in `resources`.
- **Read failures degrade quietly.** `check_db_answers`, `check_db_links`, `get_remote_exam_data`, `get_all_remote_exam_data`, `get_recent_sync_logs`, and `log_sync_event` all swallow exceptions and return `False` / `{}` / `[]` / `None`.
- **Write failures surface.** `upload_exam_data` re-raises unexpected errors; the sole exception is a missing `last_synced_at` column, which triggers one retry without that field.

## Side Effects

- **Filesystem reads:** opens the exam JSON file (`exam_utils`), reads `.docx` bytes and the internal ZIP/relationship parts, and loads `Document` objects (`raw_extractor`).
- **Filesystem writes:** `save_exam_json` overwrites the target JSON file; `convert_to_raw_markdown` creates `assets_dir` (including parents) and writes extracted image binaries into it.
- **Network egress:** `clean_with_ai` calls the Google Gemini API (`genai.configure` + `generate_content`); `supabase_utils` issues PostgREST reads/writes/upserts to the Supabase project.
- **Sensitive credentials:** `supabase_utils` prefers `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY`, i.e. a **service-role key that bypasses Row Level Security**; `raw_extractor` consumes `GEMINI_API_KEY`. Both are process-wide environment reads.
- **Import-time environment mutation:** `supabase_utils` calls `load_dotenv()` at import, populating `os.environ` from `.env` for every importer.
- **Caller-object mutation:** `sanitize_exam` mutates and returns the input dict (see Invariants).
- **Process output:** `raw_extractor` prints warnings to `stderr` on image-extraction and AI-cleaning failures.
- **Remote state mutation:** `upload_exam_data` upserts `exam_keys` (`answer_key`, `resources`, `last_synced_at`) and updates `exams` link columns; `log_sync_event` appends audit rows to `sync_logs`.
- **Clock dependency:** `upload_exam_data` stamps `last_synced_at` with the local machine time (`datetime.now().isoformat()`), not a server-side timestamp.

## Verification

- Run: `npm run lint && npm run build`
- **No Python test runner is configured in this repository.** There is no `pyproject.toml`, `setup.py`, `pytest.ini`, `Makefile`, or `test` script at `E:\DTHT`, so these four modules have no automated test command. Verification of `lib/` is therefore static review of the contracts above plus the Node lint/build commands, which cover the repository's frontend/tooling side only.
- Optional manual smoke check (not a test suite, requires local dependencies and env):
  - `python -c "import lib.exam_utils, lib.raw_extractor, lib.supabase_utils"`
