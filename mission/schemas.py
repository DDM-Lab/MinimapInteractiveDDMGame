from typing import List
from pydantic import BaseModel


class GameBase(BaseModel):
    userid: str

class GameCreate(GameBase):
    condition: int
    episode: int
    target: str
    target_pos: str
    num_step: int
    time_spent: str
    trajectory: str

class Game(GameBase):
    id: int
    userid: str

    class Config:
        orm_mode = True