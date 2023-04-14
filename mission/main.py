from mission import app, templates
from fastapi import Request, status
from starlette.responses import RedirectResponse, Response

from sqlalchemy.orm import Session
from fastapi import Depends, FastAPI, HTTPException, Form

from . import models, schemas, crud
from .db import ENGINE, SessionLocal
from fastapi_socketio import SocketManager

models.Base.metadata.create_all(bind=ENGINE)

sio = SocketManager(app=app)

import csv
import json
import pandas as pd
import ast
import os
from datetime import datetime


###########
# Globals #
###########

# Read in global config
CONF_PATH = os.path.join(os.getcwd(), "mission/config.json")
with open(CONF_PATH, 'r') as f:
    CONFIG = json.load(f)

# condition name
cond_name = CONFIG['cond_name']
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
# Time perturbation happens
perturbation_time = CONFIG['perturbation_time']


DATA_DIR = os.path.join(os.getcwd(),'data')
is_exist = os.path.exists(DATA_DIR)
if not is_exist:
  os.makedirs(DATA_DIR)
  print(f"The new directory {DATA_DIR} is created!")


room_data = {} 
roomid_players = {} 
scoreboard_players = {} 



def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()    

def process_map(file):
    df_map = pd.read_csv(MAP_DIR+file)
    # print("Shape: ", df_map.shape)
    new_map = pd.melt(df_map, id_vars='x/z', value_vars=[str(i) for i in range(0,(df_map.shape[1]-1))], var_name='z', value_name='key')
    new_map = new_map.rename(columns={"x/z": "x"})
    new_map.index.name='id'
    new_map['key'] = new_map['key'].fillna(12)
    dict_codebook = pd.read_csv(MAP_DIR+'codebook.csv').to_dict()
    new_map['key2'] = new_map.apply(lambda x: dict_codebook['name'][list(dict_codebook['number'].values()).index(x['key'])], axis=1)
    new_map['press'] = new_map.apply(lambda x: dict_codebook['press'][list(dict_codebook['number'].values()).index(x['key'])], axis=1)
    new_map['reward'] = new_map.apply(lambda x: dict_codebook['reward'][list(dict_codebook['number'].values()).index(x['key'])], axis=1)
    new_map.columns = ['z', 'x', 'code', 'key', 'press', 'reward']
    new_file = file.split('.')[0]+'_new.csv'
    new_map.to_csv(MAP_DIR+new_file)
    

def readMapFile(csvFilePath):
    data = {}     
    with open(csvFilePath, encoding='utf-8') as csvf: 
        csvReader = csv.DictReader(csvf) 
        for rows in csvReader: 
            key = rows['id'] 
            data[key] = rows
    return data

def get_map():
    if is_new_map:
        process_map(map_file)
        new_file = map_file.split('.')[0]+'_new.csv'
        csvFilePath = MAP_DIR+new_file
    elif complexity =='complex':
        csvFilePath = MAP_DIR+'map_complex.csv'
    elif complexity =='simple':
        csvFilePath = MAP_DIR+'map_simple.csv'
    
    return readMapFile(csvFilePath)

# get_map()

@app.sio.on('connect')
async def on_connect(sid: str, *args, **kwargs):
    print('User id (connected socketid): ', sid)
    
    

@app.sio.on('join')
async def on_join(sid, *args):
    msg = args[0]
    # print ('Call join...', args)
    roomid_players[msg['pid']] = {}
    room_data[msg['pid']] = []
    scoreboard_players[msg['pid']] = {'green':0, 'yellow':0, 'red':0}

@app.sio.on('record')
async def on_record_data(sid, *args, **kwargs):
    global roomid_players

    msg = args[0]
    pid = msg['pid']
    roomid_players[pid]['x']=msg["x"]
    roomid_players[pid]['y']=msg["y"]
    roomid_players[pid]['timestamp']=datetime.now().timestamp()
    roomid_players[pid]['mission_time']=msg["mission_time"]
    roomid_players[pid]['event']=msg["event"]
    if msg["event"]=='green' or msg["event"]=='yellow' or msg["event"]=='red':
        scoreboard_players[pid][msg["event"]] = scoreboard_players[pid][msg["event"]] + 1
    
    roomid_players[pid]['score']=scoreboard_players[pid]
    output = {}
    room_data[msg['pid']].append(json.dumps(roomid_players[msg['pid']]))
    await app.sio.emit('on change', {"list_players":roomid_players[msg['pid']], "score":scoreboard_players[msg['pid']]})

@app.sio.on('end')
async def handle_episode(sid, *args, **kwargs):
    global agents
    msg = args[0]
    print('received episode info: ' + str(msg))
    game_over = msg['episode']
    print("END EPISODE: ", game_over)

    pid = msg['pid']
    
    roomid_players[pid]['x']=msg["x"]
    roomid_players[pid]['y']=msg["y"]
    roomid_players[pid]['uid']=msg["uid"]
    roomid_players[pid]['timestamp']=datetime.now().timestamp()
    roomid_players[pid]['mission_time']=msg["mission_time"]
    roomid_players[pid]['event']=msg["event"]
    roomid_players[pid]['score']=scoreboard_players[msg['pid']]
    room_data[msg['pid']].append(json.dumps(roomid_players[msg['pid']]))
    
    new_path = f'{DATA_DIR}/data_user_{pid}_episode_{game_over}_cond_{cond_name}.json'
    with open(new_path, 'w') as outfile:
        json.dump(room_data[pid], outfile)

