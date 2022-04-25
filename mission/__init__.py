from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

app = FastAPI()

app.mount("/static", StaticFiles(directory="./mission/static"), name="static")
templates = Jinja2Templates(directory="./mission/templates")

from mission import main