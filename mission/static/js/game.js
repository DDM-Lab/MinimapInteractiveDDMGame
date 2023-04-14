var namespace = 'http://' + document.domain + ':' + location.port;
var socket = io(namespace, { path: '/ws/socket.io' });

var grid, gridCopy;
var cols;
var rows;
var w = 13;
// var w = 16;
var width, height;
var agentX = -1;
var agentY = -1;
var curX, curY;

var numSteps = 0;
var traces = [];
var cost = 0;
var score = 0;
var block = 0;
var targetSteps = 0;
var isGameOver = false;

var countPress = 0;
var rescue = 0;
const timeDisplay = document.querySelector('#playtime');
var gameDuration; 
var totalMinutes;
var display = document.querySelector('#time');

const uid = document.getElementById("uid").value;
// const condition = document.getElementById("session").value;
var condition;
var maxEpisode; //8
const episodeDisplay = document.getElementById('episode');

const dist = 2;
var listFoV = [];
var listDisappear = [];

var timeDie;

var visibility;
var complexity;
var delay;
var gameEntity;
var reward_dict;
var press_dict;

var iframe = document.getElementById('frame-qualtrics');
var closeBtn = document.getElementById('close-button');

var DEBUG=false;
var ISMAP=false;
let socketIOBuffer = [];

function showElement(ElementId) {
  document.getElementById(ElementId).style.display = 'block';
}

function hideElement(ElementId) {
  document.getElementById(ElementId).style.display = 'none';
}

function sendFailedSocketEmits() {
  if (socketIOBuffer.length > 0) {
    for (let i = 0; i < socketIOBuffer.length; i++) {
      emmitSocketIO(socketIOBuffer[i].endpoint, socketIOBuffer[i].value);
    }
  }
}

const withTimeout = (onSuccess, onTimeout, timeout) => {
  let called = false;

  const timer = setTimeout(() => {
    if (called) return;
    called = true;
    onTimeout();
  }, timeout);

  return (...args) => {
    if (called) return;
    called = true;
    clearTimeout(timer);
    onSuccess.apply(this, args);
  }
}

function emmitSocketIO(endpoint, value) {
  try {
    if (socket) {
      socket.emit(endpoint, value, withTimeout(
        () => { },
        () => {
          socketIOBuffer.push({ endpoint: endpoint, value: value })
        }, 1000));
    } else {
      socketIOBuffer.push({ endpoint: endpoint, value: value })
    }
  } catch (e) {
    socketIOBuffer.push({ endpoint: endpoint, value: value })
  }
}