######################
# Application routes #
######################
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
    game_entity = set()
    reward_dict = {}
    press_dict = {}

    for k in list(map_data.keys()):
        x_pos.add(map_data[k]['x'])
        y_pos.add(map_data[k]['z'])
        if map_data[k]['key'] != '':
            game_entity.add(map_data[k]['key'])
            reward_dict[map_data[k]['key']]= map_data[k]['reward']
            press_dict[map_data[k]['key']]= map_data[k]['press']
    
    x_pos = [int(i) for i in x_pos]
    y_pos = [int(i) for i in y_pos]
    max_x = max(x_pos)
    max_y = max(y_pos)
    return {"map_data":map_data, 'max_x':max_x, 'max_y':max_y, 'duration':GAME_DURATION, \
        'max_episode':MAX_EPISODE, 'time_die':time_die, 'visibility':visibility, 'tile_width': CONFIG['tile_width'],\
            'complexity':complexity, 'delayed_time': delayed_time, 'game_entity': game_entity, \
                'reward': reward_dict, 'press':  press_dict,
                'perturbation_time': CONFIG['perturbation_time']}


@app.get("/pertubation/")
async def get_update():
    file = CONFIG['map_perturbation']
    process_map(file)
    new_file = file.split('.')[0]+'_new.csv'
    csvFilePath = MAP_DIR+new_file
    map_data = readMapFile(csvFilePath)
    game_entity = set()
    reward_dict = {}
    press_dict = {}
    for k in list(map_data.keys()):
        if map_data[k]['key'] != '':
            game_entity.add(map_data[k]['key'])
            reward_dict[map_data[k]['key']]= map_data[k]['reward']
            press_dict[map_data[k]['key']]= map_data[k]['press']
    return {"map_data":map_data, 'game_entity': game_entity,  'reward': reward_dict, 'press':  press_dict}

        

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


@app.get("/replay/")
async def get_full_map(request:Request, uid: str = 'TEST123', session:int = 1):
    directory = os.getcwd()
    # directory = directory+'/data/demo'
    directory = DATA_DIR
    items = []
    for myfile in sorted(os.listdir(directory)):
        if myfile!='.DS_Store':
            items.append(myfile)
    return templates.TemplateResponse("startvis.html", {"request":request, "items":items, "data":uid, "session":session})


@app.post("/replay/")
async def post_full_map(request:Request, uid: str = Form(...), session:int = Form(...), fname: str = Form(...)):
    global vis_data
    global vis_data_file
    vis_data_file = fname
    print("Call replay: ", uid)
    print("Call replay: ", fname)
    vis_data = read_file(fname)
    return templates.TemplateResponse("replay.html", {"request":request, "data":uid})


######################
# Utility Visualization:
######################
# config_vis = None 
vis_players = {}
data_dict = {}
vis_score = {}
vis_data_file = None
player_id = None

def read_file(fname):
    # global vis_players
    global gid
    global data_dict
    global vis_score
    global player_id

    if not fname.endswith('json'):
        return 0
    f = open(os.path.join(os.getcwd(), 'data', fname))
    # f = open(DATA_DIR, fname)
    vis_data = json.load(f)
    vis_players[player_id] = {}
    count = 0
    
    # num players in the vis file:
    num_vis_players = len(list(json.loads(vis_data[-1]).keys()))
    print(f'num_vis_players: {num_vis_players}')

    for line in vis_data:
        message = ast.literal_eval(line)
        # print()
        # if len(list(message.keys())) != num_vis_players:
        #     continue
        # for player in message.keys():
        #     vis_players[player] = {}
        data_dict[count] = message
        # print("Data dict:", data_dict)
        vis_score[count] = message['score']
        count += 1
    return vis_data

@app.sio.on('start_vis')
async def sio_start_visualization(sid, *args, **kwargs):
    global vis_data
    global vis_players
    global replay
    global player_id

    msg = args[0]
    replay = msg['replay']
    print('Call start_vis')

@app.get("/vis-episode")
async def get_episode(request:Request):
    global vis_data_file
    # episode = CONFIG['vis_file'].split('_')[4].split('.')[0]
    episode = vis_data_file.split('_')[4].split('.')[0]
    player_id = vis_data_file.split('_')[2]
    print('Vis episode: ', episode)
    return {'uid': player_id, 'episode':episode} 

@app.sio.on('play_vis')
async def sio_play_visualization(sid, *args, **kwargs):
    print('Call play_vis')
    global vis_data
    global vis_players
    global player_id
    # gid = CONFIG['vis_file'].split('_')[2]
    for line in vis_data:
        message = ast.literal_eval(line)
        
        vis_players[player_id]['x']=message['x']
        vis_players[player_id]['y']=message['y']
        # vis_players[player_id]['uid'] = player
        vis_players[player_id]['event']=message['event']
        scoreboard_players[player_id] = message['score']
        await app.sio.emit('vis_change', {"list_players":vis_players[player_id], "score":scoreboard_players[player_id], "roomid":gid})

def step_counter(reset = False):
    if "counter" not in step_counter.__dict__:
        step_counter.counter = 0
    
    if reset:
        step_counter.counter = 0
    else:
        step_counter.counter += 1

    return step_counter.counter

step_counter(reset = True)

@app.get("/agent_pos")
async def get_agent_positions():
    global vis_data
    global vis_players
    global gid 
    global data_dict
    global replay
    if replay:
        print('Call replay: ', replay)
        step_counter(reset = True)
        replay = False
    curr_step = step_counter()
    # print("Data dict cur: ", data_dict[curr_step])
    if  curr_step in data_dict.keys():
        # main(data_dict[curr_step], config_players[gid])
        res =  {"list_players":data_dict[curr_step], "score":vis_score[curr_step]}
    else:
        res = False
        print('Out of data')
    # print('Res: ', res)
    return res