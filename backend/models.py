from pymongo import MongoClient
from werkzeug.security import generate_password_hash, check_password_hash as _check_password_hash
from bson import ObjectId
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

# ── MongoDB ──────────────────────────────────────────────────────────────────
MONGO_URI = os.environ.get('MONGO_URI', 'mongodb://localhost:27017/')
DB_NAME = os.environ.get('DB_NAME', 'fairelect')

client = MongoClient(MONGO_URI)
mongo = client[DB_NAME]

# Collections
users_col = mongo['users']
electives_col = mongo['electives']
preferences_col = mongo['preferences']
allocations_col = mongo['allocations']
satisfaction_col = mongo['satisfaction_history']
config_col = mongo['system_config']

# Ensure unique indexes
users_col.create_index('username', unique=True)
electives_col.create_index('code', unique=True)

# ── Supabase ─────────────────────────────────────────────────────────────────
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')
supabase = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None

def check_password_hash(hash_val, password):
    return _check_password_hash(hash_val, password)

# ── ID helpers ──────────────────────────────────────────────────────────────
def _str(oid):
    return str(oid)

def _user_out(doc):
    if not doc:
        return None
    doc['id'] = _str(doc['_id'])
    doc.pop('_id', None)
    return doc

def _elective_out(doc):
    if not doc:
        return None
    doc['id'] = _str(doc['_id'])
    doc.pop('_id', None)
    return doc

# ── Config ───────────────────────────────────────────────────────────────────
def get_config_value(key, default=None):
    doc = config_col.find_one({'key': key})
    return doc['value'] if doc else default

def set_config_value(key, value):
    config_col.update_one({'key': key}, {'$set': {'value': str(value) if value is not None else ''}}, upsert=True)

# ── Users ────────────────────────────────────────────────────────────────────
def create_user(username, password, role, historical_satisfaction=0.0, max_electives=1, name=None, roll_no=None):
    try:
        result = users_col.insert_one({
            'username': username,
            'password_hash': generate_password_hash(password),
            'role': role,
            'historical_satisfaction': float(historical_satisfaction),
            'max_electives': int(max_electives),
            'name': name,
            'roll_no': roll_no
        })
        return _str(result.inserted_id)
    except Exception:
        return None

def get_user_by_username(username):
    return _user_out(users_col.find_one({'username': username}))

def get_user_by_id(user_id):
    try:
        return _user_out(users_col.find_one({'_id': ObjectId(user_id)}))
    except Exception:
        return None

def get_all_students():
    return [_user_out(s) for s in users_col.find({'role': 'student'})]

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
        users_col.update_one({'_id': ObjectId(user_id)}, {'$set': upd})
        return True
    except Exception:
        return False

def delete_user(user_id):
    try:
        users_col.delete_one({'_id': ObjectId(user_id)})
        preferences_col.delete_many({'user_id': user_id})
        allocations_col.delete_many({'user_id': user_id})
        satisfaction_col.delete_many({'user_id': user_id})
        return True
    except Exception:
        return False

# ── Electives ────────────────────────────────────────────────────────────────
def create_elective(code, name, capacity, instructor):
    try:
        result = electives_col.insert_one({
            'code': code,
            'name': name,
            'capacity': int(capacity),
            'seats_remaining': int(capacity),
            'instructor': instructor
        })
        return _str(result.inserted_id)
    except Exception:
        return None

def get_all_electives():
    return [_elective_out(e) for e in electives_col.find()]

def get_elective_by_id(elective_id):
    try:
        return _elective_out(electives_col.find_one({'_id': ObjectId(elective_id)}))
    except Exception:
        return None

def update_elective(elective_id, code, name, capacity, instructor):
    try:
        el = electives_col.find_one({'_id': ObjectId(elective_id)})
        if not el:
            return False
        diff = int(capacity) - el['capacity']
        new_seats = max(0, el['seats_remaining'] + diff)
        electives_col.update_one({'_id': ObjectId(elective_id)}, {'$set': {
            'code': code, 'name': name, 'capacity': int(capacity),
            'seats_remaining': new_seats, 'instructor': instructor
        }})
        return True
    except Exception:
        return False

