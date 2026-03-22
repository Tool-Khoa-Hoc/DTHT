import sys
import argparse
import json
import shutil
import subprocess
from pathlib import Path
from datetime import datetime
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, MofNCompleteColumn
from rich.prompt import Prompt
from rich import box

# Ensure standard project layout
sys.path.append(str(Path(__file__).parent))

from lib.supabase_utils import (
    upload_exam_data, 
    check_db_links, 
    get_remote_exam_data, 
    get_all_remote_exam_data,
    get_supabase_client, 
    check_db_answers,
    log_sync_event,
    get_recent_sync_logs
)
from lib.exam_utils import (
    load_exam_json, 
    save_exam_json, 
    has_local_answers, 
    has_local_links, 
    sanitize_exam,
    get_question_count,
    get_subject_ui_meta,
    extract_answer_key
)

console = Console()

def print_banner():
    banner_text = "[bold cyan]═══ DTHT EXAM MANAGEMENT CLI ═══[/]\n[dim]Simplified workflow for teachers and developers[/]"
    console.print(Panel(banner_text.strip(), style="bold magenta", border_style="cyan", box=box.DOUBLE))

def collect_exam_files(source: str = "public") -> list[tuple[Path, str]]:
    results = []
    pub_dir = Path("public/data/exams")
    if pub_dir.exists():
        for f in pub_dir.rglob("exam.json"):
            if "backups" not in str(f) and ".temp" not in str(f):
                results.append((f, "public"))
    if source in ("source", "both"):
        src_dir = Path("data-source")
        if src_dir.exists():
            for f in src_dir.rglob("exam.json"):
                results.append((f, "source"))
    results.sort(key=lambda x: str(x[0]))
    return results

def cmd_status(args):
    """Kiểm tra trạng thái đáp án local vs database."""
    public_mode = getattr(args, 'public', False)
    base_dir = Path("public/data/exams") if public_mode else Path("data-source")
    
    if not base_dir.exists():
        console.print(f"[bold red]✘ Lỗi:[/] Không tìm thấy folder {base_dir}", style="red")
        return
        
    found_files = list(base_dir.rglob("exam.json"))
    console.print(f"[dim]Đang quét folder: {base_dir} (Tìm thấy {len(found_files)} file)...[/]")
    
    if not found_files: return

    supabase = None
    try: supabase = get_supabase_client()
    except: pass
    
    table = Table(title=f"🔍 Exam Status ({'[bold green]Public[/]' if public_mode else '[bold yellow]Source[/]'})", box=box.ROUNDED)
    table.add_column("Folder / ID", style="cyan")
    table.add_column("Answers", justify="center")
    table.add_column("Links", justify="center")

    for json_path in found_files:
        rel_dir = json_path.parent.relative_to(base_dir)
        try:
            data = load_exam_json(json_path)
            eid = data.get('id', json_path.parent.name)
            
            local_ans = has_local_answers(data)
            db_ans = check_db_answers(supabase, eid) if supabase else False
            ans_str = ""
            if local_ans: ans_str += "📁 [green]Local[/] "
            if db_ans: ans_str += "☁ [blue]DB[/] "
            if not local_ans and not db_ans: ans_str = "[red]✘ None[/]"
            
            local_link = has_local_links(data)
            db_link = check_db_links(supabase, eid) if supabase else False
            link_str = ""
            if local_link: link_str += "🔗 [green]Local[/] "
            if db_link: link_str += "☁ [blue]DB[/] "
            if not local_link and not db_link: link_str = "[red]✘ None[/]"

            table.add_row(str(rel_dir), ans_str, link_str)
        except Exception as e:
            table.add_row(str(rel_dir), "[yellow]⚠ Lỗi[/]", str(e)[0:30])
            
    console.print(table)

