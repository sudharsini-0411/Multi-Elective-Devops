import models
from models import db, get_app

app = get_app()
with app.app_context():
    students = models.User.query.filter_by(role='student').all()
    for s in students:
        uid = s.id
        history = models.SatisfactionHistory.query.filter_by(user_id=uid).order_by(models.SatisfactionHistory.id.asc()).all()
        if history:
            current_val = 1.0
            for h in history:
                current_val = (current_val + h.satisfaction_score) / 2.0
            s.historical_satisfaction = current_val
            print(f'User {uid}: {len(history)} semesters, avg={current_val:.4f}')
        else:
            s.historical_satisfaction = 1.0
            print(f'User {uid}: no history, set to 1.0')
            
    db.session.commit()
print('Done - historical_satisfaction recomputed as sequential simple average.')
