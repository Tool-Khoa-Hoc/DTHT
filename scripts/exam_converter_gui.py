from __future__ import annotations

import json
import os
import queue
import re
import sys
import threading
import traceback
import unicodedata
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
import tkinter as tk
from tkinter import filedialog, messagebox, ttk


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

try:
    from convert_exam_with_llm import (
        DEFAULT_MODELS,
        DEFAULT_PROVIDER,
        convert_exam_file,
        default_model_for_provider,
    )
except ImportError:
    from scripts.convert_exam_with_llm import (
        DEFAULT_MODELS,
        DEFAULT_PROVIDER,
        convert_exam_file,
        default_model_for_provider,
    )


SUPPORTED_EXTENSIONS = {".docx", ".txt", ".md"}
SETTINGS_PATH = PROJECT_ROOT / ".exam_converter_gui.settings.json"


@dataclass
class Job:
    input_path: Path
    output_path: Path
    status: str = "Queued"
    message: str = ""
    tree_id: str | None = None


class GradientCanvas(tk.Canvas):
    def __init__(
        self,
        master: tk.Misc,
        top_color: str = "#0A1020",
        bottom_color: str = "#1A2B44",
        **kwargs,
    ) -> None:
        super().__init__(master, highlightthickness=0, **kwargs)
        self.top_color = top_color
        self.bottom_color = bottom_color
        self.bind("<Configure>", self._draw_gradient)

    @staticmethod
    def _hex_to_rgb(value: str) -> tuple[int, int, int]:
        value = value.lstrip("#")
        return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))

    @staticmethod
    def _rgb_to_hex(rgb: tuple[int, int, int]) -> str:
        return f"#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}"

    def _draw_gradient(self, _: tk.Event) -> None:
        self.delete("bg")
        width = max(1, self.winfo_width())
        height = max(1, self.winfo_height())
        r1, g1, b1 = self._hex_to_rgb(self.top_color)
        r2, g2, b2 = self._hex_to_rgb(self.bottom_color)

        for y in range(height):
            ratio = y / height
            rgb = (
                int(r1 + (r2 - r1) * ratio),
                int(g1 + (g2 - g1) * ratio),
                int(b1 + (b2 - b1) * ratio),
            )
            self.create_line(0, y, width, y, fill=self._rgb_to_hex(rgb), tags=("bg",))

        self.create_oval(
            width - 380,
            -120,
            width + 120,
            260,
            fill="#6DB9FF",
            outline="",
            stipple="gray25",
            tags=("bg",),
        )
        self.create_oval(
            -180,
            height - 260,
            260,
            height + 120,
            fill="#8A9FFF",
            outline="",
            stipple="gray25",
            tags=("bg",),
        )
        self.tag_lower("bg")


