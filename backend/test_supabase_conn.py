from supabase import create_client
from dotenv import load_dotenv
import os

load_dotenv()
url = os.environ.get('SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_KEY')
print(f'Supabase URL: {url}')

supabase = create_client(url, key)
print('Connection created successfully!\n')

tables = ['users', 'electives', 'preferences', 'allocations', 'satisfaction_history', 'system_config']
print('--- Table Check ---')
for table in tables:
    try:
        res = supabase.table(table).select('*').limit(3).execute()
        print(f'[OK] Table "{table}" exists — sample rows: {len(res.data)}')
    except Exception as e:
        print(f'[FAIL] Table "{table}": {e}')

print()
print('--- Sample Data from "users" table ---')
try:
    res = supabase.table('users').select('id, username, role, name').limit(5).execute()
    if res.data:
        for row in res.data:
            print(row)
    else:
        print('(No rows yet)')
except Exception as e:
    print(f'Error: {e}')
