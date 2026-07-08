import models
from models import db, get_app

app = get_app()
with app.app_context():
    print("Tables:")
    db.reflect()
    print(list(db.metadata.tables.keys()))
    print()
    
    users = models.User.query.all()
    print("Users:")
    for u in users:
        d = u.to_dict()
        print(d)
    print()
    
    try:
        allocs = db.session.query(models.Allocation, models.Elective)\
            .join(models.Elective, models.Allocation.elective_id == models.Elective.id)\
            .order_by(models.Allocation.user_id, models.Allocation.semester).all()
        print("Allocations:")
        for a, e in allocs:
            print(f"User ID: {a.user_id}, Semester: {a.semester}, Course: {e.code} ({e.name})")
    except Exception as ex:
        print("Allocations error:", ex)
        
    print()
    try:
        sat = models.SatisfactionHistory.query.order_by(models.SatisfactionHistory.user_id, models.SatisfactionHistory.id).all()
        print("Satisfaction History:")
        for s in sat:
            print(s.to_dict())
    except Exception as ex:
        print("SatHistory error:", ex)