def cmd_sync(args):
    """Sync source -> public (Sanitize logic)."""
    src, pub = Path("data-source"), Path("public/data/exams")
    if not src.exists(): return
    found = list(src.rglob("exam.json"))
    import unicodedata
    for j in found:
        try:
            data = load_exam_json(j)
            sub = data.get('subject', 'khac')
            # Fix split logic
            sub_slug = unicodedata.normalize('NFKD', sub).encode('ascii', 'ignore').decode('utf-8').lower().split()[0]
            target = pub / sub_slug / j.parent.name / "exam.json"
            target.parent.mkdir(parents=True, exist_ok=True)
            sanitized = sanitize_exam(json.loads(json.dumps(data)))
            save_exam_json(target, sanitized)
            for f in j.parent.iterdir():
                if f.name != 'exam.json':
                    dest = target.parent / f.name
                    if not dest.exists() or f.stat().st_mtime > dest.stat().st_mtime:
                        shutil.copy2(f, dest)
            console.print(f" [green]✔[/] Distributed {j.parent.name}")
        except Exception as e: console.print(f" [red]✘[/] Error {j.parent.name}: {e}")

def cmd_sync_db(args):
    """Smart Sync local -> Supabase."""
    supabase = get_supabase_client()
    files = collect_exam_files(getattr(args, 'source', 'public'))
    table = Table(title="Upload to Database (Supabase)", box=box.ROUNDED)
    table.add_column("Exam ID", style="cyan")
    table.add_column("Status")
    table.add_column("Sync At", style="dim")
    
    apply, force = getattr(args, 'apply', False), getattr(args, 'force', False)
    
    for (json_path, _) in files:
        try:
            data = load_exam_json(json_path)
            eid = data.get("id", json_path.parent.name)
            key = extract_answer_key(data) or data.get("//answer_key")
            if not key: continue
            
            remote = get_remote_exam_data(supabase, eid)
            rkey = remote.get("answer_key", {})
            last = remote.get("last_synced_at", "—")
            
            if not force and rkey and key == rkey:
                table.add_row(eid, "[yellow]⊘ Cân bằng[/]", last)
                continue
                
            if apply:
                upload_exam_data(supabase, data, json_path)
                log_sync_event(supabase, eid, "success", "upload")
                # Auto delete
                for k in ["answer_key", "//answer_key", "resources", "//resources"]:
                    if k in data:
                        del data[k]
                save_exam_json(json_path, data)
                table.add_row(eid, "[bold green]✔ Done & Deleted keys[/]", "Now")
            else:
                table.add_row(eid, "[cyan]→ Chờ upload[/]", last)
        except Exception as e: table.add_row(json_path.parent.name, f"[red]Lỗi: {e}[/]", "—")
    console.print(table)

def cmd_delete_keys(args):
    files = collect_exam_files()
    for (p, _) in files:
        try:
            d = load_exam_json(p); ch = False
            for k in ["answer_key", "//answer_key", "resources", "//resources"]:
                if k in d:
                    del d[k]
                    ch = True
            if ch: save_exam_json(p, d); console.print(f" [green]✔[/] Xóa đáp án & resource khỏi {p.parent.name}")
        except: pass

def cmd_logs(args):
    supabase = get_supabase_client()
    logs = get_recent_sync_logs(supabase)
    table = Table(title="Sync Logs", box=box.MINIMAL_DOUBLE_HEAD)
    table.add_column("Time"); table.add_column("Exam ID", style="cyan"); table.add_column("Action"); table.add_column("Status")
    for l in logs:
        ts = l.get('created_at', '—')
        st = "[green]✔[/]" if l.get('status') == 'success' else "[red]✘[/]"
        table.add_row(ts, l.get('exam_id'), l.get('action'), st)
    console.print(table)

def cmd_build(args):
    pub = Path("public/data/exams")
    idx = []
    for sf in [f for f in pub.iterdir() if f.is_dir()]:
        for ef in sf.iterdir():
            if not ef.is_dir(): continue
            jp = ef / "exam.json"
            if not jp.exists(): continue
            try:
                d = load_exam_json(jp)
                ui = get_subject_ui_meta(d.get('subject', ''))
                idx.append({"id": d.get('id', ef.name), "title": d.get('title'), "subject": d.get('subject'), "color": ui.get('color'), "icon": ui.get('icon'), "questions": get_question_count(d)})
            except: pass
    save_exam_json(pub / "index.json", idx)
    console.print(f"[bold green]✔ Built index.json ({len(idx)} items)[/]")

