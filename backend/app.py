from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required
import os
import datetime
import math
from dotenv import load_dotenv

load_dotenv()

import models
import allocation
import seed

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'fairelect-secure-jwt-key-2026')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = datetime.timedelta(days=7)

jwt = JWTManager(app)

# ── Auth ──────────────────────────────────────────────────────────────────────
@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json or {}
    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'student')
    hist_sat = data.get('historical_satisfaction', 0.0)
    max_el = data.get('max_electives', 1)
    name = data.get('name')
    roll_no = data.get('roll_no')

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400

    user_id = models.create_user(username, password, role, hist_sat, max_el, name, roll_no)
    if user_id is None:
        return jsonify({'error': 'Username already exists'}), 400

    access_token = create_access_token(identity=user_id)
    return jsonify({'message': 'User registered successfully', 'user': {
        'id': user_id, 'username': username, 'role': role,
        'historical_satisfaction': hist_sat, 'max_electives': max_el,
        'name': name, 'roll_no': roll_no, 'token': access_token
    }}), 201

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json or {}
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400

    user = models.get_user_by_username(username)
    if not user or not models.check_password_hash(user['password_hash'], password):
        return jsonify({'error': 'Invalid username or password'}), 401

    access_token = create_access_token(identity=user['id'])
    return jsonify({'message': 'Login successful', 'user': {
        'id': user['id'], 'username': user['username'], 'role': user['role'],
        'historical_satisfaction': user['historical_satisfaction'],
        'max_electives': user.get('max_electives', 1),
        'name': user.get('name'), 'roll_no': user.get('roll_no'),
        'token': access_token
    }}), 200

# ── Electives ─────────────────────────────────────────────────────────────────
@app.route('/api/electives', methods=['GET', 'POST'])
@jwt_required()
def handle_electives():
    if request.method == 'GET':
        return jsonify(models.get_all_electives()), 200

    data = request.json or {}
    code = data.get('code')
    name = data.get('name')
    capacity = data.get('capacity')
    instructor = data.get('instructor')

    if not code or not name or capacity is None:
        return jsonify({'error': 'Code, name, and capacity are required'}), 400

    try:
        capacity = int(capacity)
    except (ValueError, TypeError):
        return jsonify({'error': 'Capacity must be an integer'}), 400

    elective_id = models.create_elective(code, name, capacity, instructor)
    if elective_id is None:
        return jsonify({'error': 'Elective code already exists'}), 400

    return jsonify({'message': 'Elective created successfully', 'elective': {
        'id': elective_id, 'code': code, 'name': name,
        'capacity': capacity, 'seats_remaining': capacity, 'instructor': instructor
    }}), 201

@app.route('/api/electives/<elective_id>', methods=['DELETE', 'PUT'])
@jwt_required()
def handle_single_elective(elective_id):
    if request.method == 'DELETE':
        models.delete_elective(elective_id)
        return jsonify({'message': 'Elective deleted successfully'}), 200

    data = request.json or {}
    code = data.get('code')
    name = data.get('name')
    capacity = data.get('capacity')
    instructor = data.get('instructor')

    if not code or not name or capacity is None:
        return jsonify({'error': 'Code, name, and capacity are required'}), 400

    try:
        capacity = int(capacity)
    except (ValueError, TypeError):
        return jsonify({'error': 'Capacity must be an integer'}), 400

    success = models.update_elective(elective_id, code, name, capacity, instructor)
    if not success:
        return jsonify({'error': 'Failed to update elective'}), 400

    return jsonify({'message': 'Elective updated successfully'}), 200

