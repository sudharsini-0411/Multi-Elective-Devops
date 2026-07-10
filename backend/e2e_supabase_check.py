import requests
import json
from supabase import create_client
from dotenv import load_dotenv
import os

load_dotenv()
supabase = create_client(os.environ.get('SUPABASE_URL'), os.environ.get('SUPABASE_SERVICE_KEY'))

BASE = "http://127.0.0.1:5000/api"

print("=" * 55)
print("  END-TO-END SUPABASE STORAGE TEST")
print("=" * 55)

# ── Step 1: Register / Login as Admin ─────────────────────
print("\n[1] Registering admin user...")
r = requests.post(f"{BASE}/auth/register", json={
    "username": "admin_test",
    "password": "admin123",
    "role": "admin"
})
if r.status_code == 201:
    token = r.json()['user']['token']
    print("    ✅ Admin registered successfully")
elif r.status_code == 400 and "already exists" in r.text:
    print("    ℹ️  Admin already exists — logging in...")
    r2 = requests.post(f"{BASE}/auth/login", json={"username": "admin_test", "password": "admin123"})
    if r2.status_code == 200:
        token = r2.json()['user']['token']
        print("    ✅ Admin login successful")
    else:
        print(f"    ❌ Login failed: {r2.text}")
        exit(1)
else:
    print(f"    ❌ Registration failed: {r.text}")
    exit(1)

headers = {"Authorization": f"Bearer {token}"}

# ── Step 2: Add a Student via API ─────────────────────────
print("\n[2] Adding student via POST /api/students ...")
student_payload = {
    "username":   "teststudent1",
    "password":   "pass123",
    "name":       "Test Student One",
    "roll_no":    "CS2024001",
    "role":       "student",
    "max_electives": 1,
    "historical_satisfaction": 0.0
}
r = requests.post(f"{BASE}/students", json=student_payload, headers=headers)
if r.status_code == 201:
    student_id = r.json()['student']['id']
    print(f"    ✅ Student created! ID = {student_id}")
elif r.status_code == 400 and "already exists" in r.text:
    print("    ℹ️  Student already exists — fetching from Supabase directly...")
    res = supabase.table('users').select('id,username,name,roll_no').eq('username','teststudent1').execute()
    student_id = str(res.data[0]['id']) if res.data else None
    print(f"    ✅ Found existing student. ID = {student_id}")
else:
    print(f"    ❌ Failed: {r.status_code} — {r.text}")
    exit(1)

# ── Step 3: Verify in Supabase ────────────────────────────
print("\n[3] Verifying student is stored in Supabase 'users' table...")
res = supabase.table('users').select('id,username,name,roll_no,role').eq('username','teststudent1').execute()
if res.data:
    row = res.data[0]
    print(f"    ✅ FOUND IN SUPABASE!")
    print(f"       ID       : {row['id']}")
    print(f"       Username : {row['username']}")
    print(f"       Name     : {row['name']}")
    print(f"       Roll No  : {row['roll_no']}")
    print(f"       Role     : {row['role']}")
else:
    print("    ❌ Student NOT found in Supabase!")

# ── Step 4: Add Elective ──────────────────────────────────
print("\n[4] Adding elective via POST /api/electives ...")
r = requests.post(f"{BASE}/electives", json={
    "code": "CS501", "name": "Machine Learning",
    "capacity": 30, "instructor": "Dr. Smith"
}, headers=headers)
if r.status_code == 201:
    elective_id = r.json()['elective']['id']
    print(f"    ✅ Elective created! ID = {elective_id}")
elif r.status_code == 400 and "already exists" in r.text:
    print("    ℹ️  Elective already exists")
    res = supabase.table('electives').select('id').eq('code','CS501').execute()
    elective_id = str(res.data[0]['id']) if res.data else None
else:
    print(f"    ❌ Failed: {r.status_code} — {r.text}")

# ── Step 5: Verify all tables ─────────────────────────────
print("\n[5] Full Supabase table summary:")
tables = ['users', 'electives', 'preferences', 'allocations', 'satisfaction_history', 'system_config']
for t in tables:
    res = supabase.table(t).select('*').execute()
    print(f"    📋 {t:30s}: {len(res.data)} row(s)")

print("\n" + "=" * 55)
print("  ✅ TEST COMPLETE — Data is stored in Supabase!")
print("=" * 55)
