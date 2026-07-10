import models

def seed_database():
    print("Clearing database...")
    models.supabase.table('preferences').delete().neq('id', 0).execute()
    models.supabase.table('allocations').delete().neq('id', 0).execute()
    models.supabase.table('satisfaction_history').delete().neq('id', 0).execute()
    models.supabase.table('system_config').delete().neq('key', '').execute()
    models.supabase.table('users').delete().neq('id', 0).execute()
    models.supabase.table('electives').delete().neq('id', 0).execute()

    print("Seeding initial data...")

    admin_id = models.create_user("admin", "admin123", "admin")
    print(f"Created Admin: admin (ID: {admin_id})")

    students_data = [
        ("alice",   "pass123", 0.10),
        ("bob",     "pass123", 0.80),
        ("charlie", "pass123", 0.20),
        ("david",   "pass123", 0.60),
        ("eve",     "pass123", 0.40),
        ("frank",   "pass123", 0.90),
        ("grace",   "pass123", 0.30),
        ("helen",   "pass123", 0.70),
    ]

    student_ids = {}
    for username, password, hist_sat in students_data:
        s_id = models.create_user(username, password, "student", hist_sat)
        student_ids[username] = s_id
        print(f"Created Student: {username} | Hist Sat: {hist_sat:.2f} | ID: {s_id}")

    electives_data = [
        ("CS101", "Introduction to Machine Learning", 2, "Dr. Andrew Ng"),
        ("CS102", "Cloud Computing Architectures",    2, "Prof. AWS Cooper"),
        ("CS103", "Full-Stack Web Development",       2, "Dr. Dan Abramov"),
        ("CS104", "Cryptography and Blockchain",      2, "Dr. Satoshi Nakamoto"),
        ("CS105", "Human-Computer Interaction",       3, "Prof. Don Norman"),
    ]

    elective_ids = {}
    for code, name, capacity, instructor in electives_data:
        e_id = models.create_elective(code, name, capacity, instructor)
        elective_ids[code] = e_id
        print(f"Created Elective: {code} - {name} (Capacity: {capacity}) | ID: {e_id}")

    preferences_data = [
        ("alice",   "CS101", 300, 1), ("alice",   "CS103", 150, 2), ("alice",   "CS105",  50, 3),
        ("bob",     "CS101", 400, 1), ("bob",     "CS102", 100, 2),
        ("charlie", "CS101", 250, 1), ("charlie", "CS103", 200, 2), ("charlie", "CS104",  50, 3),
        ("david",   "CS103", 350, 1), ("david",   "CS101", 100, 2), ("david",   "CS105",  50, 3),
        ("eve",     "CS103", 250, 1), ("eve",     "CS102", 150, 2), ("eve",     "CS105", 100, 3),
        ("frank",   "CS101", 450, 1), ("frank",   "CS104",  50, 2),
        ("grace",   "CS101", 200, 1), ("grace",   "CS103", 200, 2), ("grace",   "CS102", 100, 3),
        ("helen",   "CS103", 300, 1), ("helen",   "CS104", 150, 2), ("helen",   "CS101",  50, 3),
    ]

    for username, elective_code, points, rank in preferences_data:
        models.supabase.table('preferences').insert({
            'user_id': student_ids[username],
            'elective_id': elective_ids[elective_code],
            'points': points,
            'rank': rank
        }).execute()

    print("Database seeding completed successfully!")

if __name__ == "__main__":
    seed_database()
