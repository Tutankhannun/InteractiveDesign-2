const Engine = Matter.Engine;
const Bodies = Matter.Bodies;
const Composite = Matter.Composite;
const Body = Matter.Body;

let engine;
let candle;
let raindrops = [];
let awning;

function setup() {
  createCanvas(windowWidth, windowHeight);
  rectMode(CENTER);
  noStroke();

  // Matter setting
  engine = Engine.create();

  // 바닥과 양쪽 벽
  Composite.add(engine.world, [
    Bodies.rectangle(width / 2, height - 15, width, 30, {
      isStatic: true,
    }),
    Bodies.rectangle(15, height / 2, 30, height, { isStatic: true }),
    Bodies.rectangle(width - 15, height / 2, 30, height, { isStatic: true }),
  ]);

  awning = {
    w: min(width * 0.4, 470),
    y: height * 0.35,
    h: 55,
  };
  candle = new Candle(width * 0.28, height - 30);
}

function draw() {
  background(50);
  Engine.update(engine);

  // 빗방울 생성
  if (random() < 0.15) {
    raindrops.push(new Raindrop(random(width), -30));
  }

  // 빗방울 이동, 그리기, 충돌 확인
  for (let i = raindrops.length - 1; i >= 0; i--) {
    let drop = raindrops[i];
    drop.move();
    drop.display();

    if (drop.hitsFlame()) {
      candle.lit = false;
      raindrops.splice(i, 1);
    } else if (drop.hitsAwning() || drop.hitsCandle() || drop.y > height) {
      raindrops.splice(i, 1);
    }
  }

  drawAwning();
  candle.update();
  candle.display();
}

function drawAwning() {
  fill(215);
  beginShape();
  vertex(0, awning.y);
  vertex(awning.w * 0.65, awning.y + 10);
  vertex(awning.w * 0.85, awning.y + 24);
  vertex(awning.w, awning.y + awning.h);
  vertex(awning.w * 0.8, awning.y + 40);
  vertex(0, awning.y + 40);
  endShape(CLOSE);
}

function mousePressed() {
  candle.press(mouseX, mouseY);
  return false;
}

function mouseDragged() {
  candle.drag(mouseX, mouseY);
  return false;
}

function mouseReleased() {
  candle.release();
  return false;
}

class Candle {
  constructor(x, y) {
    this.w = 75;
    this.h = 190;
    this.body = Bodies.rectangle(x, y - this.h / 2, this.w, this.h, {
      restitution: 0.2,
      friction: 0.8,
    });
    Composite.add(engine.world, this.body);

    this.lit = true;
    this.flameSize = 2;
    this.dragging = false;
    this.offsetX = 0;
    this.offsetY = 0;
    this.lastX = x;
    this.direction = 0;
    this.shake = 0;
    this.still = 0;

    // 작은 불꽃 3개, 중간 불꽃 3개, 큰 불꽃 3개
    this.flames = [
      [
        { w: 16, h: 28, x: -2 },
        { w: 15, h: 30, x: 2 },
        { w: 17, h: 27, x: 0 },
      ],
      [
        { w: 23, h: 42, x: -3 },
        { w: 22, h: 45, x: 3 },
        { w: 24, h: 40, x: 0 },
      ],
      [
        { w: 30, h: 58, x: -4 },
        { w: 28, h: 62, x: 4 },
        { w: 31, h: 56, x: 0 },
      ],
    ];
  }

  update() {
    if (!this.dragging) {
      this.shake *= 0.97;
      this.still++;
    }

    if (this.lit) {
      if (this.shake > 120) {
        this.lit = false;
      } else if (this.shake > 70) {
        this.flameSize = 0;
      } else if (this.shake > 35) {
        this.flameSize = 1;
      }

      // 가만히 두면 불꽃이 다시 커짐
      if (this.still > 80 && this.shake < 25 && frameCount % 50 === 0) {
        this.flameSize = min(this.flameSize + 1, 2);
      }
    }

    // 양초가 넘어지면 꺼짐
    if (abs(this.body.angle) > radians(70)) {
      this.lit = false;
    }
  }

  display() {
    let pos = this.body.position;

    push();
    translate(pos.x, pos.y);
    rotate(this.body.angle);

    fill(250);
    rect(0, 0, this.w, this.h, 15, 15, 0, 0);

    stroke(75, 50, 35);
    strokeWeight(5);
    line(0, -this.h / 2, 0, -this.h / 2 - 15);
    noStroke();

    if (this.lit) this.displayFlame();
    pop();
  }

