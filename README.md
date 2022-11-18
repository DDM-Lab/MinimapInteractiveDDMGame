# Minimap: An Interactive Dynamic Decision Making Game for Search and Rescue Missions
This is a browser-based game for Search and Rescue missions. It was written in Python and Javascript and uses the FastAPI Python framework to display the interface in a web browser. 

- Navigate the grid: using `Arrow Keys` or `Arrow Keys + X` to speed up the move
- Open a door: pressing `Enter` key
- Rescue a green victim: pressing `Enter` key 5 times
- Rescue a yellow victim: pressing `Enter` 10 times

## Requirements:
- To run locally:
    - Python 3.7+ installed
    - A Web browser

## Database
Create a database in MySQL using the SQL script `script.sql`.

## Local Installation
1. In a command shell, goto the main folder that contains the `requirements.txt` file.
2. (suggestion) Create a virtual Python Environment by running the following commands in your shell. (This may be different on your machine!  If it does not work, look at how to install a virtual python env based on your system.):
    - `python3 -m venv env`
    - `source env/bin/activate`
3. Install the required python libraries by running this command in your shell:
    - `pip install -r requirements.txt`
4. To start the server, run: `python server.py`

# Usage
Experiment variables are specified in the file `mission/config.json`.

## Contact Info
This application has been developed by Ngoc Nguyen (ngocnt@cmu.edu).