function setup() {
  showElement("game-container");
  // episodeDisplay.textContent = 'Episode: ' + episode;
  getMap();
  
  console.log("Client socket: ", socket.id);
  playerId = uid;
  console.log('Client socket id:', playerId);

  emmitSocketIO("join", { "pid": playerId, "uid": uid });

  async function getMap(level) {
    const response = await fetch('/map/');
    const data = await response.json();
    w = parseInt(data["tile_width"]);
    
    width = (parseInt(data["max_x"])+1) * w + 1;
    height = (parseInt(data["max_y"])+1) * w + 1;
    var canvas = createCanvas(width, height); 
    canvas.parent('sketch-holder');
    cols = floor(width / w);
    rows = floor(height / w);
    grid = make2DArray(cols, rows);
    gridCopy = make2DArray(cols, rows);
    
    for (var i = 0; i < cols; i++) {
      for (var j = 0; j < rows; j++) {
        grid[i][j] = new Cell(i, j, w);
        gridCopy[i][j] = new Cell(i, j, w);
      }
    }

    totalMinutes =  parseInt(data["duration"]);
    gameDuration = totalMinutes / 60 
    maxEpisode = parseInt(data["max_episode"]);
    // console.log(maxEpisode);
    timeDie = parseInt(data["time_die"]);
    startTimer(totalMinutes, display);
    
    //create an environment
    generateGrid(data["map_data"]); 

    visibility = data["visibility"];
    complexity = data["complexity"];
    delay = data['delayed_time']*1000;
    gameEntity = data['game_entity'];
    perturbation = data['perturbation_time'];
    reward_dict = Object(data['reward']);
    press_dict = Object(data['press']);
    
    if (visibility=='fov'){
      ISMAP = false
      if (complexity == "simple"){
        condition = 0
      }else{
        condition = 1
      }
    }else if (visibility=='map'){
      ISMAP = true
      if (complexity == "simple"){
        condition = 2
      }else{
        condition = 3
      }
    }else if (visibility=='full'){
      DEBUG = true;
      if (complexity == "simple"){
        condition = 4
      }else{
        condition = 5
      }
    }
    
    if(timeDie!=0){
      setTimeout(disappear, timeDie*1000);
    }
    if(perturbation!=0){
      setTimeout(updateEnvironment, perturbation*1000);
    }

    setTimeout(gameOver, totalMinutes*1000);
    getEpisode();
    intervalEmitSocket = setInterval(function () {
      if (!isGameOver) {
        emmitSocketIO('record', { "pid": playerId, "x": agentX, "y": agentY, 'mission_time': display.textContent, 'event': '' })
      }
      else {
        clearInterval(intervalEmitSocket);
      }
    }, 1000);
  }

  async function getEpisode() {
    const response = await fetch('/episode/' + uid + '/' + condition + '/');
    const data = await response.json();
    episode = Number(data)+1;
    episodeDisplay.textContent = 'Episode: ' + episode; 

    var initData = {"condition":condition, "userid": uid, "episode":episode, "target":"", "target_pos":"",
    "num_step":0, "time_spent":"start", "trajectory":""};
    writeData(initData);
    emmitSocketIO('record', { "pid": playerId, 'uid': uid, "x": agentX, "y": agentY, 'mission_time': display.textContent, 'event': 'start mission' })
  }  
}

function generateGrid(data) {
  listDisappear = [];
  size = Object.keys(data).length;
  for (let entry of Object.entries(data)) {
    var type = entry[1]['key'];
    var posX = Number(entry[1]['x']);
    var posY = Number(entry[1]['z']);
    grid[posX][posY].goal = type;    
    if (type === "yellow" || type==="red") {
      listDisappear.push([posX, posY]);
    }
    else if (type == "agent") {
      agentX = posX;
      agentY = posY;
      console.log("Agent X; Agent Y: ", agentX, agentY);
    }
  }
  if (agentX === -1 && agentY === -1){
    agentX = 4;
    agentY = 4;
  }
  
  traces.push("(" + agentX + "," + agentY + ")");
}

function generateGridPerturbation(data) {
  listDisappear = [];
  size = Object.keys(data).length;
  for (let entry of Object.entries(data)) {
    var type = entry[1]['key'];
    var posX = Number(entry[1]['x']);
    var posY = Number(entry[1]['z']);
    

    if (grid[posX][posY].goal!=" " && gridCopy[posX][posY].goal != type) {
      grid[posX][posY].goal = type;    
    }
    
    if (type === "yellow" || type==="red") {
      listDisappear.push([posX, posY]);
    }
    else if (type == "agent") {
      agentX = posX;
      agentY = posY;
      console.log("Agent X; Agent Y: ", agentX, agentY);
    }
  }
  if (agentX === -1 && agentY === -1){
    agentX = 4;
    agentY = 4;
  }
  traces.push("(" + agentX + "," + agentY + ")");
}

async function updateEnvironment() {
  const response = await fetch('/pertubation/');
  const data = await response.json();
   //create an environment
   reward_dict = Object(data['reward']);
   press_dict = Object(data['press']);
   gameEntity = data['game_entity'];
   generateGridPerturbation(data["map_data"]); 
   emmitSocketIO('record', { "pid": playerId, "x": agentX, "y": agentY, 'mission_time': display.textContent, 'event': 'perturbation' })
}

