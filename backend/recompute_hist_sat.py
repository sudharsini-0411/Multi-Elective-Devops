import models
from models import db, get_app

app = get_app()
with app.app_context():
    students = models.User.query.filter_by(role='student').all()
    for s in students:
        uid = s.id
        history = models.SatisfactionHistory.query.filter_by(user_id=uid).order_by(models.SatisfactionHistory.id.asc()).all()
        scores = [h.satisfaction_score for h in history]
        if scores:
            simple_avg = sum(scores) / len(scores)
            s.historical_satisfaction = simple_avg
            print(f'User {uid}: {len(scores)} semesters, scores={[round(x,2) for x in scores]}, avg={simple_avg:.4f}')
        else:
            print(f'User {uid}: no history, keeping 0.0')
            
    db.session.commit()
print('Done - historical_satisfaction recomputed as simple average.')
