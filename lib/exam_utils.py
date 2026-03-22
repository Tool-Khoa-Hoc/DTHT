import json
from pathlib import Path

def load_exam_json(path: Path) -> dict:
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_exam_json(path: Path, data: dict):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def has_local_answers(data: dict) -> bool:
    # 1. Check top-level answer_key
    answer_key = data.get('answer_key')
    if isinstance(answer_key, dict):
        # A dictionary of nulls is considered NO answers
        if any(v is not None for v in answer_key.values()):
            return True
    
    # 2. Check inline correct_answer / correct fields
    for part in data.get('parts', []):
        for q in part.get('questions', []):
            # Single choice / Short answer
            if q.get('correct_answer') is not None:
                return True
            # True/False statements
            if q.get('statements'):
                for s in q.get('statements'):
                    if s.get('correct') is not None:
                        return True
    return False

def extract_answer_key(data: dict) -> dict:
    """Extract answers into a single dict mapping question id to correct answer, in order."""
    ans = {}
    
    # Duyệt theo đúng thứ tự trong mảng 'parts' để đảm bảo tính tuần tự
    for part in data.get('parts', []):
        part_id = part.get('id', '')
        for q in part.get('questions', []):
            q_id = q.get('id')
            if not q_id: continue
            
            # Khóa: 'partId.questionId' hoặc chỉ 'questionId'
            key = f"{part_id}.{q_id}" if part_id else q_id
            
            # Ưu tiên lấy từ top-level answer_key trước (nếu có điền tay)
            # Sau đó mới lấy từ inline correct_answer
            val = data.get('answer_key', {}).get(key)
            
            if val is None:
                if q.get('correct_answer') is not None:
                    val = q['correct_answer']
                elif q.get('statements'):
                    stmt_ans = []
                    has_any = False
                    for stmt in q['statements']:
                        if stmt.get('correct') is not None:
                            has_any = True
                            stmt_ans.append(stmt['correct'])
                        else:
                            stmt_ans.append(None)
                    if has_any:
                        val = stmt_ans
            
            if val is not None:
                ans[key] = val
                    
    return ans

def has_local_answers(exam_data: dict) -> bool:
    return any(
        isinstance(v, (int, dict)) or (isinstance(v, str) and v.strip() != '')
        for v in exam_data.get('answer_key', {}).values()
    )

def has_local_links(exam_data: dict) -> bool:
    return bool(
        exam_data.get('resources', {}).get('solution_url') or 
        exam_data.get('resources', {}).get('video_url') or
        exam_data.get('resources', {}).get('answer_file_url') or
        exam_data.get('resources', {}).get('exam_file_url')
    )

def get_question_count(data: dict) -> int:
    if not isinstance(data.get('parts'), list):
        return 0
    return sum(len(part.get('questions', [])) for part in data['parts'])

def get_subject_ui_meta(subject: str = '') -> dict:
    s = str(subject).lower()
    if 'toán' in s:
        return {'icon': 'functions', 'color': 'from-blue-500 to-indigo-600'}
    if 'lý' in s:
        return {'icon': 'architecture', 'color': 'from-emerald-500 to-teal-600'}
    if 'anh' in s:
        return {'icon': 'language', 'color': 'from-rose-500 to-pink-600'}
    if 'hóa' in s:
        return {'icon': 'science', 'color': 'from-amber-500 to-orange-600'}
    if 'sinh' in s:
        return {'icon': 'biotech', 'color': 'from-green-500 to-lime-600'}
    return {'icon': 'quiz', 'color': 'from-slate-500 to-slate-600'}

def sanitize_exam(data: dict) -> dict:
    # Comment out sensitive top-level fields instead of deleting
    if 'answer_key' in data:
        data['//answer_key'] = data.pop('answer_key')
    
    if 'resources' in data:
        data['//resources'] = data.pop('resources')
    
    # Remove correct answers from questions (these remain deleted for safety)
    for part in data.get('parts', []):
        for q in part.get('questions', []):
            if 'correct_answer' in q:
                del q['correct_answer']
            if 'statements' in q:
                for s in q['statements']:
                    if 'correct' in s:
                        del s['correct']
    return data