function disappear(){
  for(var i in listDisappear){
    var posX = listDisappear[i][0];
    var posY = listDisappear[i][1];
    grid[posX][posY].goal = " ";
  }

}
function gameOver() {
  isGameOver = true;
  clearInterval(intervalEmitSocket);

  timeDisplay.textContent = "GAME OVER !";
  var data = {"condition":condition, "userid": uid, "episode":episode, "target":"", "target_pos":"",
                "num_step":targetSteps, "time_spent":"stop", "trajectory":traces.join(";")};
  writeData(data);

  emmitSocketIO('end', { "pid": playerId, 'uid': uid, "x": agentX, "y": agentY, 'mission_time': display.textContent, 'event': 'end mission', 'episode': episode })

  async function getScore() {
    const response = await fetch('/score/' + uid + '/' + condition);
    const data = await response.json();
    // console.log("Accumulated point: " + Number(data));
    document.getElementById('result').innerHTML = 'Total accumulated points: ' + Number(data);
    showElement("finish-button");
  }

  if (episode == maxEpisode) {
    getScore();
    // showElement("finish-button");
  } else {
    showElement("next-button");
  }
}

function writeData(data){
  const dataOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  };
  fetch('/game_play', dataOptions);
}

function draw() {
  // background(200,200,200,127);
  background(173,216,230,127);
  for (var i = 0; i < cols; i++) {
    for (var j = 0; j < rows; j++) {
      
      if (i==0 || (i==cols-1 && grid[i][j].goal!='wall') ||
      (j==rows-1 && grid[i][j].goal!='wall') ||
      (j==0 && grid[i][j].goal!='wall')){
       grid[i][j].goal = 'wall';
      } 

      if (i == agentX && j == agentY) {
        grid[i][j].agent = true;
        grid[i][j].addAgent();
      }else{
        grid[i][j].agent = false;
      }

      if(isFoV(i,j,dist)){
        listFoV.push("("+i+","+j+")");
      }
      showFoV(i,j,dist);

      grid[i][j].show();
    }
  }

  if (!isGameOver) {
    if (keyIsDown(UP_ARROW) && keyIsDown(88)) {
      countPress = 0; 
      curX = agentX;
      if(agentY == 1){
        curY = agentY;
      }else{
        curY = agentY - 1;
      }
      checkBoundary(curX, curY);
    } else if (keyIsDown(DOWN_ARROW) && keyIsDown(88)) {
      countPress = 0;
      curX = agentX;
      if(agentY==height){
        curY = agentY;
      }else{
        curY = agentY + 1;
      }
      checkBoundary(curX, curY);
    }
    else if (keyIsDown(LEFT_ARROW) && keyIsDown(88)) {
      countPress = 0;
      curY = agentY;
      if(agentX == 0){
        curX = agentX;
      }else{
        curX = agentX - 1;
      }
      checkBoundary(curX, curY);
    } else if (keyIsDown(RIGHT_ARROW) && keyIsDown(88)) {
      countPress = 0;
      curY = agentY;
      if(agentX == width){
        curX = agentX;
      }else{
        curX = agentX + 1;
      }
      checkBoundary(curX, curY);
    } 
  }
}

function myCallback(tmpX, tmpY, consumedTarget, reward)
{
  curX = tmpX;
  curY = tmpY;
  agentX=curX;
  agentY=curY;
  grid[curX][curY].goal = " ";
  countPress = 0;
  reward = parseInt(reward)
  if (reward > 0){
    rescue += reward;
    document.getElementById('goal').innerHTML = 'Points: ' + rescue.toString();
  }
  var targetPos = [curX, curY];
  var data = {"condition":condition, "userid": uid, "episode":episode, "target":consumedTarget, "target_pos":targetPos.toString(),
        "num_step":targetSteps, "time_spent": display.textContent, "trajectory":traces.join(";")};
  writeData(data);
  targetSteps = 0;
  traces = [];
}