# ── Config ────────────────────────────────────────────────────────────────────
@app.route('/api/config', methods=['GET', 'POST'])
@jwt_required()
def handle_config():
    if request.method == 'GET':
        bidding_status = models.get_config_value('bidding_status', 'closed')
        bidding_deadline = models.get_config_value('bidding_deadline', '')
        allocation_status = models.get_config_value('allocation_status', 'draft')
        current_semester = models.get_config_value('current_semester', 'Semester 1')
        allocation_ran = models.get_config_value('allocation_ran', 'false')

        if bidding_status == 'open' and bidding_deadline:
            try:
                deadline = datetime.datetime.fromisoformat(bidding_deadline.replace('Z', '+00:00'))
                if datetime.datetime.now(datetime.timezone.utc) > deadline:
                    bidding_status = 'closed'
                    models.set_config_value('bidding_status', 'closed')
            except Exception:
                pass

        return jsonify({
            'bidding_status': bidding_status,
            'bidding_deadline': bidding_deadline,
            'allocation_status': allocation_status,
            'allocation_ran': allocation_ran == 'true',
            'current_semester': current_semester,
            'server_time': datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z')
        }), 200

    data = request.json or {}
    bidding_status = data.get('bidding_status')
    duration_minutes = data.get('bidding_duration_minutes')
    allocation_status = data.get('allocation_status')
    current_semester = data.get('current_semester')

    if allocation_status is not None:
        models.set_config_value('allocation_status', allocation_status)
    if current_semester is not None:
        models.set_config_value('current_semester', current_semester)

    bidding_deadline_str = models.get_config_value('bidding_deadline', '')
    current_bidding_status = models.get_config_value('bidding_status', 'closed')

    if bidding_status is not None:
        if bidding_status == 'open':
            if duration_minutes is None:
                return jsonify({'error': 'Duration is required to open bidding'}), 400
            try:
                duration_minutes = float(duration_minutes)
            except (ValueError, TypeError):
                return jsonify({'error': 'Duration must be a number'}), 400
            now = datetime.datetime.now(datetime.timezone.utc)
            deadline = now + datetime.timedelta(minutes=duration_minutes)
            bidding_deadline_str = deadline.isoformat().replace('+00:00', 'Z')
            models.set_config_value('bidding_status', 'open')
            models.set_config_value('bidding_deadline', bidding_deadline_str)
            models.set_config_value('allocation_ran', 'false')
            current_bidding_status = 'open'
        else:
            models.set_config_value('bidding_status', 'closed')
            models.set_config_value('bidding_deadline', '')
            bidding_deadline_str = ''
            current_bidding_status = 'closed'

    return jsonify({
        'message': 'System configuration updated successfully',
        'bidding_status': current_bidding_status,
        'bidding_deadline': bidding_deadline_str,
        'allocation_status': models.get_config_value('allocation_status', 'draft')
    }), 200

# ── Preferences ───────────────────────────────────────────────────────────────
@app.route('/api/preferences', methods=['GET', 'POST'])
@jwt_required()
def handle_preferences():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'User ID is required'}), 400

    if request.method == 'GET':
        return jsonify(models.get_student_preferences(user_id)), 200

    bidding_status = models.get_config_value('bidding_status', 'closed')
    bidding_deadline_str = models.get_config_value('bidding_deadline', '')
    is_expired = False

    if bidding_status == 'open' and bidding_deadline_str:
        try:
            deadline = datetime.datetime.fromisoformat(bidding_deadline_str.replace('Z', '+00:00'))
            if datetime.datetime.now(datetime.timezone.utc) > deadline:
                is_expired = True
                models.set_config_value('bidding_status', 'closed')
        except Exception:
            pass

    if bidding_status != 'open' or is_expired:
        return jsonify({'error': 'Bidding is currently closed.'}), 400

    data = request.json or {}
    prefs_list = data.get('preferences', []) if isinstance(data, dict) else data
    max_electives = int(data.get('max_electives', 1)) if isinstance(data, dict) else 1

    total_points = sum(int(p.get('points', 0)) for p in prefs_list)
    if total_points > 500:
        return jsonify({'error': f'Total preference points ({total_points}) exceeds limit of 500.'}), 400

    models.update_user(user_id, models.get_user_by_id(user_id)['username'], max_electives=max_electives)

    sorted_prefs = sorted(prefs_list, key=lambda x: -int(x.get('points', 0)))
    preference_list = [{'elective_id': p['elective_id'], 'points': int(p['points']), 'rank': idx + 1}
                       for idx, p in enumerate(sorted_prefs)]

    if not models.save_preferences(user_id, preference_list):
        return jsonify({'error': 'Failed to save preferences'}), 500

    return jsonify({'message': 'Preferences saved successfully'}), 200

