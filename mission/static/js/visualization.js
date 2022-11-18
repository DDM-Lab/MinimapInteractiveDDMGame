var namespace = "http://" + document.domain + ":" + location.port;
var socket = io(namespace, { path: "/ws/socket.io" });

var grid, gridCopy;
var cols;
var rows;
var width, height;
var w = 12;
var agentX;
var agentY;
var agentDirX;
var agentDirY;
var curX, curY;

const uid = document.getElementById("uid").value;
var groupID;

var numSteps = 0;
var traces = [];
var cost = 0;
var score = 0;
var block = 0;
var targetSteps = 0;

var isGameOver = false;

var countPress = 0;
var rescue = 0;
const timeDisplay = document.querySelector("#playtime");
var totalMinutes = 5 * 60;
var display = document.querySelector("#time");

// var episode=0;
var episode = document.getElementById("session").value;
var maxEpisode;
const episodeDisplay = document.getElementById("episode");

const dist = 2;
var listFoV = [];
var listYellow = [];
var minuteYellowDie = 3;
var secondYellowDie = 0;

var listRed = [];
var minuteRedDie = 2;
var secondRedDie = 0;

var iframe = document.getElementById("frame-qualtrics");
var closeBtn = document.getElementById("close-button");
var chkMap = document.querySelector("#map");
var chkFull = document.querySelector("#full_falcon");

var numRescuedGreen = 0;
var numRescuedYellow = 0;
var numRescuedRed = 0;
var otherX = [];
var otherY = [];
var roles = [];
var players = [];
var playerId;
var groupSize;
var roleName = "";
var roomid;

var isFirst = true;
var intervalRecordData;
var intervalEmitSocket;

let effortHis = [],
  skillHis = [],
  efficiency = [];
var agentPreX = [],
  agentPreY = [];

// waiting room
var lobbyWaitTime = 10 * 60 * 1000; //wait 10 minutes
window.intervalID = -1;
window.ellipses = -1;
window.lobbyTimeout = -1;

window.onload = function () {
  showFullView(chkFull);
};

function showElement(ElementId) {
  document.getElementById(ElementId).style.display = "block";
}

function hideElement(ElementId) {
  document.getElementById(ElementId).style.display = "none";
}

function showMap(chkMap) {
  if (chkMap.checked) {
    ISMAP = true;
  } else {
    DEBUG = false;
    ISMAP = false;
  }
}

function showFullView(chkFull) {
  if (chkFull.checked) {
    DEBUG = true;
  } else {
    DEBUG = false;
  }
}

var isReplay = true;
function myReplay(z) {
  var x = document.getElementById("replayStatus");
  z.classList.toggle("fa-play-circle");
  if (x.innerHTML === "Playing") {
    isReplay = false;
    x.innerHTML = "Pausing";
  } else {
    x.innerHTML = "Playing";
    isReplay = true;
  }
}

function setup() {
  // showFullView(chkFull);
  console.log("Client socket: ", socket.id);
  playerId = uid;
  console.log("Client socket id:", playerId);

  var canvas = createCanvas(0, 0);
  frameRate(30);

  showElement("game-container");
  async function getEpisode() {
    const response = await fetch("/vis-episode");
    const data = await response.json();
    episode = Number(data["episode"]);
    episodeDisplay.textContent = "Episode: " + episode;
  }
  getEpisode();
  $("#tab-panel").show();
  $("#tabgame").show();
  $("#lobby").hide();

  socket.emit("start_vis", { replay: true });
  getMap();

  async function getMap() {
    const response = await fetch("/map/");
    const data = await response.json();

    width = (parseInt(data["max_x"]) + 1) * w + 1;
    height = (parseInt(data["max_y"]) + 1) * w + 1;
    var canvas = createCanvas(width, height); //
    canvas.parent("sketch-holder");
    cols = floor(width / w);
    rows = floor(height / w);
    grid = make2DArray(cols, rows);
    gridCopy = make2DArray(cols, rows);
    for (var i = 0; i < cols; i++) {
      for (var j = 0; j < rows; j++) {
        grid[i][j] = new Cell(i, j, w);
      }
    }
    generateGrid(data["map_data"]);

    maxEpisode = parseInt(data["max_episode"]);
  }

}

function getListPlayers() {
  socket.on("vis_change", function (msg) {
    agentX = parseInt(msg["list_players"]["x"]);
    agentY = parseInt(msg["list_players"]["y"]);
    console.log("Call vis_change: ", grid[agentX][agentY].goal);
    updateEnvironment(agentX, agentY);
    updateScoreBoard(msg["score"]["green"], msg["score"]["yellow"]);
  });
}

function updateScoreBoard(green, yellow) {
  rescue = green * 10 + yellow * 30;
  numRescuedGreen = green;
  numRescuedYellow = yellow;
  document.getElementById("goal").innerHTML = "Points: " + rescue.toString();
  document.getElementById("green").innerHTML =
    "Green: " + numRescuedGreen.toString();
  document.getElementById("yellow").innerHTML =
    "Yellow: " + numRescuedYellow.toString();
}