var startSpeedUp = false;
let keysPressed = {};
let keyVal;
function keyPressed() {
  if (!isGameOver) {
    if (keyIsDown(88) && !startSpeedUp) {
      if (keyCode === UP_ARROW || keyCode === DOWN_ARROW || keyCode === LEFT_ARROW || keyCode === RIGHT_ARROW) {
        keysPressed[keyCode] = true;
        keyVal = keyCode;
        startSpeedUp = true;
        emmitSocketIO('record', { "pid": playerId, "x": agentX, "y": agentY, 'mission_time': display.textContent, 'event': 'start speedup' })
      }
    }

    if (keyCode === UP_ARROW) {
      countPress = 0; 
      curX = agentX;
      if (agentY == 1) {
        curY = agentY;
      } else {
        curY = agentY - 1;
      }
    } else if (keyCode === DOWN_ARROW) {
      countPress = 0;
      curX = agentX;
      if (agentY == height) {
        curY = agentY;
      } else {
        curY = agentY + 1;
      }
    }
    if (keyCode === LEFT_ARROW) {
      countPress = 0;
      curY = agentY;
      if (agentX == 0) {
        curX = agentX;
      } else {
        curX = agentX - 1;
      }
    } else if (keyCode === RIGHT_ARROW) {
      countPress = 0;
      curY = agentY;
      if (agentX == width) {
        curX = agentX;
      } else {
        curX = agentX + 1;
      }
    }
    if (keyCode === ENTER) {
      countPress += 1;
      var options = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (var i = 0; i < options.length; i++) {
        var tmpX = agentX + options[i][0];
        var tmpY = agentY + options[i][1];
        if (grid[tmpX][tmpY].goal == 'door') {
          sleep(delay).then(() => {myCallback(tmpX, tmpY, "door", 0);});
          emmitSocketIO('record', { "pid": playerId, "x": agentX, "y": agentY, 'mission_time': display.textContent, 'event': 'door' })
          break;
        }
        else if (grid[tmpX][tmpY].goal == 'green') {
          if (countPress < press_dict[grid[tmpX][tmpY].goal]) {
            emmitSocketIO('record', { "pid": playerId, "x": agentX, "y": agentY, 'mission_time': display.textContent, 'event': 'triage green in-progress' })
          }
          if (countPress == press_dict[grid[tmpX][tmpY].goal]) {
            sleep(delay).then(() => {myCallback(tmpX, tmpY, "green_victim", reward_dict[grid[tmpX][tmpY].goal]);});
            emmitSocketIO('record', { "pid": playerId, "x": agentX, "y": agentY, 'mission_time': display.textContent, 'event': 'green' })
            countPress = 0;
            break;
            
          }
        }
        else if (grid[tmpX][tmpY].goal == 'yellow') {
          if (countPress < press_dict[grid[tmpX][tmpY].goal]) {
            emmitSocketIO('record', { "pid": playerId, "x": agentX, "y": agentY, 'mission_time': display.textContent, 'event': 'triage yellow in-progress' })
          }
          if (countPress == press_dict[grid[tmpX][tmpY].goal]) {
            emmitSocketIO('record', { "pid": playerId, "x": agentX, "y": agentY, 'mission_time': display.textContent, 'event': 'yellow' })
            sleep(delay).then(() => {myCallback(tmpX, tmpY, "yellow_victim", reward_dict[grid[tmpX][tmpY].goal]);});
            countPress = 0;
            break;
            
          }
        }
        else if (grid[tmpX][tmpY].goal == 'red') {
          if (countPress < press_dict[grid[tmpX][tmpY].goal]) {
            emmitSocketIO('record', { "pid": playerId, "x": agentX, "y": agentY, 'mission_time': display.textContent, 'event': 'triage red in-progress' })
          }
          if (countPress == press_dict[grid[tmpX][tmpY].goal]) {
            sleep(delay).then(() => {myCallback(tmpX, tmpY, "red_victim", reward_dict[grid[tmpX][tmpY].goal]);});
            emmitSocketIO('record', { "pid": playerId, "x": agentX, "y": agentY, 'mission_time': display.textContent, 'event': 'red' })
            countPress = 0;
            break;
            
          }
        }
        else if (grid[tmpX][tmpY].goal == 'blue') {
          if (countPress < press_dict[grid[tmpX][tmpY].goal]) {
            emmitSocketIO('record', { "pid": playerId, "x": agentX, "y": agentY, 'mission_time': display.textContent, 'event': 'triage blue in-progress' })
          }
          if (countPress == press_dict[grid[tmpX][tmpY].goal]) {
            sleep(delay).then(() => {myCallback(tmpX, tmpY, "blue_victim", reward_dict[grid[tmpX][tmpY].goal]);});
            emmitSocketIO('record', { "pid": playerId, "x": agentX, "y": agentY, 'mission_time': display.textContent, 'event': 'blue' })
            countPress = 0;
            break;
            
          }
        }
        else if (grid[tmpX][tmpY].goal == 'rubble') {
          if (countPress < press_dict[grid[tmpX][tmpY].goal]) {
            emmitSocketIO('record', { "pid": playerId, "x": agentX, "y": agentY, 'mission_time': display.textContent, 'event': 'clear rubble in-progress' })
          }
          if (countPress == press_dict[grid[tmpX][tmpY].goal]) {
            sleep(delay).then(() => {myCallback(tmpX, tmpY, "rubble", reward_dict[grid[tmpX][tmpY].goal]);});
            emmitSocketIO('record', { "pid": playerId, "x": agentX, "y": agentY, 'mission_time': display.textContent, 'event': 'rubble' })
            countPress = 0;
            break;
          }
        }
      }
    }
  }
}

