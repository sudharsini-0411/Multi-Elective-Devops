import sys, io, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import models

def reset_and_seed():
    sb = models.supabase

    # ── Step 1: Clear ALL dummy/test data ──────────────────────────
    print("=" * 55)
    print("  CLEARING ALL DUMMY DATA FROM SUPABASE")
    print("=" * 55)

    sb.table('preferences').delete().neq('id', 0).execute()
    print("[OK] Cleared: preferences")
    sb.table('allocations').delete().neq('id', 0).execute()
    print("[OK] Cleared: allocations")
    sb.table('satisfaction_history').delete().neq('id', 0).execute()
    print("[OK] Cleared: satisfaction_history")
    sb.table('system_config').delete().neq('key', '').execute()
    print("[OK] Cleared: system_config")
    sb.table('users').delete().neq('id', 0).execute()
    print("[OK] Cleared: users")
    sb.table('electives').delete().neq('id', 0).execute()
    print("[OK] Cleared: electives")

    # ── Step 2: Create Admin ────────────────────────────────────────
    print("\n" + "=" * 55)
    print("  CREATING ADMIN USER")
    print("=" * 55)
    admin_id = models.create_user("admin", "admin123", "admin")
    print(f"[OK] Admin created  |  username: admin  |  password: admin123  |  ID: {admin_id}")

    # ── Step 3: Add 10 Real NIT Elective Papers ─────────────────────
    print("\n" + "=" * 55)
    print("  ADDING 10 ELECTIVE PAPERS")
    print("=" * 55)

    electives = [
        ("EL101", "Machine Learning and Deep Learning",        40, "Dr. R. Krishnamurthy"),
        ("EL102", "Cloud Computing and DevOps",                35, "Prof. S. Venkatesan"),
        ("EL103", "Internet of Things (IoT)",                  30, "Dr. P. Anandhan"),
        ("EL104", "Cybersecurity and Ethical Hacking",         30, "Prof. M. Suresh"),
        ("EL105", "Data Science and Big Data Analytics",       40, "Dr. K. Meenakshi"),
        ("EL106", "Blockchain Technology and Applications",    25, "Prof. T. Ramesh"),
        ("EL107", "Augmented Reality and Virtual Reality",     25, "Dr. N. Priya"),
        ("EL108", "Natural Language Processing",               35, "Prof. A. Sundaram"),
        ("EL109", "Robotics and Autonomous Systems",           20, "Dr. V. Chandrasekar"),
        ("EL110", "Digital Image Processing",                  30, "Prof. L. Ganesan"),
    ]

    created = []
    for code, name, capacity, instructor in electives:
        e_id = models.create_elective(code, name, capacity, instructor)
        created.append((code, name, capacity, instructor, e_id))
        print(f"[OK] {code} | {name[:40]:<40} | Cap: {capacity} | ID: {e_id}")

    # ── Step 4: Summary ─────────────────────────────────────────────
    print("\n" + "=" * 55)
    print("  FINAL SUPABASE TABLE COUNTS")
    print("=" * 55)
    tables = ['users', 'electives', 'preferences', 'allocations', 'satisfaction_history', 'system_config']
    for t in tables:
        count = len(sb.table(t).select('id' if t != 'system_config' else 'key').execute().data)
        print(f"  {t:<30}: {count} row(s)")

    print("\n[DONE] Database reset and seeded successfully!")
    print("       Login: admin / admin123")

if __name__ == "__main__":
    reset_and_seed()
