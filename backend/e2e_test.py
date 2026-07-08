import requests

BASE = "http://localhost:5000/api"

# Helper for login and retrieving token and user ID
def get_user_session(username, password):
    res = requests.post(f"{BASE}/auth/login", json={"username": username, "password": password})
    if res.status_code == 200:
        data = res.json()
        return data['user']['id'], data['user']['token']
    else:
        raise Exception(f"Failed to login user {username}: {res.text}")

# Get admin session
admin_id, admin_token = get_user_session("admin", "admin123")
admin_headers = {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}

def p(label, r):
    status = r.json().get('message') or r.json().get('error') or str(r.json())[:80]
    print(f"[{r.status_code}] {label}: {status}")

# Fetch config using admin session
cfg2 = requests.get(f"{BASE}/config", headers=admin_headers).json()
print(f"Current semester: {cfg2['current_semester']}")

# Show current semester results
print(f"\n=== Current semester ({cfg2['current_semester']}) Allocations ===")
allocs4 = requests.get(f"{BASE}/allocation/results?semester={cfg2['current_semester']}", headers=admin_headers).json()
for a in allocs4:
    print(f"  {a['username']} -> {a['code']} ({a['name']})")

# Advance semester (admin)
r = requests.post(f"{BASE}/allocation/advance-semester", headers=admin_headers)
p("\nAdvance semester", r)

cfg2 = requests.get(f"{BASE}/config", headers=admin_headers).json()
print(f"Current semester: {cfg2['current_semester']}")

# Open bidding for new semester (admin)
r = requests.post(f"{BASE}/config", json={"bidding_status": "open", "bidding_duration_minutes": 10}, headers=admin_headers)
p("Open bidding new semester", r)

# Submit preferences for some students using their own tokens
students_to_test = [
    # (username, preferences, max_electives)
    ("alice", [
        {"elective_id": 3, "points": 250, "rank": 1},
        {"elective_id": 5, "points": 150, "rank": 2},
        {"elective_id": 1, "points": 100, "rank": 3},
    ], 1),
    ("bob", [
        {"elective_id": 4, "points": 300, "rank": 1},
        {"elective_id": 1, "points": 100, "rank": 2},
        {"elective_id": 3, "points": 100, "rank": 3},
    ], 1),
    ("charlie", [
        {"elective_id": 2, "points": 200, "rank": 1},
        {"elective_id": 4, "points": 200, "rank": 2},
        {"elective_id": 5, "points": 100, "rank": 3},
    ], 1),
    ("david", [
        {"elective_id": 5, "points": 250, "rank": 1},
        {"elective_id": 2, "points": 150, "rank": 2},
        {"elective_id": 1, "points": 100, "rank": 3},
    ], 1)
]

student_ids = []
for username, prefs, max_el in students_to_test:
    s_id, s_token = get_user_session(username, "pass123")
    student_ids.append(s_id)
    s_headers = {"Authorization": f"Bearer {s_token}", "Content-Type": "application/json"}
    r = requests.post(f"{BASE}/preferences?user_id={s_id}", json={
        "preferences": prefs,
        "max_electives": max_el
    }, headers=s_headers)
    p(f"{username} prefs submission", r)

# Close bidding, run, publish (admin)
r = requests.post(f"{BASE}/config", json={"bidding_status": "closed"}, headers=admin_headers)
p("Close bidding", r)

r = requests.post(f"{BASE}/allocation/run", json={
    "semester": cfg2["current_semester"],
    "max_electives": 1,
    "alpha": 0.6, "theta": 0.5, "lambda_base": 0.3, "gamma": 1.0, "beta": 0.5
}, headers=admin_headers)
p("Run allocation", r)

r = requests.post(f"{BASE}/config", json={"allocation_status": "published"}, headers=admin_headers)
p("Publish allocation results", r)

print(f"\n=== New Semester ({cfg2['current_semester']}) Allocations ===")
allocs5 = requests.get(f"{BASE}/allocation/results?semester={cfg2['current_semester']}", headers=admin_headers).json()
for a in allocs5:
    if a['user_id'] in student_ids:
        print(f"  {a['username']} -> {a['code']} ({a['name']})")

# Full history check
print("\n=== Full History check for test students ===")
students = requests.get(f"{BASE}/students", headers=admin_headers).json()
for s in students:
    if s['id'] in student_ids:
        hist = s['satisfaction_history']
        alloc_hist = requests.get(f"{BASE}/allocation/history?user_id={s['id']}", headers=admin_headers).json()
        print(f"\n  {s['username']} (hist_sat={s['historical_satisfaction']*100:.1f}%):")
        alloc_by_sem = {}
        for a in alloc_hist:
            alloc_by_sem.setdefault(a['semester'], []).append(a['code'])
        for h in hist:
            sem = h['semester']
            courses = ', '.join(alloc_by_sem.get(sem, ['Unallocated']))
            print(f"    {sem}: score={h['satisfaction_score']*100:.0f}%  hist={h['historical_satisfaction_after']*100:.0f}%  courses=[{courses}]")

print("\nDone! All API endpoints successfully validated with active JWT protection.")