function keyReleased() {
  if (!isGameOver) {
    if (keyCode === 88) {
      if (keysPressed[UP_ARROW] || keysPressed[DOWN_ARROW] || keysPressed[LEFT_ARROW] || keysPressed[RIGHT_ARROW]) {
        delete keysPressed[keyVal];
        startSpeedUp = false;
        emmitSocketIO('record', { "pid": playerId, "x": agentX, "y": agentY, 'mission_time': display.textContent, 'event': 'end speedup' })
      }

    }
    checkBoundary(curX, curY);
  }
}

function checkBoundary(paraX, paraY) {
  if (gameEntity.includes(grid[paraX][paraY].goal)) {
    paraX = agentX;
    paraY = agentY;
  }
  else {
    if(agentX!=paraX || agentY!=paraY){
      agentX = paraX;
      agentY = paraY;
      numSteps += 1;
      targetSteps += 1;
      traces.push("("+agentX+","+agentY+")");
      listFoV=[];
    }
  }
  emmitSocketIO('record', { "pid": playerId, "x": agentX, "y": agentY, 'mission_time': display.textContent, 'event': '' })
}

function showFoV(paraX, paraY, mDist){
  if(agentX>0 &&  agentX<width && agentY>0 && agentY<height){
    var blockList = ['border', 'wall', 'door', 'stair', 'rubble']
    var op1 = [[1, 0], [-1, 0], [0, 1], [0, -1]]; 
    var op2 = [[1, 0], [0, -1], [-1, 0], [0, 1], [1, 0]]; 
    var op = [[[0, 1], [0, 1], [1, 0], [1, 0]], [[0, 0], [0, 0], [0, 0], [0, 0]], [[0, -1], [0, -1], [-1, 0], [-1, 0]]];
    for(var i=0;i<op1.length;i++){
      for(var t=0;t<mDist;t++){
        if(agentX==1 ||  agentX == (width-1) || agentY==1 || agentY==(height-1)){
          if(t>0){
            break;
          }
        }
        if (grid[agentX+op2[i][0]*(t+1)+op2[i+1][0]*t]!=undefined && grid[agentX+op2[i+1][0]*(t+1)+op2[i][0]*t]!=undefined){
          if (grid[agentX+op2[i][0]*(t+1)+op2[i+1][0]*t][agentY+op2[i][1]*(t+1)+op2[i+1][1]*t] != undefined &&
        grid[agentX+op2[i+1][0]*(t+1)+op2[i][0]*t][agentY+op2[i+1][1]*(t+1)+op2[i][1]*t] !=undefined ){
            if(blockList.includes(grid[agentX+op2[i][0]*(t+1)+op2[i+1][0]*t][agentY+op2[i][1]*(t+1)+op2[i+1][1]*t].goal) && 
              blockList.includes(grid[agentX+op2[i+1][0]*(t+1)+op2[i][0]*t][agentY+op2[i+1][1]*(t+1)+op2[i][1]*t].goal)){
                for(var k=1;k<mDist-t+1;k++){
                  for(var h=1;h<mDist-t+1;h++){
                    let idx = listFoV.indexOf("("+(agentX + op2[i][0]*(t+k)+ op2[i+1][0]*(t+h))+","+(agentY+ op2[i][1]*(t+k) + op2[i+1][1]*(t+h))+")")
                    if (idx > -1) {
                      listFoV.splice(idx, 1);
                    }
                  }
                }
             }
          }
        }
        
        
      }
      
      for(var j=0;j<op.length;j++){
        var tmpX = op1[i][0]+op[j][i][0];
        var tmpY = op1[i][1]+op[j][i][1];
        if(blockList.includes(grid[agentX+tmpX][agentY+tmpY].goal)){
          let idx = listFoV.indexOf("("+(agentX+tmpX*2)+","+(agentY+tmpY*2)+")")
          if (idx > -1) {
            listFoV.splice(idx, 1);
          }

          var tmpX3 = op1[i][0]*2+op[j][i][0];
          var tmpY3 = op1[i][1]*2+op[j][i][1];
          idx = listFoV.indexOf("("+(agentX+tmpX3)+","+(agentY+tmpY3)+")")
          if (idx > -1) {
            listFoV.splice(idx, 1);
          }
        }
      }
    }
    
    if (listFoV.indexOf("("+paraX+","+paraY+")") > -1){
      grid[paraX][paraY].revealed=true;
      grid[paraX][paraY].drawFoV();
    }else{
      grid[paraX][paraY].revealed=false;
    }
  }  
}