def cmd_git(args):
    """Commit and Push to GitHub."""
    import subprocess
    msg = Prompt.ask("Enter commit message", default="Update from dtht-cli")
    try:
        console.print("[cyan]Adding changes...[/]")
        subprocess.run(["git", "add", "."], check=True)
        console.print("[cyan]Committing...[/]")
        subprocess.run(["git", "commit", "-m", msg], check=True)
        console.print("[cyan]Pushing...[/]")
        subprocess.run(["git", "push"], check=True)
        console.print("[bold green]✔ Successfully pushed to GitHub![/]")
    except Exception as e:
        console.print(f"[bold red]✘ Git Error:[/][red] {str(e)}[/]")

def cmd_backup(args):
    """Backup entire exam_keys table to backup/ directory."""
    try:
        supabase = get_supabase_client()
        backup_dir = Path("backup")
        backup_dir.mkdir(exist_ok=True)
        
        with console.status("[cyan]Đang tải dữ liệu từ Supabase...[/]"):
            records = get_all_remote_exam_data(supabase)
        
        if not records:
            console.print("[yellow]⚠ Không có dữ liệu để backup.[/]")
            return
            
        for record in records:
            eid = record.get('exam_id', 'unknown')
            save_path = backup_dir / f"{eid}.json"
            save_exam_json(save_path, record)
            
        console.print(f"[bold green]✔ Đã backup {len(records)} bản ghi vào thư mục 'backup/'[/]")
    except Exception as e:
        console.print(f"[bold red]✘ Lỗi backup:[/] {e}")

def main():
    if len(sys.argv) == 1:
        while True:
            print_banner()
            menu = Table(box=box.ROUNDED, show_header=True)
            menu.add_column("No."); menu.add_column("Cmd"); menu.add_column("Desc")
            menu.add_row("1", "status", "Check status (local vs DB)"); menu.add_row("2", "sync", "Distribute to public/"); menu.add_row("3", "sync-db", "Upload keys to Database"); menu.add_row("4", "delete-keys", "Xóa đáp án & resource khỏi JSON"); menu.add_row("5", "history", "View sync logs"); menu.add_row("6", "build", "Rebuild index.json"); menu.add_row("7", "push", "Push to GitHub"); menu.add_row("8", "backup", "Backup Database"); menu.add_row("0", "exit", "Exit")
            console.print(menu)
            c = Prompt.ask("Select action", choices=[str(i) for i in range(9)] + ["exit"])
            from argparse import Namespace
            if c == "1": cmd_status(Namespace(public=(Prompt.ask("Check public?", choices=["y","n"], default="n")=="y")))
            elif c == "2": cmd_sync(Namespace())
            elif c == "3":
                a = Prompt.ask("Apply to Database?", choices=["y","n"], default="n") == "y"
                cmd_sync_db(Namespace(apply=a, force=False, source="public"))
            elif c == "4":
                if Prompt.ask("Bạn có chắc chắn muốn xóa đáp án và resource khỏi JSON?", choices=["y","n"], default="n") == "y":
                    cmd_delete_keys(Namespace())
            elif c == "5": cmd_logs(Namespace())
            elif c == "6": cmd_build(Namespace())
            elif c == "7": cmd_git(Namespace())
            elif c == "8": cmd_backup(Namespace())
            elif c == "0" or c == "exit": break
            console.print("\n" + "─" * 40 + "\n")
        return
    p = argparse.ArgumentParser(); sub = p.add_subparsers(dest="cmd")
    st = sub.add_parser("status"); st.add_argument("--public", action="store_true")
    sub.add_parser("sync"); db = sub.add_parser("sync-db"); db.add_argument("--apply", action="store_true")
    sub.add_parser("delete-keys"); sub.add_parser("logs"); sub.add_parser("build"); sub.add_parser("push")
    sub.add_parser("backup")
    a = p.parse_args()
    if a.cmd == "status": cmd_status(a)
    elif a.cmd == "sync": cmd_sync(a)
    elif a.cmd == "sync-db": cmd_sync_db(a)
    elif a.cmd == "delete-keys": cmd_delete_keys(a)
    elif a.cmd == "logs": cmd_logs(a)
    elif a.cmd == "build": cmd_build(a)
    elif a.cmd == "push": cmd_git(a)
    elif a.cmd == "backup": cmd_backup(a)

if __name__ == "__main__":
    main()