class ExamConverterGUI:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title("Batch Word to exam.json Converter")
        self.root.geometry("1280x820")
        self.root.minsize(1080, 700)

        self.jobs: list[Job] = []
        self.queue_from_worker: queue.Queue[dict[str, object]] = queue.Queue()
        self.worker_thread: threading.Thread | None = None
        self.stop_event = threading.Event()
        self.running = False

        self.provider_var = tk.StringVar(value=DEFAULT_PROVIDER)
        self.auto_model_var = tk.BooleanVar(value=True)
        self.model_var = tk.StringVar(value=DEFAULT_MODELS.get(DEFAULT_PROVIDER, "gpt-5-mini"))
        self.api_key_var = tk.StringVar(value=self._default_api_key())
        self.show_key_var = tk.BooleanVar(value=False)
        self.remember_key_var = tk.BooleanVar(value=False)
        self.output_dir_var = tk.StringVar(value="")
        self.asset_dir_var = tk.StringVar(value="")
        self.dump_raw_var = tk.StringVar(value="")
        self.max_retries_var = tk.IntVar(value=2)
        self.progress_text_var = tk.StringVar(value="Ready")
        self._loaded_settings = self._load_settings()
        self._apply_loaded_settings(self._loaded_settings)

        self.bg = GradientCanvas(root)
        self.bg.pack(fill="both", expand=True)

        self.surface = tk.Frame(
            self.bg,
            bg="#0F1A2A",
            highlightthickness=1,
            highlightbackground="#577DAA",
            bd=0,
        )
        self.surface_window = self.bg.create_window(24, 24, anchor="nw", window=self.surface)
        self.bg.bind("<Configure>", self._on_canvas_resize, add="+")

        self._configure_styles()
        self._build_ui()
        self._wire_events()
        self._poll_worker_queue()
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)

    def _default_api_key(self) -> str:
        for env_name in ("OPENAI_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY", "ANTHROPIC_API_KEY"):
            value = os.environ.get(env_name)
            if value:
                return value
        return ""

    def _load_settings(self) -> dict[str, object]:
        if not SETTINGS_PATH.exists():
            return {}
        try:
            raw = SETTINGS_PATH.read_text(encoding="utf-8")
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}

    def _apply_loaded_settings(self, settings: dict[str, object]) -> None:
        provider = str(settings.get("provider", "")).strip().lower()
        if provider in {"openai", "gemini", "anthropic", "auto"}:
            self.provider_var.set(provider)

        auto_model = settings.get("auto_model")
        if isinstance(auto_model, bool):
            self.auto_model_var.set(auto_model)

        model = str(settings.get("model", "")).strip()
        if model:
            self.model_var.set(model)

        output_dir = str(settings.get("output_dir", "")).strip()
        asset_dir = str(settings.get("asset_dir", "")).strip()
        dump_raw_dir = str(settings.get("dump_raw_dir", "")).strip()
        self.output_dir_var.set(output_dir)
        self.asset_dir_var.set(asset_dir)
        self.dump_raw_var.set(dump_raw_dir)

        retries = settings.get("max_retries")
        if isinstance(retries, int) and 0 <= retries <= 10:
            self.max_retries_var.set(retries)

        remember_key = bool(settings.get("remember_api_key", False))
        self.remember_key_var.set(remember_key)
        if remember_key:
            saved_key = str(settings.get("api_key", "")).strip()
            if saved_key:
                self.api_key_var.set(saved_key)

    def _save_settings(self) -> None:
        data: dict[str, object] = {
            "provider": self.provider_var.get().strip() or DEFAULT_PROVIDER,
            "auto_model": bool(self.auto_model_var.get()),
            "model": self.model_var.get().strip(),
            "output_dir": self.output_dir_var.get().strip(),
            "asset_dir": self.asset_dir_var.get().strip(),
            "dump_raw_dir": self.dump_raw_var.get().strip(),
            "max_retries": int(self.max_retries_var.get()),
            "remember_api_key": bool(self.remember_key_var.get()),
        }
        data["api_key"] = self.api_key_var.get().strip() if self.remember_key_var.get() else ""
        SETTINGS_PATH.write_text(
            json.dumps(data, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def _slugify_folder(self, value: str) -> str:
        text = unicodedata.normalize("NFKD", str(value or ""))
        text = "".join(ch for ch in text if not unicodedata.combining(ch))
        text = text.lower()
        text = re.sub(r"[^a-z0-9]+", "-", text)
        text = re.sub(r"-{2,}", "-", text).strip("-")
        return text or "exam"

    def _find_input_root(self, input_path: Path) -> Path | None:
        parent = input_path.resolve().parent
        for candidate in (parent, *parent.parents):
            if candidate.name.lower() == "input":
                return candidate
        return None

    def _outer_folder_name(self, input_path: Path) -> str:
        resolved = input_path.resolve()
        input_root = self._find_input_root(resolved)
        if input_root is not None:
            try:
                relative_parts = resolved.relative_to(input_root).parts
                if len(relative_parts) >= 2:
                    return relative_parts[0]
            except Exception:
                pass
        if resolved.parent.name and resolved.parent.name.lower() != "input":
            return resolved.parent.name
        return resolved.stem

    def _output_bucket_name(self, input_path: Path) -> str:
        return self._slugify_folder(self._outer_folder_name(input_path))

    def _resolve_result_base_dir(self, input_path: Path) -> Path:
        output_dir_raw = self.output_dir_var.get().strip()
        if output_dir_raw:
            return Path(output_dir_raw).expanduser()

        input_root = self._find_input_root(input_path)
        if input_root is not None:
            return input_root.parent / "output"

        return input_path.parent

    def _configure_styles(self) -> None:
        style = ttk.Style(self.root)
        style.theme_use("clam")

        style.configure(
            "Card.TLabelframe",
            background="#132238",
            foreground="#DCE9FF",
            bordercolor="#6C93BB",
            relief="solid",
            borderwidth=1,
        )
        style.configure("Card.TLabelframe.Label", background="#132238", foreground="#DCE9FF")

        style.configure(
            "Glass.TButton",
            background="#21466F",
            foreground="#EAF4FF",
            bordercolor="#7FB8EA",
            focuscolor="#2B5F96",
            lightcolor="#21466F",
            darkcolor="#21466F",
            padding=(10, 6),
        )
        style.map(
            "Glass.TButton",
            background=[("active", "#2F5E92"), ("disabled", "#3B4E66")],
            foreground=[("disabled", "#9AAAC0")],
        )

        style.configure(
            "Accent.TButton",
            background="#2D73B5",
            foreground="#F2F8FF",
            bordercolor="#9ED3FF",
            focuscolor="#2D73B5",
            lightcolor="#2D73B5",
            darkcolor="#2D73B5",
            padding=(12, 7),
        )
        style.map(
            "Accent.TButton",
            background=[("active", "#3A8BD6"), ("disabled", "#4A617B")],
            foreground=[("disabled", "#A5B7CB")],
        )

        style.configure(
            "TCombobox",
            fieldbackground="#0E1C2F",
            background="#0E1C2F",
            foreground="#E5F1FF",
            arrowcolor="#E5F1FF",
        )
        style.configure(
            "Treeview",
            background="#0E1B2D",
            foreground="#E6F2FF",
            fieldbackground="#0E1B2D",
            borderwidth=0,
            rowheight=30,
        )
        style.map("Treeview", background=[("selected", "#295A8D")], foreground=[("selected", "#FFFFFF")])
        style.configure(
            "Treeview.Heading",
            background="#203B59",
            foreground="#EAF3FF",
            relief="flat",
            font=("Segoe UI", 10, "bold"),
        )

        style.configure(
            "Horizontal.TProgressbar",
            troughcolor="#122137",
            background="#4EB1FF",
            bordercolor="#21466F",
            lightcolor="#4EB1FF",
            darkcolor="#4EB1FF",
        )

    def _build_ui(self) -> None:
        self.surface.grid_columnconfigure(0, weight=1)
        self.surface.grid_rowconfigure(2, weight=3)
        self.surface.grid_rowconfigure(3, weight=2)

        self._build_header(self.surface)
        self._build_config_card(self.surface)
        self._build_files_card(self.surface)
        self._build_log_card(self.surface)
        self._build_footer(self.surface)

    def _build_header(self, parent: tk.Widget) -> None:
        header = tk.Frame(parent, bg="#0F1A2A", padx=22, pady=14)
        header.grid(row=0, column=0, sticky="ew")
        header.grid_columnconfigure(0, weight=1)

        tk.Label(
            header,
            text="Word/TXT -> exam.json Batch Converter",
            bg="#0F1A2A",
            fg="#EAF4FF",
            font=("Segoe UI", 20, "bold"),
        ).grid(row=0, column=0, sticky="w")
        tk.Label(
            header,
            text="Glass-style UI | OpenAI / Gemini / Anthropic | Strict schema output",
            bg="#0F1A2A",
            fg="#A9C5E6",
            font=("Segoe UI", 10),
        ).grid(row=1, column=0, sticky="w", pady=(4, 0))

    def _build_config_card(self, parent: tk.Widget) -> None:
        card = ttk.LabelFrame(parent, text=" Conversion Settings ", style="Card.TLabelframe", padding=12)
        card.grid(row=1, column=0, sticky="ew", padx=18, pady=(0, 10))

        for col in range(7):
            card.grid_columnconfigure(col, weight=1 if col in (1, 3, 5) else 0)

        self._label(card, "Provider").grid(row=0, column=0, sticky="w", padx=(0, 8), pady=5)
        self.provider_combo = ttk.Combobox(
            card,
            textvariable=self.provider_var,
            state="readonly",
            values=["openai", "gemini", "anthropic", "auto"],
            width=14,
        )
        self.provider_combo.grid(row=0, column=1, sticky="ew", pady=5)

        self._label(card, "Model").grid(row=0, column=2, sticky="w", padx=(14, 8), pady=5)
        self.model_entry = self._entry(card, self.model_var)
        self.model_entry.grid(row=0, column=3, sticky="ew", pady=5)

        self.auto_model_check = tk.Checkbutton(
            card,
            text="Default model",
            variable=self.auto_model_var,
            bg="#132238",
            fg="#D9E8FB",
            activebackground="#132238",
            activeforeground="#D9E8FB",
            selectcolor="#1D3552",
            highlightthickness=0,
            bd=0,
        )
        self.auto_model_check.grid(row=0, column=4, sticky="w", padx=(14, 0), pady=5)

        retry_box = tk.Frame(card, bg="#132238")
        retry_box.grid(row=0, column=6, sticky="e", pady=5)
        tk.Label(
            retry_box,
            text="Retries",
            bg="#132238",
            fg="#D8E8FC",
            font=("Segoe UI", 10),
        ).pack(side="left")
        self.retries_spin = tk.Spinbox(
            retry_box,
            from_=0,
            to=5,
            textvariable=self.max_retries_var,
            width=4,
            bg="#0E1C2F",
            fg="#E6F2FF",
            insertbackground="#E6F2FF",
            relief="flat",
            highlightthickness=1,
            highlightbackground="#35577D",
            highlightcolor="#6EA9DA",
            justify="center",
        )
        self.retries_spin.pack(side="left", padx=(6, 0))

        self._label(card, "API key").grid(row=1, column=0, sticky="w", padx=(0, 8), pady=5)
        self.api_key_entry = self._entry(card, self.api_key_var, show="*")
        self.api_key_entry.grid(row=1, column=1, columnspan=3, sticky="ew", pady=5)

        checks = tk.Frame(card, bg="#132238")
        checks.grid(row=1, column=4, columnspan=3, sticky="w", padx=(14, 0), pady=5)
        self.show_key_check = tk.Checkbutton(
            checks,
            text="Show key",
            variable=self.show_key_var,
            bg="#132238",
            fg="#D9E8FB",
            activebackground="#132238",
            activeforeground="#D9E8FB",
            selectcolor="#1D3552",
            highlightthickness=0,
            bd=0,
        )
        self.show_key_check.pack(side="left")
        self.remember_key_check = tk.Checkbutton(
            checks,
            text="Remember key",
            variable=self.remember_key_var,
            bg="#132238",
            fg="#D9E8FB",
            activebackground="#132238",
            activeforeground="#D9E8FB",
            selectcolor="#1D3552",
            highlightthickness=0,
            bd=0,
        )
        self.remember_key_check.pack(side="left", padx=(10, 0))

        self._label(card, "Result folder").grid(row=2, column=0, sticky="w", padx=(0, 8), pady=5)
        self.output_dir_entry = self._entry(card, self.output_dir_var)
        self.output_dir_entry.grid(row=2, column=1, columnspan=2, sticky="ew", pady=5)
        ttk.Button(card, text="Browse...", style="Glass.TButton", command=self._pick_output_dir).grid(
            row=2, column=3, sticky="w", padx=(8, 8), pady=5
        )

        self._label(card, "Asset base dir (docx)").grid(row=2, column=4, sticky="w", padx=(10, 8), pady=5)
        self.asset_dir_entry = self._entry(card, self.asset_dir_var)
        self.asset_dir_entry.grid(row=2, column=5, sticky="ew", pady=5)
        ttk.Button(card, text="Browse...", style="Glass.TButton", command=self._pick_asset_dir).grid(
            row=2, column=6, sticky="w", padx=(8, 0), pady=5
        )

        self._label(card, "Dump raw dir").grid(row=3, column=0, sticky="w", padx=(0, 8), pady=5)
        self.dump_raw_entry = self._entry(card, self.dump_raw_var)
        self.dump_raw_entry.grid(row=3, column=1, columnspan=2, sticky="ew", pady=5)
        ttk.Button(card, text="Browse...", style="Glass.TButton", command=self._pick_dump_raw_dir).grid(
            row=3, column=3, sticky="w", padx=(8, 8), pady=5
        )

        hint = (
            "Output folder name is derived from the outer input folder, slugified "
            "(bo-dau, bo-ky-tu-dac-biet, space -> '-')."
        )
        tk.Label(
            card,
            text=hint,
            bg="#132238",
            fg="#9FB9D8",
            anchor="w",
            justify="left",
            font=("Segoe UI", 9),
        ).grid(row=3, column=4, columnspan=3, sticky="ew", padx=(10, 0), pady=5)

    def _build_files_card(self, parent: tk.Widget) -> None:
        card = ttk.LabelFrame(parent, text=" Batch Files ", style="Card.TLabelframe", padding=12)
        card.grid(row=2, column=0, sticky="nsew", padx=18, pady=(0, 12))
        card.grid_columnconfigure(0, weight=1)
        card.grid_rowconfigure(1, weight=1)

        toolbar = tk.Frame(card, bg="#132238")
        toolbar.grid(row=0, column=0, sticky="ew", pady=(0, 10))

        self.add_files_btn = ttk.Button(toolbar, text="Add files", style="Glass.TButton", command=self._add_files)
        self.add_files_btn.pack(side="left", padx=(0, 8))
        self.add_folder_btn = ttk.Button(toolbar, text="Add folder", style="Glass.TButton", command=self._add_folder)
        self.add_folder_btn.pack(side="left", padx=(0, 8))
        self.remove_selected_btn = ttk.Button(
            toolbar, text="Remove selected", style="Glass.TButton", command=self._remove_selected
        )
        self.remove_selected_btn.pack(side="left", padx=(0, 8))
        self.clear_btn = ttk.Button(toolbar, text="Clear all", style="Glass.TButton", command=self._clear_jobs)
        self.clear_btn.pack(side="left")

        columns = ("index", "input", "output", "status", "detail")
        self.jobs_tree = ttk.Treeview(card, columns=columns, show="headings", selectmode="extended")
        self.jobs_tree.heading("index", text="#")
        self.jobs_tree.heading("input", text="Input")
        self.jobs_tree.heading("output", text="Output")
        self.jobs_tree.heading("status", text="Status")
        self.jobs_tree.heading("detail", text="Detail")

        self.jobs_tree.column("index", width=50, anchor="center")
        self.jobs_tree.column("input", width=360, anchor="w")
        self.jobs_tree.column("output", width=360, anchor="w")
        self.jobs_tree.column("status", width=120, anchor="center")
        self.jobs_tree.column("detail", width=300, anchor="w")

        self.jobs_tree.tag_configure("Queued", foreground="#BFD5EF")
        self.jobs_tree.tag_configure("Running", foreground="#8ED1FF")
        self.jobs_tree.tag_configure("Done", foreground="#9BF0C7")
        self.jobs_tree.tag_configure("Failed", foreground="#FF9FA6")
        self.jobs_tree.tag_configure("Stopped", foreground="#E4C38C")

        y_scroll = ttk.Scrollbar(card, orient="vertical", command=self.jobs_tree.yview)
        x_scroll = ttk.Scrollbar(card, orient="horizontal", command=self.jobs_tree.xview)
        self.jobs_tree.configure(yscrollcommand=y_scroll.set, xscrollcommand=x_scroll.set)

        self.jobs_tree.grid(row=1, column=0, sticky="nsew")
        y_scroll.grid(row=1, column=1, sticky="ns")
        x_scroll.grid(row=2, column=0, sticky="ew")

    def _build_log_card(self, parent: tk.Widget) -> None:
        card = ttk.LabelFrame(parent, text=" Log ", style="Card.TLabelframe", padding=10)
        card.grid(row=3, column=0, sticky="nsew", padx=18, pady=(0, 12))
        card.grid_columnconfigure(0, weight=1)
        card.grid_rowconfigure(0, weight=1)

        self.log_text = tk.Text(
            card,
            bg="#0D192A",
            fg="#DCEAFE",
            insertbackground="#DCEAFE",
            wrap="word",
            relief="flat",
            borderwidth=0,
            padx=10,
            pady=10,
            height=9,
        )
        log_scroll = ttk.Scrollbar(card, orient="vertical", command=self.log_text.yview)
        self.log_text.configure(yscrollcommand=log_scroll.set, state="disabled")
        self.log_text.grid(row=0, column=0, sticky="nsew")
        log_scroll.grid(row=0, column=1, sticky="ns")

    def _build_footer(self, parent: tk.Widget) -> None:
        footer = tk.Frame(parent, bg="#0F1A2A", padx=18, pady=14)
        footer.grid(row=4, column=0, sticky="ew")
        footer.grid_columnconfigure(2, weight=1)

        self.convert_btn = ttk.Button(footer, text="Convert all", style="Accent.TButton", command=self._start_convert)
        self.convert_btn.grid(row=0, column=0, sticky="w")

        self.stop_btn = ttk.Button(footer, text="Stop", style="Glass.TButton", command=self._request_stop, state="disabled")
        self.stop_btn.grid(row=0, column=1, sticky="w", padx=(10, 18))

        self.progress = ttk.Progressbar(footer, style="Horizontal.TProgressbar", orient="horizontal", mode="determinate")
        self.progress.grid(row=0, column=2, sticky="ew", padx=(0, 12))
        self.progress_label = tk.Label(
            footer,
            textvariable=self.progress_text_var,
            bg="#0F1A2A",
            fg="#AFCAE8",
            font=("Segoe UI", 10),
        )
        self.progress_label.grid(row=0, column=3, sticky="e")

    def _wire_events(self) -> None:
        self.provider_var.trace_add("write", self._on_provider_change)
        self.auto_model_var.trace_add("write", self._on_auto_model_change)
        self.show_key_var.trace_add("write", self._on_show_key_change)
        self.output_dir_var.trace_add("write", self._refresh_output_paths)
        self._on_auto_model_change()
        self._refresh_output_paths()

    def _label(self, parent: tk.Widget, text: str) -> tk.Label:
        return tk.Label(parent, text=text, bg="#132238", fg="#D8E8FC", font=("Segoe UI", 10))

    def _entry(self, parent: tk.Widget, textvar: tk.StringVar, show: str | None = None) -> tk.Entry:
        return tk.Entry(
            parent,
            textvariable=textvar,
            show=show if show else "",
            bg="#0E1C2F",
            fg="#E6F2FF",
            insertbackground="#E6F2FF",
            relief="flat",
            highlightthickness=1,
            highlightbackground="#35577D",
            highlightcolor="#6EA9DA",
        )

    def _on_canvas_resize(self, event: tk.Event) -> None:
        width = max(780, event.width - 48)
        height = max(600, event.height - 48)
        self.bg.itemconfigure(self.surface_window, width=width, height=height)

    def _on_provider_change(self, *_: object) -> None:
        if self.auto_model_var.get():
            provider = self.provider_var.get().strip() or DEFAULT_PROVIDER
            self.model_var.set(default_model_for_provider(provider))

    def _on_auto_model_change(self, *_: object) -> None:
        auto_model = self.auto_model_var.get()
        state = "disabled" if auto_model else "normal"
        self.model_entry.configure(state=state)
        if auto_model:
            provider = self.provider_var.get().strip() or DEFAULT_PROVIDER
            self.model_var.set(default_model_for_provider(provider))

    def _on_show_key_change(self, *_: object) -> None:
        self.api_key_entry.configure(show="" if self.show_key_var.get() else "*")

    def _pick_output_dir(self) -> None:
        path = filedialog.askdirectory(title="Select result folder")
        if path:
            self.output_dir_var.set(path)

    def _pick_asset_dir(self) -> None:
        path = filedialog.askdirectory(title="Select asset base directory")
        if path:
            self.asset_dir_var.set(path)

    def _pick_dump_raw_dir(self) -> None:
        path = filedialog.askdirectory(title="Select raw dump directory")
        if path:
            self.dump_raw_var.set(path)

    def _add_files(self) -> None:
        paths = filedialog.askopenfilenames(
            title="Select exam files",
            filetypes=[
                ("Exam files", "*.docx *.txt *.md"),
                ("Word files", "*.docx"),
                ("Text files", "*.txt *.md"),
                ("All files", "*.*"),
            ],
        )
        if not paths:
            return
        self._append_paths([Path(p) for p in paths])

    def _add_folder(self) -> None:
        folder = filedialog.askdirectory(title="Select folder with exam files")
        if not folder:
            return
        root_dir = Path(folder)
        collected = [
            p
            for p in root_dir.rglob("*")
            if p.is_file() and p.suffix.lower() in SUPPORTED_EXTENSIONS
        ]
        self._append_paths(sorted(collected))

    def _append_paths(self, paths: list[Path]) -> None:
        existing = {job.input_path.resolve() for job in self.jobs}
        existing_output_targets = {str(job.output_path.resolve()).lower() for job in self.jobs}
        added = 0
        skipped = 0

        for path in paths:
            if not path.exists() or path.suffix.lower() not in SUPPORTED_EXTENSIONS:
                skipped += 1
                continue
            resolved = path.resolve()
            if resolved in existing:
                skipped += 1
                continue
            output_path = self._compute_output_path(path)
            output_key = str(output_path.resolve()).lower()
            if output_key in existing_output_targets:
                skipped += 1
                continue
            self.jobs.append(Job(input_path=path, output_path=output_path))
            existing.add(resolved)
            existing_output_targets.add(output_key)
            added += 1

        self._render_jobs_table()
        if added:
            self._log(f"Added {added} file(s) to queue.")
        if skipped:
            self._log(f"Skipped {skipped} file(s) (unsupported or duplicate).")

    def _remove_selected(self) -> None:
        selected = set(self.jobs_tree.selection())
        if not selected:
            return
        self.jobs = [job for job in self.jobs if job.tree_id not in selected]
        self._render_jobs_table()
        self._log(f"Removed {len(selected)} selected item(s).")

    def _clear_jobs(self) -> None:
        if self.running:
            return
        count = len(self.jobs)
        self.jobs.clear()
        self._render_jobs_table()
        self.progress.configure(value=0, maximum=1)
        self.progress_text_var.set("Ready")
        self._log(f"Cleared queue ({count} item(s)).")

    def _render_jobs_table(self) -> None:
        self.jobs_tree.delete(*self.jobs_tree.get_children())
        for index, job in enumerate(self.jobs, start=1):
            job.tree_id = self.jobs_tree.insert(
                "",
                "end",
                values=(
                    index,
                    str(job.input_path),
                    str(job.output_path),
                    job.status,
                    job.message,
                ),
                tags=(job.status,),
            )

    def _refresh_output_paths(self, *_: object) -> None:
        for job in self.jobs:
            job.output_path = self._compute_output_path(job.input_path)
        if self.jobs:
            self._render_jobs_table()

    def _compute_output_path(self, input_path: Path) -> Path:
        if input_path.suffix.lower() == ".docx":
            asset_dir = self._resolve_asset_dir(input_path)
            if asset_dir is not None:
                return asset_dir / "exam.json"
        result_base = self._resolve_result_base_dir(input_path)
        output_bucket = self._output_bucket_name(input_path)
        return result_base / output_bucket / "exam.json"

    def _resolve_asset_dir(self, input_path: Path) -> Path | None:
        if input_path.suffix.lower() != ".docx":
            return None
        output_bucket = self._output_bucket_name(input_path)
        output_base = self.output_dir_var.get().strip()
        if output_base:
            return Path(output_base).expanduser() / output_bucket

        raw_asset_base = self.asset_dir_var.get().strip()
        if raw_asset_base:
            return Path(raw_asset_base).expanduser() / output_bucket

        input_root = self._find_input_root(input_path)
        if input_root is not None:
            return input_root.parent / "output" / output_bucket

        return input_path.parent / output_bucket

    def _resolve_dump_raw_path(self, input_path: Path) -> Path | None:
        raw_dump_dir = self.dump_raw_var.get().strip()
        if not raw_dump_dir:
            return None
        return Path(raw_dump_dir).expanduser() / f"{input_path.stem}.raw.md"

    def _set_controls_running(self, running: bool) -> None:
        self.running = running
        normal_state = "disabled" if running else "normal"

        self.provider_combo.configure(state="disabled" if running else "readonly")
        self.auto_model_check.configure(state=normal_state)
        if running:
            self.model_entry.configure(state="disabled")
        elif self.auto_model_var.get():
            self.model_entry.configure(state="disabled")
        else:
            self.model_entry.configure(state="normal")
        self.api_key_entry.configure(state=normal_state)
        self.show_key_check.configure(state=normal_state)
        self.remember_key_check.configure(state=normal_state)
        self.output_dir_entry.configure(state=normal_state)
        self.asset_dir_entry.configure(state=normal_state)
        self.dump_raw_entry.configure(state=normal_state)
        self.retries_spin.configure(state=normal_state)

        self.add_files_btn.configure(state=normal_state)
        self.add_folder_btn.configure(state=normal_state)
        self.remove_selected_btn.configure(state=normal_state)
        self.clear_btn.configure(state=normal_state)
        self.convert_btn.configure(state="disabled" if running else "normal")
        self.stop_btn.configure(state="normal" if running else "disabled")

    def _start_convert(self) -> None:
        if self.running:
            return
        if not self.jobs:
            messagebox.showwarning("No files", "Please add at least one input file.")
            return

        try:
            retries = int(self.max_retries_var.get())
            if retries < 0:
                raise ValueError
        except Exception:
            messagebox.showerror("Invalid retries", "Max retries must be a non-negative integer.")
            return

        try:
            self._save_settings()
        except Exception as exc:
            self._log(f"Could not save settings: {exc}")

        self._refresh_output_paths()
        self.stop_event.clear()
        self._set_controls_running(True)
        self.progress.configure(value=0, maximum=max(1, len(self.jobs)))
        self.progress_text_var.set(f"0/{len(self.jobs)}")

        provider = self.provider_var.get().strip() or DEFAULT_PROVIDER
        model: str | None
        if self.auto_model_var.get():
            model = None
        else:
            model_value = self.model_var.get().strip()
            model = model_value or None

        api_key = self.api_key_var.get().strip() or None
        config = {
            "provider": provider,
            "model": model,
            "api_key": api_key,
            "max_retries": retries,
        }

        self._log(
            "Starting batch conversion: "
            f"{len(self.jobs)} file(s), provider={provider}, model={model or 'default'}."
        )

        self.worker_thread = threading.Thread(target=self._worker_convert, args=(config,), daemon=True)
        self.worker_thread.start()

    def _request_stop(self) -> None:
        if not self.running:
            return
        self.stop_event.set()
        self._log("Stop requested. Current file will finish, remaining files will be marked stopped.")

    def _worker_convert(self, config: dict[str, object]) -> None:
        total = len(self.jobs)
        success_count = 0
        fail_count = 0
        done_count = 0

        for index, job in enumerate(self.jobs, start=1):
            if self.stop_event.is_set():
                break

            self.queue_from_worker.put(
                {
                    "type": "job_update",
                    "index": index,
                    "status": "Running",
                    "message": "Converting...",
                }
            )

            try:
                input_path = job.input_path.resolve()
                output_path = job.output_path.resolve()
                asset_dir = self._resolve_asset_dir(input_path)
                dump_raw = self._resolve_dump_raw_path(input_path)

                exam_data = convert_exam_file(
                    input_path=input_path,
                    output_path=output_path,
                    provider=str(config["provider"]),
                    model=config["model"],
                    api_key=config["api_key"],
                    max_retries=int(config["max_retries"]),
                    asset_dir=asset_dir.resolve() if asset_dir else None,
                    dump_raw=dump_raw.resolve() if dump_raw else None,
                )
                exam_id = str(exam_data.get("id") or output_path.stem)
                success_count += 1
                done_count += 1
                self.queue_from_worker.put(
                    {
                        "type": "job_update",
                        "index": index,
                        "status": "Done",
                        "message": f"id={exam_id}",
                    }
                )
                self.queue_from_worker.put(
                    {
                        "type": "log",
                        "message": f"[{index}/{total}] OK {input_path.name} -> {output_path.name}",
                    }
                )
            except Exception as exc:
                fail_count += 1
                done_count += 1
                short_error = str(exc).replace("\n", " ").strip()
                self.queue_from_worker.put(
                    {
                        "type": "job_update",
                        "index": index,
                        "status": "Failed",
                        "message": short_error[:240],
                    }
                )
                self.queue_from_worker.put(
                    {
                        "type": "log",
                        "message": f"[{index}/{total}] FAIL {job.input_path.name}: {short_error}",
                    }
                )
                self.queue_from_worker.put(
                    {
                        "type": "debug",
                        "message": traceback.format_exc(),
                    }
                )
            finally:
                self.queue_from_worker.put(
                    {
                        "type": "progress",
                        "done": done_count,
                        "total": total,
                    }
                )

        if self.stop_event.is_set():
            for index in range(done_count + 1, total + 1):
                self.queue_from_worker.put(
                    {
                        "type": "job_update",
                        "index": index,
                        "status": "Stopped",
                        "message": "Skipped by user stop request",
                    }
                )

        self.queue_from_worker.put(
            {
                "type": "finished",
                "success": success_count,
                "failed": fail_count,
                "done": done_count,
                "total": total,
                "stopped": bool(self.stop_event.is_set()),
            }
        )

    def _poll_worker_queue(self) -> None:
        try:
            while True:
                event = self.queue_from_worker.get_nowait()
                self._handle_worker_event(event)
        except queue.Empty:
            pass
        finally:
            self.root.after(80, self._poll_worker_queue)

    def _handle_worker_event(self, event: dict[str, object]) -> None:
        event_type = event.get("type")
        if event_type == "job_update":
            index = int(event["index"])
            status = str(event["status"])
            message = str(event.get("message", ""))
            self._update_job(index=index, status=status, message=message)
            return
        if event_type == "progress":
            done = int(event["done"])
            total = int(event["total"])
            self.progress.configure(value=done, maximum=max(1, total))
            self.progress_text_var.set(f"{done}/{total}")
            return
        if event_type == "log":
            self._log(str(event.get("message", "")))
            return
        if event_type == "debug":
            self._log_debug(str(event.get("message", "")))
            return
        if event_type == "finished":
            self._set_controls_running(False)
            success = int(event.get("success", 0))
            failed = int(event.get("failed", 0))
            done = int(event.get("done", 0))
            total = int(event.get("total", 0))
            stopped = bool(event.get("stopped", False))
            summary = f"Finished: {success} success, {failed} failed, {done}/{total} processed."
            if stopped:
                summary += " Batch stopped by user."
            self._log(summary)
            self.progress_text_var.set(summary)
            if failed > 0:
                messagebox.showwarning("Batch finished with errors", summary)
            else:
                messagebox.showinfo("Batch finished", summary)
            return

    def _update_job(self, index: int, status: str, message: str) -> None:
        if index < 1 or index > len(self.jobs):
            return
        job = self.jobs[index - 1]
        job.status = status
        job.message = message
        if job.tree_id and self.jobs_tree.exists(job.tree_id):
            self.jobs_tree.item(
                job.tree_id,
                values=(
                    index,
                    str(job.input_path),
                    str(job.output_path),
                    job.status,
                    job.message,
                ),
                tags=(job.status,),
            )

    def _log(self, message: str) -> None:
        timestamp = datetime.now().strftime("%H:%M:%S")
        line = f"[{timestamp}] {message}\n"
        self.log_text.configure(state="normal")
        self.log_text.insert("end", line)
        self.log_text.see("end")
        self.log_text.configure(state="disabled")

    def _log_debug(self, message: str) -> None:
        if not message:
            return
        preview = message.strip()
        if len(preview) > 1200:
            preview = preview[:1200] + "\n... (truncated)"
        self._log(f"DEBUG: {preview}")

    def _on_close(self) -> None:
        if self.running:
            should_close = messagebox.askyesno(
                "Close converter",
                "A batch is running. Stop now and close?",
            )
            if not should_close:
                return
            self.stop_event.set()
        try:
            self._save_settings()
        except Exception:
            pass
        self.root.destroy()


def run() -> None:
    root = tk.Tk()
    app = ExamConverterGUI(root)
    root.mainloop()


if __name__ == "__main__":
    run()