function isFoV(paraX, paraY, mDist){
  var mLeft = agentX - mDist;
  var mRight = agentX + mDist;
  var mUp = agentY - mDist;
  var mDown = agentY + mDist;
  if(agentY == 0){
    mUp = 0;
  }
  else if(agentY == height){
    mDown = height;
  }
  if(agentX == 0){
    mLeft = 0;
  }
  else if(agentX == width){
    mRight = width;
  }
  return (paraX >= mLeft && paraX <= mRight && paraY >= mUp && paraY <= mDown);
}

function make2DArray(cols, rows) {
  var arr = new Array(cols);
  for (var i = 0; i < arr.length; i++) {
    arr[i] = new Array(rows);
  }
  return arr;
}

function startTimer(duration, display) {
  var start = Date.now(),
    diff,
    minutes,
    seconds;
  var t;
  function timer() {
    diff = duration - (((Date.now() - start) / 1000) | 0);
    

    if (diff >= 0) {
      minutes = (diff / 60) | 0;
      seconds = (diff % 60) | 0;
      minutes = minutes < 10 ? "0" + minutes : minutes;
      seconds = seconds < 10 ? "0" + seconds : seconds;
      display.textContent = minutes + ":" + seconds;
    }

    if (minutes == 0 && seconds == 0) {
      clearInterval(t);
      // gameOver();
    } else if ((minutes != gameDuration && seconds==0) || seconds==30){
      var data = {"condition":condition, "userid": uid, "episode":episode, "target":"", "target_pos":"",
                "num_step": targetSteps, "time_spent": display.textContent, "trajectory":traces.join(";")};
      writeData(data);
      targetSteps = 0;
      traces = [];
    }

  };
  timer();
  t = setInterval(timer, 1000);
}
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}