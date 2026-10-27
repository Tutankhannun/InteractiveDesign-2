const Engine = Matter.Engine;
const Bodies = Matter.Bodies;
const Composite = Matter.Composite;
const Body = Matter.Body;
const Events = Matter.Events;
// 엔진 생성
let engine;
// 바디 생성
let balls = [];
let splitList = []; // 이번 프레임에 나눌 원들
let cr = 200;
let minR = 10; // 원 최소 크기 (나눠질수록 작아지다가 이 크기에서 멈춤)
let maxArea; // 원들이 차지할 수 있는 최대 넓이 (화면 크기에 맞춰 setup에서 계산)
let fillRate = 0.85; // 화면을 채우는 정도 (원끼리는 빈틈이 생겨서 0.85 정도면 꽉 차 보임)
let speed = 4; // 원 속도 (모든 원이 이 속도로 계속 움직임)
let waitFrame = 30; // 새로 생긴 원은 이 프레임 동안 나눠지지 않음
let margin = 20;
let hue; // 원 색상 (새로 고침할 때마다 랜덤)

function setup() {
  createCanvas(windowWidth, windowHeight);
  rectMode(CENTER);
  noStroke();
  hue = random(360);
  // Matter setting
  engine = Engine.create();
  engine.gravity.scale = 0; // 중력 없이 떠다니게
  // walls: 보이는 벽 바깥쪽으로 두껍게 만들어 원이 뚫고 나가지 않게
  let t = 500; // 벽 두께
  let e = margin * 1.5; // 화면 끝에서 벽 안쪽 면까지 거리
  Composite.add(engine.world, [
    Bodies.rectangle(width / 2, height - e + t / 2, width + t * 2, t, {
      isStatic: true,
    }),
    Bodies.rectangle(width / 2, e - t / 2, width + t * 2, t, {
      isStatic: true,
    }),
    Bodies.rectangle(width - e + t / 2, height / 2, t, height + t * 2, {
      isStatic: true,
    }),
    Bodies.rectangle(e - t / 2, height / 2, t, height + t * 2, {
      isStatic: true,
    }),
  ]);
  // 최대 넓이: 벽 안쪽 넓이 x fillRate
  maxArea = (width - e * 2) * (height - e * 2) * fillRate;
  // body
  let v = p5.Vector.random2D().mult(speed);
  addBall(width / 2, height / 2, cr, v.x, v.y);

  // 충돌 감지: 원이 벽에 부딪히면 splitList에 담고, 원끼리 부딪히면 채도 바꾸기
  Events.on(engine, "collisionStart", function (event) {
    for (let pair of event.pairs) {
      let a = pair.bodyA;
      let b = pair.bodyB;
      if (a.isStatic && !b.isStatic) splitList.push(b);
      if (b.isStatic && !a.isStatic) splitList.push(a);
      if (!a.isStatic && !b.isStatic) {
        a.sat = random(30, 100);
        b.sat = random(30, 100);
        a.bri = random(70, 100);
        b.bri = random(70, 100);
      }
    }
  });
}

function draw() {
  background(10);
  Engine.update(engine);
  // Split
  for (let ball of splitList) {
    splitBall(ball);
  }
  splitList = [];
  // 꽉 차도 멈추지 않게 모든 원의 속도를 일정하게 유지
  for (let ball of balls) {
    Body.setSpeed(ball, speed);
  }
  // Walls
  fill(50);
  rect(width / 2, height - margin, width, margin);
  rect(width / 2, margin, width, margin);
  rect(width - margin, height / 2, margin, height);
  rect(margin, height / 2, margin, height);
  // Balls: HSB 모드에서 색상은 모두 같게, 채도와 밝기는 원마다 다르게
  colorMode(HSB);
  for (let ball of balls) {
    fill(hue, ball.sat, ball.bri);
    circle(ball.position.x, ball.position.y, ball.r * 2);
  }
  colorMode(RGB);
}

function addBall(x, y, r, vx, vy, sat = 100, bri = 100) {
  let ball = Bodies.circle(x, y, r, {
    restitution: 1, // 튕기는 정도 (1 = 속도 그대로)
    friction: 0,
    frictionAir: 0,
    inertia: Infinity, // 회전하지 않게 해서 속도 유지
  });
  ball.r = r;
  ball.sat = sat; // 채도
  ball.bri = bri; // 밝기
  ball.born = frameCount; // 생긴 시점
  Body.setVelocity(ball, { x: vx, y: vy });
  Composite.add(engine.world, ball);
  balls.push(ball);
}

function splitBall(ball) {
  // 화면이 다 찼거나 이미 나눠진 원은 건너뛰기
  if (totalArea() >= maxArea || !balls.includes(ball)) return;
  // 방금 생긴 원은 서로 밀려서 벽에 닿은 것이므로 건너뛰기
  if (frameCount - ball.born < waitFrame) return;
  // 원래 원 지우기
  Composite.remove(engine.world, ball);
  balls.splice(balls.indexOf(ball), 1);
  // 0.7배 작아진 원 두 개를 양쪽으로 비껴 나가게 (minR보다 작아지지 않음)
  let r = max(ball.r * 0.7, minR);
  let v = createVector(ball.velocity.x, ball.velocity.y);
  let v1 = v.copy().rotate(PI / 6);
  let v2 = v.copy().rotate(-PI / 6);
  let x = ball.position.x;
  let y = ball.position.y;
  addBall(x, y, r, v1.x, v1.y, ball.sat, ball.bri);
  addBall(x, y, r, v2.x, v2.y, ball.sat, ball.bri);
}

// 지금 원들이 차지하는 넓이의 합
function totalArea() {
  let sum = 0;
  for (let ball of balls) {
    sum += PI * ball.r * ball.r;
  }
  return sum;
}