def delete_elective(elective_id):
    try:
        electives_col.delete_one({'_id': ObjectId(elective_id)})
        preferences_col.delete_many({'elective_id': elective_id})
        allocations_col.delete_many({'elective_id': elective_id})
    except Exception:
        pass

# ── Preferences ──────────────────────────────────────────────────────────────
def save_preferences(user_id, preference_list):
    try:
        preferences_col.delete_many({'user_id': user_id})
        for pref in preference_list:
            preferences_col.insert_one({
                'user_id': user_id,
                'elective_id': pref['elective_id'],
                'points': int(pref['points']),
                'rank': int(pref['rank'])
            })
        return True
    except Exception:
        return False

def get_student_preferences(user_id):
    prefs = list(preferences_col.find({'user_id': user_id}).sort([('points', -1), ('rank', 1)]))
    result = []
    for p in prefs:
        el = get_elective_by_id(p['elective_id'])
        result.append({
            'id': _str(p['_id']),
            'user_id': p['user_id'],
            'elective_id': p['elective_id'],
            'points': p['points'],
            'rank': p['rank'],
            'code': el['code'] if el else '',
            'name': el['name'] if el else '',
            'instructor': el['instructor'] if el else '',
            'capacity': el['capacity'] if el else 0,
            'seats_remaining': el['seats_remaining'] if el else 0
        })
    return result

# ── Allocations ──────────────────────────────────────────────────────────────
def get_allocations_by_semester(semester):
    allocs = list(allocations_col.find({'semester': semester}))
    result = []
    for a in allocs:
        user = get_user_by_id(a['user_id'])
        el = get_elective_by_id(a['elective_id'])
        result.append({
            'id': _str(a['_id']),
            'user_id': a['user_id'],
            'elective_id': a['elective_id'],
            'semester': a['semester'],
            'username': user['username'] if user else '',
            'code': el['code'] if el else '',
            'name': el['name'] if el else ''
        })
    return result

def get_student_allocation_history(user_id):
    allocs = list(allocations_col.find({'user_id': user_id}).sort('semester', 1))
    result = []
    for a in allocs:
        el = get_elective_by_id(a['elective_id'])
        result.append({
            'semester': a['semester'],
            'code': el['code'] if el else '',
            'name': el['name'] if el else '',
            'instructor': el['instructor'] if el else ''
        })
    return result

# ── Satisfaction History ─────────────────────────────────────────────────────
def get_student_satisfaction_history(user_id):
    history = list(satisfaction_col.find({'user_id': user_id}).sort('_id', 1))
    return [{
        'id': _str(h['_id']),
        'user_id': h['user_id'],
        'semester': h['semester'],
        'satisfaction_score': h['satisfaction_score'],
        'historical_satisfaction_after': h['historical_satisfaction_after']
    } for h in history]

def add_satisfaction_history(user_id, semester, satisfaction_score, historical_satisfaction_after):
    try:
        result = satisfaction_col.insert_one({
            'user_id': user_id,
            'semester': semester,
            'satisfaction_score': float(satisfaction_score),
            'historical_satisfaction_after': float(historical_satisfaction_after)
        })
        return _str(result.inserted_id)
    except Exception:
        return None

def update_satisfaction_history(record_id, satisfaction_score, historical_satisfaction_after):
    try:
        satisfaction_col.update_one({'_id': ObjectId(record_id)}, {'$set': {
            'satisfaction_score': float(satisfaction_score),
            'historical_satisfaction_after': float(historical_satisfaction_after)
        }})
        return True
    except Exception:
        return False

def delete_satisfaction_history(record_id):
    try:
        satisfaction_col.delete_one({'_id': ObjectId(record_id)})
        return True
    except Exception:
        return False