# ── Students ──────────────────────────────────────────────────────────────────
@app.route('/api/students', methods=['GET', 'POST'])
@jwt_required()
def handle_students():
    if request.method == 'GET':
        students = models.get_all_students()
        for s in students:
            s['satisfaction_history'] = models.get_student_satisfaction_history(s['id'])
            s['preferences'] = models.get_student_preferences(s['id'])
            s['allocation_history'] = models.get_student_allocation_history(s['id'])
        return jsonify(students), 200

    data = request.json or {}
    username = data.get('username')
    if not username:
        return jsonify({'error': 'Username is required'}), 400

    user_id = models.create_user(
        username, data.get('password', 'pass123'), 'student',
        float(data.get('historical_satisfaction', 0.0)),
        int(data.get('max_electives', 1)),
        data.get('name'), data.get('roll_no')
    )
    if user_id is None:
        return jsonify({'error': 'Username already exists'}), 400

    return jsonify({'message': 'Student created successfully', 'student': {
        'id': user_id, 'username': username, 'role': 'student',
        'historical_satisfaction': float(data.get('historical_satisfaction', 0.0)),
        'max_electives': int(data.get('max_electives', 1)),
        'name': data.get('name'), 'roll_no': data.get('roll_no')
    }}), 201

@app.route('/api/students/<student_id>', methods=['PUT', 'DELETE'])
@jwt_required()
def handle_single_student(student_id):
    if request.method == 'DELETE':
        models.delete_user(student_id)
        return jsonify({'message': 'Student deleted successfully'}), 200

    data = request.json or {}
    username = data.get('username')
    if not username:
        return jsonify({'error': 'Username is required'}), 400

    try:
        hist_sat = float(data['historical_satisfaction']) if data.get('historical_satisfaction') is not None else None
        max_el = int(data['max_electives']) if data.get('max_electives') is not None else None
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid numerical fields'}), 400

    if not models.update_user(student_id, username, data.get('password'), hist_sat, max_el, data.get('name'), data.get('roll_no')):
        return jsonify({'error': 'Failed to update student'}), 400

    return jsonify({'message': 'Student updated successfully'}), 200

@app.route('/api/students/<student_id>/profile', methods=['PUT'])
@jwt_required()
def update_student_profile(student_id):
    data = request.json or {}
    name = data.get('name')
    roll_no = data.get('roll_no')

    if not name or not roll_no:
        return jsonify({'error': 'Name and Roll Number are required'}), 400

    user = models.get_user_by_id(student_id)
    if not user:
        return jsonify({'error': 'Student not found'}), 404

    models.update_user(student_id, user['username'], name=name, roll_no=roll_no)

    auth_header = request.headers.get('Authorization', '')
    token = auth_header.split(' ')[1] if ' ' in auth_header else None

    updated = models.get_user_by_id(student_id)
    user_data = {
        'id': updated['id'], 'username': updated['username'], 'role': updated['role'],
        'historical_satisfaction': updated['historical_satisfaction'],
        'max_electives': updated.get('max_electives', 1),
        'name': updated['name'], 'roll_no': updated['roll_no']
    }
    if token:
        user_data['token'] = token

    return jsonify({'message': 'Profile updated successfully', 'user': user_data}), 200

# ── Satisfaction History ───────────────────────────────────────────────────────
@app.route('/api/satisfaction_history', methods=['POST'])
@jwt_required()
def add_satisfaction_history_record():
    data = request.json or {}
    user_id = data.get('user_id')
    if not user_id:
        return jsonify({'error': 'User ID is required'}), 400

    record_id = models.add_satisfaction_history(
        user_id, data.get('semester', 'Semester 1'),
        float(data.get('satisfaction_score', 0.0)),
        float(data.get('historical_satisfaction_after', 0.0))
    )
    if record_id is None:
        return jsonify({'error': 'Failed to add satisfaction history record'}), 500

    return jsonify({'message': 'Satisfaction history record added successfully', 'id': record_id}), 201

