from sqlalchemy.orm import Session
from . import models, schemas
from sqlalchemy import and_, or_, func

def get_episode_by_uid(db: Session, uid: str):
    query = db.query(func.count(models.Game.userid)).filter(and_(models.Game.userid == uid, models.Game.time_spent=='start'))
    return query.scalar()

def get_episode_by_uid_condition(db: Session, uid: str, condition: int):
    # query = db.query(func.count(models.Game.userid)).filter(and_(models.Game.userid == uid, models.Game.condition == condition, \
    #     models.Game.episode != 0, models.Game.time_spent=='start'))
    query = db.query(func.max(models.Game.episode)).filter(and_(models.Game.userid == uid, models.Game.condition == condition))
    return query.scalar()

def get_total_score(db: Session, uid: str, condition: int):
    num_green = db.query(func.count(models.Game.userid)).filter(and_(models.Game.userid == uid, models.Game.condition == condition, \
        models.Game.target=='green_victim', models.Game.episode != 0)).scalar()
    num_yellow = db.query(func.count(models.Game.userid)).filter(and_(models.Game.userid == uid, models.Game.condition == condition, \
        models.Game.target=='yellow_victim', models.Game.episode != 0)).scalar()
    res = num_green * 10 + num_yellow * 30
    return res

def create_game(db: Session, game: schemas.GameCreate):
    db_game = models.Game(condition=game.condition, userid=game.userid, episode=game.episode, target=game.target, \
        target_pos=game.target_pos, num_step=game.num_step, time_spent=game.time_spent, \
        trajectory=game.trajectory)
    db.add(db_game)
    db.commit()
    db.refresh(db_game)
    return db_game