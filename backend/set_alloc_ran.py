import models
from models import db, get_app
app = get_app()
with app.app_context():
    models.set_config_value('allocation_ran', 'false')
print('Done - allocation_ran set to false in DB')