function updateEnvironment(loc_x, loc_y) {
  if (grid[loc_x][loc_y].goal == "yellow victims") {
    grid[loc_x][loc_y].goal = "";
  }

  if (grid[loc_x][loc_y].goal == "green victims") {
    grid[loc_x][loc_y].goal = "";
  }
  if (grid[loc_x][loc_y].goal == "doors") {
    grid[loc_x][loc_y].goal = "";
  }
}

function updateMissionTime(missionTime) {
  var minutes = missionTime.split(":")[0];
  var seconds = missionTime.split(":")[1];
  document.getElementById("time").innerHTML = minutes + ":" + seconds;
  if ((minutes == "02" && seconds == "00:") || minutes < "02") {
    for (var i in listYellow) {
      var posX = listYellow[i][0];
      var posY = listYellow[i][1];
      grid[posX][posY].goal = "";
    }
  }
}

function generateGrid(data) {
  size = Object.keys(data).length;
  for (let entry of Object.entries(data)) {
    var type = entry[1]["key"];
    var posX = Number(entry[1]["x"]);
    var posY = Number(entry[1]["z"]);
    grid[posX][posY].goal = type;
    grid[posX][posY].prev = type;

    if (type == "yellow") {
      listYellow.push([posX, posY]);
    }
    if (type == "red") {
      listRed.push([posX, posY]);
    } else if (type == "agent") {
      agentX = posX;
      agentY = posY;
      agentDirX = 0;
      agentDirY = 0;
    }
  }

  traces.push("(" + agentX + "," + agentY + ")");
}

function writeData(data) {
  const dataOptions = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  };
  fetch("/game_play", dataOptions);
}

async function getAgentData() {
  const response = await fetch("/agent_pos");
  const msg = await response.json();
  if (agentPreX.length > 0) {
    for (var i = 0; i < agentPreX.length; i++) {
      grid[agentPreX[i]][agentPreY[i]].markAsVisitedbyAgent();
    }
  }
  if (msg != false) {
    var posX = parseInt(msg["list_players"]["x"]);
    var posY = parseInt(msg["list_players"]["y"]);
    agentPreX.push(posX);
    agentPreY.push(posY);
    var missionTime = msg["list_players"]["mission_time"];
    grid[posX][posY].agent = true;
    grid[posX][posY].addAgent();
    // grid[posX][posY].goal = roles[k];
    agentX = posX;
    agentY = posY;
    updateEnvironment(posX, posY);
    updateScoreBoard(
      msg["list_players"]["score"]["green"],
      msg["list_players"]["score"]["yellow"]
    );
    updateMissionTime(missionTime);
  }
}

function draw() {
  // background(200,200,200,127);
  background(173, 216, 230, 127);

  if (isReplay) {
    getAgentData();
    for (var i = 0; i < cols; i++) {
      for (var j = 0; j < rows; j++) {
        grid[i][j].show();
        gridCopy[i][j] = grid[i][j];
      }
    }
  } else {
    showGridCopy();
  }
}

function showGridCopy() {
  if (agentPreX.length > 0) {
    for (var i = 0; i < agentPreX.length; i++) {
      gridCopy[agentPreX[i]][agentPreY[i]].markAsVisitedbyAgent();
    }

    gridCopy[agentPreX[agentPreX.length - 1]][
      agentPreY[agentPreY.length - 1]
    ].addAgent();
  }
  for (var i = 0; i < cols; i++) {
    for (var j = 0; j < rows; j++) {
      gridCopy[i][j].show();
    }
  }
}

function isFoV(paraX, paraY, mDist) {
  var mLeft = agentX - mDist;
  var mRight = agentX + mDist;
  var mUp = agentY - mDist;
  var mDown = agentY + mDist;
  if (agentY == 0) {
    mUp = 0;
  } else if (agentY == height) {
    mDown = height;
  }
  if (agentX == 0) {
    mLeft = 0;
  } else if (agentX == width) {
    mRight = width;
  }
  return paraX >= mLeft && paraX <= mRight && paraY >= mUp && paraY <= mDown;
}

function make2DArray(cols, rows) {
  var arr = new Array(cols);
  for (var i = 0; i < arr.length; i++) {
    arr[i] = new Array(rows);
  }
  return arr;
}

var timeout;
function startTimer(duration, display) {
  var start = Date.now(),
    diff,
    minutes,
    seconds;

  function timer() {
    diff = duration - (((Date.now() - start) / 1000) | 0);

    if (diff >= 0) {
      minutes = (diff / 60) | 0;
      seconds = diff % 60 | 0;
      minutes = minutes < 10 ? "0" + minutes : minutes;
      seconds = seconds < 10 ? "0" + seconds : seconds;
      display.textContent = minutes + ":" + seconds;
      document.getElementById("time").innerHTML = minutes + ":" + seconds;
    }
  }
  timer();
  timeout = setInterval(timer, 1000);
}

