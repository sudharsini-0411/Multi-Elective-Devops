from supabase import create_client
from dotenv import load_dotenv
import os

load_dotenv()
url = os.environ.get('SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_KEY')

supabase = create_client(url, key)

sql = """
create table if not exists student_allocation_report (
  id bigserial primary key,
  student_name text not null,
  roll_no text not null,
  allocated_elective text not null,
  semester text not null,
  allocation_date date not null default current_date,
  created_at timestamptz default now()
);
"""

try:
    result = supabase.rpc('exec_sql', {'query': sql}).execute()
    print("Table created via RPC.")
except Exception as e:
    print(f"RPC method not available: {e}")
    print("\nFalling back — please run this SQL manually in Supabase SQL Editor:")
    print("https://supabase.com/dashboard/project/ngondtbbrcqnchajhvew/sql")
    print()
    print(sql)

# Verify the table exists
print("\n--- Verifying table ---")
try:
    res = supabase.table('student_allocation_report').select('*').limit(1).execute()
    print("[OK] Table 'student_allocation_report' exists and is accessible!")
    print(f"     Rows: {len(res.data)}")
except Exception as e:
    print(f"[FAIL] Table not yet accessible: {e}")
