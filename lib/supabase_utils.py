import os
from supabase import create_client, Client
from typing import Optional
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

def get_supabase_client() -> Client:
    url = os.getenv("VITE_SUPABASE_URL")
    key = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise ValueError("Missing VITE_SUPABASE_URL and SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY in .env")
    return create_client(url, key)

def check_db_answers(supabase: Client, exam_id: str) -> bool:
    try:
        res = supabase.table('exam_keys').select('answer_key').eq('exam_id', exam_id).execute()
        return bool(res.data and res.data[0].get('answer_key'))
    except Exception:
        return False

def check_db_links(supabase: Client, exam_id: str) -> bool:
    try:
        res = supabase.table('exams').select('solution_url, video_url').eq('id', exam_id).execute()
        if res.data:
            item = res.data[0]
            return bool(item.get('solution_url') or item.get('video_url'))
        return False
    except Exception:
        return False

from lib.exam_utils import load_exam_json, save_exam_json, extract_answer_key

def get_remote_exam_data(supabase, exam_id: str) -> dict:
    try:
        res = supabase.table('exam_keys').select('answer_key, resources, last_synced_at').eq('exam_id', exam_id).execute()
        if res.data:
            return res.data[0]
    except Exception:
        pass
    return {}

def get_all_remote_exam_data(supabase: Client) -> list:
    try:
        res = supabase.table('exam_keys').select('*').execute()
        return res.data or []
    except Exception:
        return []

def upload_exam_data(supabase: Client, exam_data: dict, exam_path: Path) -> bool:
    """Upload answer key to exam_keys and update solution links in exams table."""
    from datetime import datetime
    exam_id = exam_data.get('id', exam_path.parent.name)
    answer_key = extract_answer_key(exam_data)
    resources = exam_data.get('resources', {})
    
    # 1. Update/Upsert exam_keys (always upsert to clear stale data)
    payload = {
        'exam_id': exam_id,
        'answer_key': answer_key,
        'resources': resources,
        'last_synced_at': datetime.now().isoformat()
    }
    
    try:
        supabase.table('exam_keys').upsert(payload).execute()
    except Exception as e:
        # Fallback if last_synced_at doesn't exist
        if "last_synced_at" in str(e):
            payload.pop('last_synced_at', None)
            supabase.table('exam_keys').upsert(payload).execute()
        else:
            raise e

    # 2. Update metadata in exams table
    update_fields = {}
    if resources.get('solution_url'):
        update_fields['solution_url'] = resources['solution_url']
    if resources.get('video_url'):
        update_fields['video_url'] = resources['video_url']
    
    if update_fields:
        supabase.table('exams').update(update_fields).eq('id', exam_id).execute()
        
    return True

def log_sync_event(supabase: Client, exam_id: str, status: str, action: str, details: Optional[dict] = None):
    """Log a sync event to the sync_logs table."""
    try:
        payload = {
            'exam_id': exam_id,
            'status': status,
            'action': action,
            'details': details or {}
        }
        supabase.table('sync_logs').insert(payload).execute()
    except Exception:
        # Ignore logging errors to avoid blocking the main flow
        pass

def get_recent_sync_logs(supabase: Client, limit: int = 10) -> list:
    """Fetch the most recent sync logs."""
    try:
        res = supabase.table('sync_logs').select('*').order('created_at', desc=True).limit(limit).execute()
        return res.data or []
    except Exception:
        return []