@app.route('/api/satisfaction_history/<record_id>', methods=['PUT', 'DELETE'])
@jwt_required()
def handle_single_satisfaction_record(record_id):
    if request.method == 'DELETE':
        if not models.delete_satisfaction_history(record_id):
            return jsonify({'error': 'Failed to delete record'}), 500
        return jsonify({'message': 'Satisfaction history record deleted successfully'}), 200

    data = request.json or {}
    if not models.update_satisfaction_history(record_id, float(data.get('satisfaction_score', 0.0)), float(data.get('historical_satisfaction_after', 0.0))):
        return jsonify({'error': 'Failed to update record'}), 500

    return jsonify({'message': 'Satisfaction history record updated successfully'}), 200

# ── Allocation ────────────────────────────────────────────────────────────────
def _get_allocation_inputs():
    students_raw = models.get_all_students()
    electives_raw = models.get_all_electives()
    students = [{'id': s['id'], 'username': s['username'], 'historical_satisfaction': s['historical_satisfaction'], 'max_electives': s.get('max_electives', 1)} for s in students_raw]
    electives = [{'id': e['id'], 'code': e['code'], 'name': e['name'], 'capacity': e['capacity'], 'seats_remaining': e['seats_remaining'], 'instructor': e['instructor']} for e in electives_raw]

    all_prefs = []
    for s in students_raw:
        for p in models.get_student_preferences(s['id']):
            all_prefs.append({'user_id': s['id'], 'elective_id': p['elective_id'], 'points': p['points'], 'rank': p['rank']})

    sat_counts = {}
    students_with_hist = set()
    for s in students_raw:
        hist = models.get_student_satisfaction_history(s['id'])
        if hist:
            students_with_hist.add(s['id'])
            sat_counts[s['id']] = len(hist)

    new_student_ids = set(s['id'] for s in students) - students_with_hist
    return students, electives, all_prefs, new_student_ids, sat_counts

@app.route('/api/allocation/simulate', methods=['POST'])
@jwt_required()
def simulate():
    data = request.json or {}
    students, electives, all_prefs, new_student_ids, sat_counts = _get_allocation_inputs()

    trace, allocations, updated_student_map = allocation.simulate_allocation(
        students, electives, all_prefs,
        data.get('max_electives', 1), data.get('alpha', 0.6), data.get('theta', 0.5),
        data.get('lambda_base', 0.3), data.get('gamma', 1.0), data.get('beta', 0.5),
        new_student_ids=new_student_ids, sat_counts=sat_counts
    )
    stats = _calculate_stats(updated_student_map, students, electives, all_prefs, sat_counts)

    return jsonify({
        'trace': trace, 'allocations': allocations,
        'updated_students': [dict(v) for v in updated_student_map.values()],
        'stats': stats
    }), 200

@app.route('/api/allocation/run', methods=['POST'])
@jwt_required()
def run():
    data = request.json or {}
    semester = data.get('semester', models.get_config_value('current_semester', 'Semester 1'))
    students, electives, all_prefs, new_student_ids, sat_counts = _get_allocation_inputs()

    for e in electives:
        e['seats_remaining'] = e['capacity']

    trace, allocations, updated_student_map = allocation.simulate_allocation(
        students, electives, all_prefs,
        data.get('max_electives', 1), data.get('alpha', 0.6), data.get('theta', 0.5),
        data.get('lambda_base', 0.3), data.get('gamma', 1.0), data.get('beta', 0.5),
        new_student_ids=new_student_ids, sat_counts=sat_counts
    )

    try:
        models.allocations_col.delete_many({'semester': semester})
        models.satisfaction_col.delete_many({'semester': semester})

        for alloc in allocations:
            models.allocations_col.insert_one({
                'user_id': alloc['user_id'], 'elective_id': alloc['elective_id'], 'semester': semester
            })

        for s_id, s in updated_student_map.items():
            h_new = s['curr_hist_sat']
            models.users_col.update_one({'_id': __import__('bson').ObjectId(s_id)}, {'$set': {'historical_satisfaction': h_new}})
            allocs_for_s = [a for a in allocations if a['user_id'] == s_id]
            s_curr = allocation.get_prsm_satisfaction(allocs_for_s[0]['rank'], s['total_prefs']) if allocs_for_s else 0.0
            models.satisfaction_col.insert_one({
                'user_id': s_id, 'semester': semester,
                'satisfaction_score': s_curr, 'historical_satisfaction_after': h_new
            })

        el_map = allocation.elective_map_update(electives, allocations)
        for e_id, el in el_map.items():
            models.electives_col.update_one({'_id': __import__('bson').ObjectId(e_id)}, {'$set': {'seats_remaining': el['seats_remaining']}})

        models.set_config_value('allocation_ran', 'true')
    except Exception as e:
        return jsonify({'error': str(e)}), 500

    return jsonify({'message': 'Allocation successfully executed and stored.', 'trace': trace, 'allocations': allocations}), 200

