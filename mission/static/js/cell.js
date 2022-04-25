// var DEBUG = true;
// var ISMAP = false;
function Cell(i, j, w) {
  this.i = i;
  this.j = j;
  this.x = i * w;
  this.y = j * w;
  this.w = w;

  this.revealed = false;
  this.over = false;

  this.block = false;
  this.agent = false;
  this.goal = '';
  this.value = 0;
}

Cell.prototype.show = function () {
  stroke(192,192,192);
  noFill();
  rect(this.x, this.y, this.w, this.w);
  if (this.revealed) {
    fill(127);
    // Add blocks
    if (this.block) {
      fill(0);
      rect(this.x, this.y, this.w, this.w);
    }

    if (this.goal == 'walls' || this.goal == 'wall') {
      fill(128, 128, 128);
      rect(this.x, this.y, this.w, this.w);
    }
    else if (this.goal == 'doors' || this.goal == 'door') {
      fill(128, 0, 128); //purple
      rect(this.x, this.y, this.w, this.w);
    }
    else if (this.goal == 'yellow victims' || this.goal == 'yellow') {
      fill(255,215,0);//gold
      rect(this.x, this.y, this.w, this.w);
    } else if (this.goal == 'stairs' || this.goal == 'stair') {
      fill(182,182,182);
      rect(this.x, this.y, this.w, this.w);
    }
    else if (this.goal == 'green victims' || this.goal == 'green') {
      fill(0, 128, 0);
      rect(this.x, this.y, this.w, this.w);
    }
  }

  if (this.over) {
    fill(127);
    rect(this.x, this.y, this.w, this.w);
  }
  
  // Add borders
  if (this.goal == 'borders') {
    // fill(200,200,200,127);
    fill(173,216,230,127);
    rect(this.x, this.y, this.w, this.w);
  }
  if (DEBUG) {
    // Add blocks
    if (this.block) {
      fill(0);
      rect(this.x, this.y, this.w, this.w);
    }
    if (this.goal == 'walls' || this.goal == 'wall') {
      fill(128, 128, 128);
      rect(this.x, this.y, this.w, this.w);
    }
    else if (this.goal == 'doors' || this.goal == 'door') {
      fill(128, 0, 128);
      rect(this.x, this.y, this.w, this.w);
    }
    else if (this.goal == 'yellow victims' || this.goal == 'yellow') {
      fill(255,215,0);
      rect(this.x, this.y, this.w, this.w);
    } else if (this.goal == 'stairs' || this.goal == 'stair') {
      // fill(192,192,192);
      fill(182,182,182);
      rect(this.x, this.y, this.w, this.w);
    }
    else if (this.goal == 'green victims' || this.goal == 'green') {
      fill(0, 128, 0);
      rect(this.x, this.y, this.w, this.w);
    }
  }
  if (ISMAP) {
    if (this.block) {
      fill(0);
      rect(this.x, this.y, this.w, this.w);
    }
    if (this.goal == 'walls' || this.goal == 'wall') {
      fill(128, 128, 128);
      rect(this.x, this.y, this.w, this.w);
    }
    else if (this.goal == 'doors' || this.goal == 'door') {
      fill(128, 0, 128);
      rect(this.x, this.y, this.w, this.w);
    }
  }
}

Cell.prototype.addAgent = function () {
  this.agent = true;
  fill(255,83,73);
  ellipse(this.x + this.w * 0.5, this.y + this.w * 0.5, this.w);
}

Cell.prototype.drawFoV = function () {
  fill(250,250,250,63);
  rect(this.x, this.y, this.w, this.w);
}

Cell.prototype.addText = function (val){
  textAlign(CENTER);
  fill(0);
  text(val, this.x + this.w * 0.5, this.y + this.w - 15);
}

Cell.prototype.contains = function (x, y) {
  return (x > this.x && x < this.x + this.w && y > this.y && y < this.y + this.w);
}

Cell.prototype.reveal = function () {
  this.revealed = true;
}