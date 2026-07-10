import sys, io, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from supabase import create_client
from dotenv import load_dotenv
load_dotenv()

sb = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_KEY'])

print("=" * 50)
print("   SUPABASE LIVE DATA CHECK")
print("=" * 50)

# ── Users ──────────────────────────────────────────────────
print("\n📋 TABLE: users")
rows = sb.table('users').select('id,username,name,roll_no,role').execute().data
if rows:
    for r in rows:
        print(f"   ID={r['id']}  role={r['role']}  username={r['username']}  name={r['name']}  roll_no={r['roll_no']}")
else:
    print("   (no rows)")

# ── Electives ─────────────────────────────────────────────
print("\n📋 TABLE: electives")
rows = sb.table('electives').select('id,code,name,capacity,seats_remaining,instructor').execute().data
if rows:
    for r in rows:
        print(f"   ID={r['id']}  code={r['code']}  name={r['name']}  capacity={r['capacity']}  instructor={r['instructor']}")
else:
    print("   (no rows)")

# ── Preferences ───────────────────────────────────────────
print("\n📋 TABLE: preferences")
rows = sb.table('preferences').select('*').execute().data
if rows:
    for r in rows:
        print(f"   {r}")
else:
    print("   (no rows yet)")

# ── Allocations ───────────────────────────────────────────
print("\n📋 TABLE: allocations")
rows = sb.table('allocations').select('*').execute().data
if rows:
    for r in rows:
        print(f"   {r}")
else:
    print("   (no rows yet)")

# ── Satisfaction History ──────────────────────────────────
print("\n📋 TABLE: satisfaction_history")
rows = sb.table('satisfaction_history').select('*').execute().data
if rows:
    for r in rows:
        print(f"   {r}")
else:
    print("   (no rows yet)")

# ── System Config ─────────────────────────────────────────
print("\n📋 TABLE: system_config")
rows = sb.table('system_config').select('*').execute().data
if rows:
    for r in rows:
        print(f"   key={r['key']}  value={r['value']}")
else:
    print("   (no rows yet)")

print("\n" + "=" * 50)
print("   CHECK COMPLETE")
print("=" * 50)
