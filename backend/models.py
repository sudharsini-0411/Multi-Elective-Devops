from werkzeug.security import generate_password_hash, check_password_hash as _check_password_hash
from supabase import create_client, ClientOptions
from dotenv import load_dotenv
import os

load_dotenv()

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')

opts = ClientOptions(headers={'Connection': 'close'})
supabase = create_client(SUPABASE_URL, SUPABASE_KEY, options=opts)

def check_password_hash(hash_val, password):
    return _check_password_hash(hash_val, password)

# ── Config ────────────────────────────────────────────────────────────────────
def get_config_value(key, default=None):
    res = supabase.table('system_config').select('value').eq('key', key).execute()
    if res.data:
        return res.data[0]['value']
    return default

def set_config_value(key, value):
    existing = supabase.table('system_config').select('key').eq('key', key).execute()
    if existing.data:
        supabase.table('system_config').update({'value': str(value) if value is not None else ''}).eq('key', key).execute()
    else:
        supabase.table('system_config').insert({'key': key, 'value': str(value) if value is not None else ''}).execute()

# ── Users ─────────────────────────────────────────────────────────────────────
def create_user(username, password, role, historical_satisfaction=1.0, max_electives=1, name=None, roll_no=None):
    try:
        res = supabase.table('users').insert({
            'username': username,
            'password_hash': generate_password_hash(password),
            'role': role,
            'historical_satisfaction': float(historical_satisfaction),
            'max_electives': int(max_electives),
            'name': name,
            'roll_no': roll_no
        }).execute()
        return str(res.data[0]['id']) if res.data else None
    except Exception:
        return None

def get_user_by_username(username):
    res = supabase.table('users').select('*').eq('username', username).execute()
    if res.data:
        d = res.data[0]
        d['id'] = str(d['id'])
        return d
    return None

def get_user_by_id(user_id):
    res = supabase.table('users').select('*').eq('id', user_id).execute()
    if res.data:
        d = res.data[0]
        d['id'] = str(d['id'])
        return d
    return None

def get_all_students():
    res = supabase.table('users').select('*').eq('role', 'student').execute()
    students = []
    for d in res.data:
        d['id'] = str(d['id'])
        students.append(d)
    return students

def update_user(user_id, username, password=None, historical_satisfaction=None, max_electives=None, name=None, roll_no=None):
    try:
        upd = {'username': username}
        if password:
            upd['password_hash'] = generate_password_hash(password)
        if historical_satisfaction is not None:
            upd['historical_satisfaction'] = float(historical_satisfaction)
        if max_electives is not None:
            upd['max_electives'] = int(max_electives)
        if name is not None:
            upd['name'] = name
        if roll_no is not None:
            upd['roll_no'] = roll_no
        supabase.table('users').update(upd).eq('id', user_id).execute()
        return True
    except Exception:
        return False

def delete_user(user_id):
    try:
        supabase.table('preferences').delete().eq('user_id', user_id).execute()
        supabase.table('allocations').delete().eq('user_id', user_id).execute()
        supabase.table('satisfaction_history').delete().eq('user_id', user_id).execute()
        supabase.table('users').delete().eq('id', user_id).execute()
        return True
    except Exception:
        return False

# ── Electives ─────────────────────────────────────────────────────────────────
def create_elective(code, name, capacity, instructor):
    try:
        res = supabase.table('electives').insert({
            'code': code, 'name': name,
            'capacity': int(capacity), 'seats_remaining': int(capacity),
            'instructor': instructor
        }).execute()
        return str(res.data[0]['id']) if res.data else None
    except Exception:
        return None

def get_all_electives():
    res = supabase.table('electives').select('*').execute()
    electives = []
    for d in res.data:
        d['id'] = str(d['id'])
        electives.append(d)
    return electives

def get_elective_by_id(elective_id):
    res = supabase.table('electives').select('*').eq('id', elective_id).execute()
    if res.data:
        d = res.data[0]
        d['id'] = str(d['id'])
        return d
    return None

def update_elective(elective_id, code, name, capacity, instructor):
    try:
        el = get_elective_by_id(elective_id)
        if not el:
            return False
        diff = int(capacity) - el['capacity']
        new_seats = max(0, el['seats_remaining'] + diff)
        supabase.table('electives').update({
            'code': code, 'name': name, 'capacity': int(capacity),
            'seats_remaining': new_seats, 'instructor': instructor
        }).eq('id', elective_id).execute()
        return True
    except Exception:
        return False

def delete_elective(elective_id):
    try:
        supabase.table('preferences').delete().eq('elective_id', elective_id).execute()
        supabase.table('allocations').delete().eq('elective_id', elective_id).execute()
        supabase.table('electives').delete().eq('id', elective_id).execute()
    except Exception:
        pass

