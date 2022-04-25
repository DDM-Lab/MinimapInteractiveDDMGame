from mission import app, templates
from fastapi import Request, status
from starlette.responses import RedirectResponse, Response

from sqlalchemy.orm import Session
from fastapi import Depends, FastAPI, HTTPException

from . import models, schemas, crud
from .db import ENGINE, SessionLocal

models.Base.metadata.create_all(bind=ENGINE)

import csv
import json
import numpy as np
import pandas as pd
import os

###########
# Globals #
###########

# Read in global config
CONF_PATH = os.path.join(os.getcwd(), "mission/config.json")
with open(CONF_PATH, 'r') as f:
    CONFIG = json.load(f)

# Path to where new designed maps is located
MAP_DIR = CONFIG['map_dir']
is_new_map = CONFIG['load_new_map']
map_file =CONFIG['map_file'] 
# Maximum allowable game length (in seconds)
GAME_DURATION = CONFIG['game_duration']
# Maximum number of playing episodes
MAX_EPISODE = CONFIG['max_episode']
# At time critical victims die (in seconds)
time_die = CONFIG['victim_die']
# Opaquenes: fov, map, full
visibility = CONFIG['visibility']
# Structural complexity: simple, complex
complexity = CONFIG['complexity']
# Delay in the player's action
delayed_time =  CONFIG['delayed_time']

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()    

def process_map():
    # df_map = pd.read_csv('mission/static/data/map_design.csv')
    df_map = pd.read_csv(MAP_DIR+map_file)
    new_map = pd.melt(df_map, id_vars='x/z', value_vars=[str(i) for i in range(0,95)], var_name='z', value_name='key')
    new_map = new_map.rename(columns={"x/z": "x"})
    new_map.index.name='id'
    new_map['key'] = new_map['key'].fillna(12)
    dict_codebook = pd.read_csv(MAP_DIR+'codebook.csv').to_dict()
    new_map['key2'] = new_map.apply(lambda x: dict_codebook['name'][list(dict_codebook['number'].values()).index(x['key'])], axis=1)
    # new_map['key2'] = codebook(6)
    new_map.columns = ['z', 'x', 'code', 'key']
    new_file = map_file.split('.')[0]+'_new.csv'
    new_map.to_csv(MAP_DIR+new_file)
    

def get_map():
    if is_new_map:
        process_map()
        new_file = map_file.split('.')[0]+'_new.csv'
        csvFilePath = MAP_DIR+new_file
    elif complexity =='complex':
        csvFilePath = MAP_DIR+'map_complex.csv'
    elif complexity =='simple':
        csvFilePath = MAP_DIR+'map_simple.csv'
    data = {} 
    global map_data
    with open(csvFilePath, encoding='utf-8') as csvf: 
        csvReader = csv.DictReader(csvf) 
        for rows in csvReader: 
            key = rows['id'] 
            data[key] = rows
    map_data = data
    # print(map_data)
    return data

# get_map()

@app.get("/")
async def index(request:Request):
    return {"message": "Welcome"}

@app.get("/minimap/")
async def load_map(request:Request, uid:str):
    return templates.TemplateResponse("map.html", {"request":request, "data":uid})

@app.post("/minimap/")
async def load_map(request:Request, uid:str):
    return templates.TemplateResponse("map.html", {"request":request, "data":uid})

@app.get("/episode/{uid}/{condition}")
async def get_episode(request:Request, uid:str, condition:int, db: Session = Depends(get_db)):
    # episode = crud.get_episode_by_uid(db, uid)
    episode = crud.get_episode_by_uid_condition(db, uid, condition)
    return episode


@app.get("/map/")
async def get_map_data():
    map_data = get_map()
    x_pos = set()
    y_pos = set()
    for k in list(map_data.keys()):
        x_pos.add(map_data[k]['x'])
        y_pos.add(map_data[k]['z'])
    x_pos = [int(i) for i in x_pos]
    y_pos = [int(i) for i in y_pos]
    max_x = max(x_pos)
    max_y = max(y_pos)
    return {"map_data":get_map(), 'max_x':max_x, 'max_y':max_y, 'duration':GAME_DURATION, \
        'max_episode':MAX_EPISODE, 'time_die':time_die, 'visibility':visibility, \
            'complexity':complexity, 'delayed_time': delayed_time}


@app.post("/game_play", response_model=schemas.Game)
async def create_game(game: schemas.GameCreate, db: Session = Depends(get_db)):
    return crud.create_game(db=db, game=game)

@app.get("/score/{uid}/{condition}")
async def get_total_score(request:Request, uid:str, condition:int, db: Session = Depends(get_db)):
    score = crud.get_total_score(db, uid, condition)
    return score

@app.post("/post_survey")
async def survey(uid:str):
    return RedirectResponse(url="http://cmu.ca1.qualtrics.com/jfe/form/SV_bCtmcydPxNpJROZ?uid="+uid, status_code=status.HTTP_303_SEE_OTHER)