  displayFlame() {
    // 같은 크기의 불꽃 3개를 번갈아 그림
    let index = floor(frameCount / 7) % 3;
    let flame = this.flames[this.flameSize][index];

    push();
    translate(flame.x, -this.h / 2 - 15 - flame.h / 2);

    fill("#ff4d43");
    beginShape();
    vertex(0, -flame.h / 2);
    vertex(flame.w * 0.24, -flame.h * 0.08);
    vertex(flame.w * 0.5, -flame.h * 0.2);
    vertex(flame.w * 0.44, flame.h * 0.31);
    vertex(flame.w * 0.22, flame.h * 0.48);
    vertex(0, flame.h / 2);
    vertex(-flame.w * 0.3, flame.h * 0.43);
    vertex(-flame.w * 0.5, flame.h * 0.23);
    vertex(-flame.w * 0.5, -flame.h * 0.2);
    vertex(-flame.w * 0.2, -flame.h * 0.04);
    endShape(CLOSE);

    fill("#ffad32");
    beginShape();
    vertex(1, -flame.h * 0.2);
    vertex(flame.w * 0.24, flame.h * 0.12);
    vertex(flame.w * 0.2, flame.h * 0.36);
    vertex(0, flame.h * 0.44);
    vertex(-flame.w * 0.22, flame.h * 0.34);
    vertex(-flame.w * 0.22, flame.h * 0.07);
    endShape(CLOSE);
    pop();
  }

  press(px, py) {
    let flame = this.flamePosition();

    // 켜진 불꽃을 탭하면 끄기
    if (this.lit && dist(px, py, flame.x, flame.y) < 45) {
      this.lit = false;
      return;
    }

    if (this.contains(px, py)) {
      // 꺼진 양초를 탭하면 세우고 다시 켜기
      if (!this.lit) {
        Body.setAngle(this.body, 0);
        Body.setAngularVelocity(this.body, 0);
        Body.setVelocity(this.body, { x: 0, y: 0 });
        Body.setPosition(this.body, {
          x: constrain(this.body.position.x, 60, width - 60),
          y: height - 30 - this.h / 2,
        });
        this.lit = true;
        this.flameSize = 2;
        this.shake = 0;
      } else {
        this.dragging = true;
        this.offsetX = px - this.body.position.x;
        this.offsetY = py - this.body.position.y;
        this.lastX = px;
        this.direction = 0;
        this.still = 0;
      }
    }
  }

  drag(px, py) {
    if (!this.dragging) return;

    let dx = px - this.lastX;
    let newDirection = Math.sign(dx);

    // 좌우 방향이 바뀔 때 흔들림 증가
    if (
      this.direction !== 0 &&
      newDirection !== 0 &&
      newDirection !== this.direction
    ) {
      this.shake += 25;
    }

    // 물리 바디의 위치와 기울기를 마우스 위치에 맞춤
    Body.setPosition(this.body, {
      x: constrain(px - this.offsetX, 50, width - 50),
      y: constrain(py - this.offsetY, 100, height - 50),
    });
    Body.setVelocity(this.body, { x: dx * 0.4, y: 0 });
    Body.setAngle(this.body, constrain(dx * 0.04, -0.6, 0.6));
    Body.setAngularVelocity(this.body, dx * 0.002);

    this.lastX = px;
    this.direction = newDirection;
    this.still = 0;
  }

  release() {
    if (!this.dragging) return;
    this.dragging = false;
  }

  contains(px, py) {
    return (
      px > this.body.bounds.min.x &&
      px < this.body.bounds.max.x &&
      py > this.body.bounds.min.y &&
      py < this.body.bounds.max.y
    );
  }

  flamePosition() {
    let pos = this.body.position;
    let angle = this.body.angle;
    let d = this.h / 2 + 42;
    return {
      x: pos.x + sin(angle) * d,
      y: pos.y - cos(angle) * d,
    };
  }
}

class Raindrop {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.speed = random(7, 12);
  }

  move() {
    this.y += this.speed;
  }

  display() {
    fill("#2faafa");
    ellipse(this.x, this.y, 9, 24);
  }

  hitsAwning() {
    return (
      this.x < awning.w && this.y > awning.y && this.y < awning.y + awning.h
    );
  }

  hitsFlame() {
    if (!candle.lit) return false;
    let flame = candle.flamePosition();
    return dist(this.x, this.y, flame.x, flame.y) < 28;
  }

  hitsCandle() {
    return candle.contains(this.x, this.y);
  }
}