# ── Preferences ───────────────────────────────────────────────────────────────
def save_preferences(user_id, preference_list):
    try:
        supabase.table('preferences').delete().eq('user_id', user_id).execute()
        for pref in preference_list:
            supabase.table('preferences').insert({
                'user_id': user_id,
                'elective_id': pref['elective_id'],
                'points': int(pref['points']),
                'rank': int(pref['rank'])
            }).execute()
        return True
    except Exception:
        return False

def get_student_preferences(user_id):
    res = supabase.table('preferences').select('*').eq('user_id', user_id).order('points', desc=True).execute()
    result = []
    for p in res.data:
        el = get_elective_by_id(str(p['elective_id']))
        result.append({
            'id': str(p['id']),
            'user_id': str(p['user_id']),
            'elective_id': str(p['elective_id']),
            'points': p['points'],
            'rank': p['rank'],
            'code': el['code'] if el else '',
            'name': el['name'] if el else '',
            'instructor': el['instructor'] if el else '',
            'capacity': el['capacity'] if el else 0,
            'seats_remaining': el['seats_remaining'] if el else 0
        })
    return result

# ── Allocations ───────────────────────────────────────────────────────────────
def get_allocations_by_semester(semester):
    res = supabase.table('allocations').select('*').eq('semester', semester).execute()
    if not res.data:
        return []
    
    users_res = supabase.table('users').select('id, username').execute()
    users_map = {str(u['id']): u for u in users_res.data}
    
    electives_res = supabase.table('electives').select('id, code, name').execute()
    electives_map = {str(e['id']): e for e in electives_res.data}
    
    result = []
    for a in res.data:
        user = users_map.get(str(a['user_id']))
        el = electives_map.get(str(a['elective_id']))
        result.append({
            'id': str(a['id']),
            'user_id': str(a['user_id']),
            'elective_id': str(a['elective_id']),
            'semester': a['semester'],
            'username': user['username'] if user else '',
            'code': el['code'] if el else '',
            'name': el['name'] if el else '',
            'created_at': a.get('created_at')
        })
    return result

def get_all_allocations():
    res = supabase.table('allocations').select('*').execute()
    if not res.data:
        return []
    
    users_res = supabase.table('users').select('id, username').execute()
    users_map = {str(u['id']): u for u in users_res.data}
    
    electives_res = supabase.table('electives').select('id, code, name').execute()
    electives_map = {str(e['id']): e for e in electives_res.data}
    
    result = []
    for a in res.data:
        user = users_map.get(str(a['user_id']))
        el = electives_map.get(str(a['elective_id']))
        result.append({
            'id': str(a['id']),
            'user_id': str(a['user_id']),
            'elective_id': str(a['elective_id']),
            'semester': a['semester'],
            'username': user['username'] if user else '',
            'code': el['code'] if el else '',
            'name': el['name'] if el else '',
            'created_at': a.get('created_at')
        })
    return result

def get_student_allocation_history(user_id):
    res = supabase.table('allocations').select('*').eq('user_id', user_id).order('semester').execute()
    if not res.data:
        return []
    
    electives_res = supabase.table('electives').select('id, code, name, instructor').execute()
    electives_map = {str(e['id']): e for e in electives_res.data}
    
    result = []
    for a in res.data:
        el = electives_map.get(str(a['elective_id']))
        result.append({
            'semester': a['semester'],
            'code': el['code'] if el else '',
            'name': el['name'] if el else '',
            'instructor': el['instructor'] if el else ''
        })
    return result

# ── Satisfaction History ──────────────────────────────────────────────────────
def get_student_satisfaction_history(user_id):
    res = supabase.table('satisfaction_history').select('*').eq('user_id', user_id).order('id').execute()
    return [{
        'id': str(h['id']),
        'user_id': str(h['user_id']),
        'semester': h['semester'],
        'satisfaction_score': h['satisfaction_score'],
        'historical_satisfaction_after': h['historical_satisfaction_after']
    } for h in res.data]

def add_satisfaction_history(user_id, semester, satisfaction_score, historical_satisfaction_after):
    try:
        res = supabase.table('satisfaction_history').insert({
            'user_id': user_id,
            'semester': semester,
            'satisfaction_score': float(satisfaction_score),
            'historical_satisfaction_after': float(historical_satisfaction_after)
        }).execute()
        return str(res.data[0]['id']) if res.data else None
    except Exception:
        return None

def update_satisfaction_history(record_id, satisfaction_score, historical_satisfaction_after):
    try:
        supabase.table('satisfaction_history').update({
            'satisfaction_score': float(satisfaction_score),
            'historical_satisfaction_after': float(historical_satisfaction_after)
        }).eq('id', record_id).execute()
        return True
    except Exception:
        return False

def delete_satisfaction_history(record_id):
    try:
        supabase.table('satisfaction_history').delete().eq('id', record_id).execute()
        return True
    except Exception:
        return False