@app.route('/api/allocation/results', methods=['GET'])
@jwt_required()
def get_results():
    semester = request.args.get('semester', models.get_config_value('current_semester', 'Semester 1'))
    return jsonify(models.get_allocations_by_semester(semester)), 200

@app.route('/api/allocation/history', methods=['GET'])
@jwt_required()
def get_allocation_history():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'user_id is required'}), 400
    return jsonify(models.get_student_allocation_history(user_id)), 200

@app.route('/api/allocation/advance-semester', methods=['POST'])
@jwt_required()
def advance_semester():
    current_sem = models.get_config_value('current_semester', 'Semester 1')
    try:
        parts = current_sem.rsplit(' ', 1)
        new_semester = f"{parts[0]} {int(parts[-1]) + 1}"
    except Exception:
        new_semester = 'Semester 2'

    models.set_config_value('current_semester', new_semester)
    models.set_config_value('bidding_status', 'closed')
    models.set_config_value('bidding_deadline', '')
    models.set_config_value('allocation_status', 'draft')
    models.set_config_value('allocation_ran', 'false')

    models.preferences_col.delete_many({})
    for el in models.get_all_electives():
        models.electives_col.update_one(
            {'_id': __import__('bson').ObjectId(el['id'])},
            {'$set': {'seats_remaining': el['capacity']}}
        )

    return jsonify({'message': f'Advanced to {new_semester}.', 'new_semester': new_semester}), 200

@app.route('/api/allocation/reset', methods=['POST'])
@jwt_required()
def reset():
    try:
        seed.seed_database()
        return jsonify({'message': 'Database re-seeded successfully.'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def _calculate_stats(updated_student_map, students, electives, all_prefs, sat_counts):
    fe_sats = [s['curr_hist_sat'] for s in updated_student_map.values()]
    avg = sum(fe_sats) / len(fe_sats) if fe_sats else 0.0
    mn = min(fe_sats) if fe_sats else 0.0
    mx = max(fe_sats) if fe_sats else 0.0
    variance = sum((x - avg) ** 2 for x in fe_sats) / len(fe_sats) if fe_sats else 0.0

    try:
        _, _, bid_map = allocation.simulate_allocation(
            students, [dict(e) for e in electives], all_prefs,
            max_electives=1, alpha=0.6, theta=0.5, lambda_base=0.0, gamma=0.0, beta=0.0,
            sat_counts=sat_counts
        )
        bid_sats = [s['curr_hist_sat'] for s in bid_map.values()]
        b_avg = sum(bid_sats) / len(bid_sats) if bid_sats else 0.5
        b_mn = min(bid_sats) if bid_sats else 0.1
        b_mx = max(bid_sats) if bid_sats else 0.9
        b_var = sum((x - b_avg) ** 2 for x in bid_sats) / len(bid_sats) if bid_sats else 0.09
    except Exception:
        b_avg, b_mn, b_mx, b_var = 0.5, 0.1, 0.9, 0.09

    return {
        'fairelect': {'avg': avg, 'min': mn, 'max': mx, 'std_dev': math.sqrt(variance)},
        'traditional': {'avg': b_avg, 'min': b_mn, 'max': b_mx, 'std_dev': math.sqrt(b_var)}
    }

if __name__ == '__main__':
    app.run(debug=True, port=5000, use_reloader=False)
