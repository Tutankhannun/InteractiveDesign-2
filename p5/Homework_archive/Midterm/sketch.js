const STORAGE_KEY = "midterm-habit-garden-v1";
const GROW_EVERY = 5;
const STYLE_VERSION = 2;
const CELL = 6;            // 잡아당기는 거리 계산의 기준 칸 크기
const MAX_STEM = 56;       // 다 자랐을 때 줄기 높이(칸)
const PULL_DISTANCE = 64;  // 이만큼 잡아당기면 잎이 떨어진다
const REGROW_DELAY = 2400;
const REGROW_TIME = 900;

const BG = "#fbf7ee";
const GROUND = "#efe7d3";
const INK = "#2b3a55";
const PAPER = "#fffdf6";

// 화분 모양: 위에서부터 줄마다 반폭(칸)
const POT_SHAPES = [
  { rows: [13, 13, 11, 11, 11, 11, 11, 10, 10, 9, 9, 8, 7] },
  { rows: [10, 11, 12, 13, 13, 13, 13, 13, 12, 11, 10, 9] },
  { rows: [13, 12, 13, 12, 13, 12, 13, 12, 13, 12, 13, 12, 13, 12] },
  { rows: [7, 8, 9, 10, 11, 12, 13, 13, 13, 13] },
  { rows: [11, 11, 10, 9, 10, 11, 12, 13, 13, 12, 11, 8, 7, 9, 9] },
  { rows: [13, 13, 12, 12, 12, 12, 12, 12, 12, 12], legs: true },
];

const POT_THEMES = [
  { pot: "#f39a1e", accent: "#e2401c", accent2: "#ffd23f", dark: "#c4561a" },
  { pot: "#ef7d22", accent: "#2b3a55", accent2: "#ffd23f", dark: "#b5501a" },
  { pot: "#e2401c", accent: "#2b3a55", accent2: "#f7b538", dark: "#a82a14" },
  { pot: "#2f6fd6", accent: "#f39a1e", accent2: "#fffdf6", dark: "#1f4b99" },
  { pot: "#7c8a3a", accent: "#2b3a55", accent2: "#d9d36a", dark: "#58622a" },
  { pot: "#2b3a55", accent: "#5c6f91", accent2: "#f39a1e", dark: "#1b263a" },
];

const PLANT_THEMES = [
  { stem: "#1f7a3a", leaf: "#1f8a43", leaf2: "#e2231a", flower: "#e2231a", center: "#ffd400" },
  { stem: "#1fb5c9", leaf: "#8cc63f", leaf2: "#5aa02c", flower: "#ffd400", center: "#e2401c" },
  { stem: "#9a7b2c", leaf: "#e2231a", leaf2: "#c81d25", flower: "#ffd400", center: "#1f7a3a" },
  { stem: "#d6246e", leaf: "#f2a477", leaf2: "#e8895a", flower: "#d6246e", center: "#ffd400" },
  { stem: "#d6246e", leaf: "#1e73d8", leaf2: "#155bb0", flower: "#ffd400", center: "#e2231a" },
  { stem: "#1f7a3a", leaf: "#1f7a3a", leaf2: "#f39200", flower: "#1e73d8", center: "#ffd400" },
  { stem: "#9bbf3a", leaf: "#1e73d8", leaf2: "#1559b8", flower: "#1e73d8", center: "#ffd400" },
];

// 잎 스프라이트: 왼쪽 아래가 가지에 붙는 자리. X 잎, o 그림자, v 잎맥
const LEAF_SPRITES = [
  ["....XX", "...XvX", "..XvXo", ".XvXo.", "XvXo..", "vXo..."],
  ["X.....", "XX....", "XXX...", "XXXX..", "XXXXX.", "XXXXXX"],
  ["XXXXv", "XXXvX", "XXvXX", "XvXXX", "vXXXX"],
  ["XX.XX", "XXXXX", "XXXXo", "XXXo.", "XXo.."],
  ["...XX", "..XXX", ".XXXo", "XXXo.", "XXo.."],
];
const SMALL_LEAF = ["..X", ".XX", "XXo"];
const FLOWER_SPRITES = [pinwheelFlower(), diamondFlower(), hollowFlower(), starFlower()];

let pots = [];
let selected = 0;
let fallingLeaves = [];
let sparks = [];
let editorMode = null;
let grabbed = null;
let plucked = {};
let zones = { leaves: [] };
let lastHint = "";
const plantCache = new WeakMap();
const shadeCache = new Map();

function setup() {
  createCanvas(windowWidth, windowHeight);
  noStroke();
  textFont("Galmuri11");
  try { pots = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch (error) { pots = []; }
  pots = pots.filter((pot) => pot && typeof pot === "object");
  // 예전 버전 화분은 새 픽셀 스타일로 바꿔 준다.
  pots.forEach((pot) => {
    if (!pot.style || pot.style.v !== STYLE_VERSION) pot.style = randomStyle();
    pot.count = pot.count || 0;
    pot.flowers = pot.flowers || 0;
  });
  savePots();
  selected = max(0, pots.length - 1);
  document.getElementById("addPot").addEventListener("click", addPot);
  document.getElementById("deletePot").addEventListener("click", deletePot);
  document.getElementById("previous").addEventListener("click", () => selectPot(-1));
  document.getElementById("next").addEventListener("click", () => selectPot(1));
  document.getElementById("saveEditor").addEventListener("click", saveEditor);
  document.getElementById("editorInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") saveEditor();
    if (event.key === "Escape") closeEditor();
  });
  updateUI();
}

function draw() {
  background(BG);
  let L = layout();
  drawGround(L);
  zones = { leaves: [] };
  if (pots.length) drawScene(pots[selected], L);
  else {
    fill("#8a8f7a");
    textAlign(CENTER, CENTER);
    textSize(16);
    text("아래 버튼을 눌러 첫 화분을 만들어 보세요", width / 2, height * 0.48);
  }
  updateFalling(L);
  updateSparks(L);
  updateCursor();
}

function layout() {
  let P = max(3, floor(min(8, width / 46, (height - 230) / 80)));
  let groundY = round(min(height * 0.8, height - 120) / P) * P;
  return { P, ox: round(width / 2 - P / 2), groundY };
}

function cellAt(O, x, y) {
  rect(O.x + x * O.P, O.y + y * O.P, O.P, O.P);
}

function drawGround(L) {
  let P = L.P;
  fill(GROUND);
  rect(0, L.groundY, width, height - L.groundY);
  fill(shade(GROUND, -0.07));
  rect(0, L.groundY, width, P);
  // 흙바닥의 성긴 픽셀 무늬
  fill(shade(GROUND, -0.04));
  for (let y = L.groundY + 3 * P, row = 0; y < height; y += 3 * P, row++) {
    for (let x = L.ox % (8 * P) + (row % 2) * 4 * P - 8 * P; x < width; x += 8 * P) rect(x, y, P, P);
  }
}

function drawScene(pot, L) {
  let s = pot.style;
  let shape = POT_SHAPES[s.potShape];
  let potRows = shape.rows.length + (shape.legs ? 2 : 0);
  let O = { x: L.ox, y: L.groundY - potRows * L.P, P: L.P };
  let level = min(6, floor(pot.count / GROW_EVERY));

  // 화분 그림자
  fill(shade(GROUND, -0.12));
  rect(O.x - 12 * L.P, L.groundY, 25 * L.P, L.P);

  if (pot.habit) drawPlant(pot, O, level);
  else if (pot.name) drawSprout(pot, O);
  drawPotBody(s, O);
  drawPlate(pot, L);

  setHint(!pot.name
    ? "화분이나 이름표를 눌러 이름을 지어 주세요."
    : !pot.habit
      ? "새싹을 눌러 매일 실천할 행동을 적어 주세요."
      : `잎을 잡아당겨 떨어뜨리면 실천 1회 · ${pot.habit}`);
}

// ---------- 식물 ----------

function getPlant(style) {
  if (!plantCache.has(style)) plantCache.set(style, buildPlant(style));
  return plantCache.get(style);
}

function buildPlant(style) {
  let rand = mulberry32(style.seed);
  let theme = PLANT_THEMES[style.plantTheme];
  let stem = [], stemX = {}, x = 0;
  for (let y = -1; y >= -MAX_STEM - 1; y--) {
    // 가끔 한 칸씩 옆으로 꺾이는 계단식 줄기
    if (y < -10 && rand() < 0.08) {
      let nx = constrain(x + (rand() < 0.5 ? -1 : 1), -2, 2);
      if (nx !== x) { stem.push({ x, y }); x = nx; }
    }
    stem.push({ x, y });
    stemX[y] = x;
  }

  let branches = [], side = rand() < 0.5 ? -1 : 1, id = 0;
  let tone = () => (rand() < 0.35 ? theme.leaf2 : theme.leaf);
  for (let y = -6; y > -MAX_STEM + 2; y -= 3 + floor(rand() * 2)) {
    let t = -y / MAX_STEM;
    let len = max(2, round((4 + rand() * 4) * (1 - t * 0.5)));
    let flat = 1 + floor(rand() * 2);
    let cells = [], bx = stemX[y], by = y;
    for (let i = 0; i < len; i++) {
      bx += side;
      if (i >= flat) by--;
      cells.push({ x: bx, y: by });
    }
    let leaves = [makeLeaf(id++, LEAF_SPRITES[style.leafType], side, bx + side, by - 1, tone(), -1, true)];
    if (len >= 5 && rand() < 0.7) {
      let m = cells[len - 3];
      leaves.push(makeLeaf(id++, SMALL_LEAF, side, m.x + side, m.y + 1, tone(), 1, false));
    }
    branches.push({ y, side, cells, leaves, tip: { x: bx, y: by } });
    side = -side;
  }
  return { stem, stemX, branches, tops: {}, phase: rand() * TWO_PI };
}

function makeLeaf(id, sprite, side, ax, ay, base, vy, tip) {
  let cells = [], h = sprite.length;
  sprite.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch === ".") return;
    let col = ch === "v" ? shade(base, -0.3) : ch === "o" ? shade(base, -0.16) : base;
    cells.push({ x: ax + side * c, y: ay + vy * (h - 1 - r), col, d: c + (h - 1 - r) });
  }));
  let xs = cells.map((c) => c.x), ys = cells.map((c) => c.y);
  return {
    id, tip, cells,
    minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys),
    maxD: Math.max(...cells.map((c) => c.d)),
  };
}

function sway(y, t) {
  return round(sin(t + y * 0.04) * 1.3 * pow(-y / MAX_STEM, 1.4));
}

function drawPlant(pot, O, level) {
  let s = pot.style, plant = getPlant(s), theme = PLANT_THEMES[s.plantTheme];
  let H = round(16 + level * (MAX_STEM - 16) / 6);
  let t = frameCount * 0.02 + plant.phase;

  fill(theme.stem);
  for (let c of plant.stem) if (c.y >= -H) cellAt(O, c.x + sway(c.y, t), c.y);

  let visible = plant.branches.filter((b) => b.y >= -H + 3);
  let flowerCount = level > 0 ? min(pot.flowers, 5) : 0;
  // 맨 위 꽃 하나 + 위쪽 가지 끝에 양쪽으로 번갈아 띄엄띄엄 나머지 꽃
  let bloomBranches = visible.slice().reverse().filter((b, i) => i % 4 === 1 || i % 4 === 2).slice(0, max(0, flowerCount - 1));
  let leaves = [], flowers = [];

  for (let b of visible) {
    let sh = sway(b.y, t);
    fill(theme.stem);
    for (let c of b.cells) cellAt(O, c.x + sh, c.y);
    let bloom = bloomBranches.includes(b);
    for (let leaf of b.leaves) if (!(bloom && leaf.tip)) leaves.push({ leaf, sh });
    if (bloom) {
      fill(theme.stem);
      cellAt(O, b.tip.x + b.side + sh, b.tip.y - 1);
      flowers.push({ x: b.tip.x + b.side * 3 + sh, y: b.tip.y - 3 });
    }
  }

  let topX = plant.stemX[-H], topSh = sway(-H, t);
  if (flowerCount > 0) {
    flowers.push({ x: topX + topSh, y: -H - 3 });
  } else {
    if (!plant.tops[H]) {
      plant.tops[H] = [
        makeLeaf("top-l", SMALL_LEAF, -1, topX - 1, -H, theme.leaf, -1, false),
        makeLeaf("top-r", SMALL_LEAF, 1, topX + 1, -H, theme.leaf, -1, false),
      ];
    }
    for (let leaf of plant.tops[H]) leaves.push({ leaf, sh: topSh });
  }

  for (let { leaf, sh } of leaves) drawLeaf(leaf, O, sh);
  for (let f of flowers) drawFlower(s.flowerType, f.x, f.y, theme, O);
}

function drawLeaf(leaf, O, sh) {
  let P = O.P;
  let grow = 1;
  if (plucked[leaf.id] !== undefined) {
    grow = constrain((millis() - plucked[leaf.id] - REGROW_DELAY) / REGROW_TIME, 0, 1);
    if (grow <= 0) return;
    if (grow >= 1) delete plucked[leaf.id];
  }
  let dx = sh * P, dy = 0;
  if (grabbed && grabbed.id === leaf.id) {
    dx += grabbed.ox;
    dy += grabbed.oy;
    // 거의 떨어질 때쯤 파르르 떨린다
    if (grabbed.tension > 0.6 && frameCount % 4 < 2) dx += P;
  }
  let limit = grow * (leaf.maxD + 1);
  for (let c of leaf.cells) {
    if (c.d >= limit) continue;
    fill(c.col);
    rect(O.x + c.x * P + dx, O.y + c.y * P + dy, P, P);
  }
  if (grow >= 1) zones.leaves.push({ leaf, O, dx, dy });
}

function drawFlower(type, cx, cy, theme, O) {
  let colors = { p: theme.flower, d: shade(theme.flower, -0.22), c: theme.center, w: PAPER };
  for (let f of FLOWER_SPRITES[type]) {
    fill(colors[f.k]);
    cellAt(O, cx + f.x, cy + f.y);
  }
}

function drawSprout(pot, O) {
  let theme = PLANT_THEMES[pot.style.plantTheme];
  // 살짝 들썩이며 눌러 보라고 알려 준다
  let bob = frameCount % 80 < 40 ? 0 : -1;
  fill(theme.stem);
  for (let y = -1; y >= -4; y--) cellAt(O, 0, y + (y < -1 ? bob : 0));
  for (let side of [-1, 1]) {
    let leaf = makeLeaf("sprout", SMALL_LEAF, side, side, -3 + bob, theme.leaf, -1, false);
    for (let c of leaf.cells) { fill(c.col); cellAt(O, c.x, c.y); }
  }
  zones.sprout = { x0: O.x - 6 * O.P, x1: O.x + 7 * O.P, y0: O.y - 10 * O.P, y1: O.y };
}

// ---------- 화분 ----------

function drawPotBody(s, O) {
  let shape = POT_SHAPES[s.potShape], th = POT_THEMES[s.potTheme], rows = shape.rows;
  for (let r = 0; r < rows.length; r++) {
    let hw = rows[r];
    for (let x = -hw; x <= hw; x++) {
      fill(potColor(s.potPattern, x, r, hw, rows.length, th));
      cellAt(O, x, r);
    }
  }
  if (shape.legs) {
    fill(th.dark);
    for (let r = rows.length; r < rows.length + 2; r++) {
      for (let x = 9; x <= 11; x++) { cellAt(O, x, r); cellAt(O, -x, r); }
    }
  }
  zones.pot = { x0: O.x - 13 * O.P, x1: O.x + 14 * O.P, y0: O.y, y1: O.y + (rows.length + 2) * O.P };
}

function potColor(pattern, x, r, hw, H, th) {
  if (r === 0) return th.dark;
  let mid = floor(H / 2), col = th.pot;
  let m6 = ((x % 6) + 6) % 6;
  if (pattern === 0 && r % 3 === 2) col = th.accent;                       // 가로 줄무늬
  if (pattern === 1 && r > 1 && r < H - 1 && ((x - r) % 4 + 4) % 4 === 0) col = th.accent; // 사선
  if (pattern === 2) {                                                       // 마름모 띠
    let band = abs(r - mid);
    let d = abs(((x + 3) % 6 + 6) % 6 - 3) + band;
    if (band === 3) col = th.dark;
    else if (band <= 2 && d === 0) col = th.accent2;
    else if (band <= 2 && d <= 2) col = th.accent;
  }
  if (pattern === 3 && r >= H - 6 && r < H - 1) {                            // 톱니 삼각형
    if (((x % 5) + 5) % 5 <= r - (H - 6)) col = th.accent;
  }
  if (pattern === 4) {                                                       // 지그재그
    if (r === 2) col = th.accent2;
    if (r === mid - 1 + abs(m6 - 3)) col = th.accent;
  }
  if (x === hw || r === H - 1) col = shade(col, -0.15);
  else if (x === -hw) col = shade(col, 0.12);
  return col;
}

function drawPlate(pot, L) {
  let P = L.P;
  let theme = PLANT_THEMES[pot.style.plantTheme];
  let label = pot.name || "이름 짓기 +";
  let count = String(pot.count);
  textSize(max(12, P * 2.2));
  let tw = textWidth(label), cw = textWidth(count);
  let extra = pot.habit ? 2 * P + 9 * P + 2 * P + cw : 0;
  let w = ceil((tw + extra + 4 * P) / P) * P, h = 5 * P;
  let x = round(L.ox + P / 2 - w / 2), y = L.groundY + 2 * P;
  fill(INK);
  rect(x + P, y, w - 2 * P, h);
  rect(x, y + P, w, h - 2 * P);
  fill(PAPER);
  textAlign(LEFT, CENTER);
  text(label, x + 2 * P, y + h / 2);
  if (pot.habit) {
    // 다음 성장까지 남은 칸
    let px = x + 2 * P + tw + 2 * P;
    for (let i = 0; i < GROW_EVERY; i++) {
      fill(i < pot.count % GROW_EVERY ? theme.center : shade(INK, 0.25));
      rect(px + i * 2 * P, y + 2 * P, P, P);
    }
    fill(shade(PAPER, -0.25));
    text(count, px + 11 * P, y + h / 2);
  }
  zones.plate = { x0: x, x1: x + w, y0: y, y1: y + h };
}

// ---------- 떨어지는 잎 ----------

function detachLeaf() {
  let z = zones.leaves.find((item) => item.leaf.id === grabbed.id) || grabbed.zone;
  let { leaf, O, dx, dy } = z;
  let P = O.P, L = layout(), pot = pots[selected];
  let cells = leaf.cells.map((c) => ({ cx: c.x - leaf.minX, cy: c.y - leaf.minY, col: c.col }));
  let x = O.x + leaf.minX * P + dx, y = O.y + leaf.minY * P + dy;
  let w = leaf.maxX - leaf.minX + 1, h = leaf.maxY - leaf.minY + 1;
  fallingLeaves.push({
    x, y, cells, w, h, P,
    vx: constrain(grabbed.vx * 0.5, -5, 5),
    vy: constrain(grabbed.vy * 0.3, -3, 1) - 1.6,
    t: 0, phase: random(TWO_PI), rest: false, life: 200,
    restY: L.groundY + floor(random(0, 3)) * P,
  });
  for (let i = 0; i < 8; i++) {
    sparks.push({
      x: x + w * P / 2, y: y + h * P / 2, P,
      vx: random(-3, 3), vy: random(-4, -1), life: floor(random(18, 30)),
      col: random(cells).col,
    });
  }
  plucked[leaf.id] = millis();
  pot.count++;
  // 다섯 번마다 식물이 자라고, 확률에 따라 꽃이 핀다.
  if (pot.count % GROW_EVERY === 0 && random() < 0.65) pot.flowers++;
  savePots();
  grabbed = null;
}

function updateFalling(L) {
  for (let i = fallingLeaves.length - 1; i >= 0; i--) {
    let f = fallingLeaves[i], P = f.P;
    if (!f.rest) {
      f.t++;
      f.vy = min(f.vy + 0.12, 2.6);
      f.vx *= 0.98;
      f.x += f.vx + sin(f.t * 0.08 + f.phase) * 0.9;
      f.y += f.vy;
      // 픽셀 느낌을 살리려고 90도씩 뚝뚝 돈다
      if (f.t % 14 === 0) {
        let ow = f.w, oh = f.h;
        f.cells = f.cells.map((c) => ({ cx: oh - 1 - c.cy, cy: c.cx, col: c.col }));
        f.w = oh; f.h = ow;
        f.x += (ow - oh) * P / 2;
        f.y += (oh - ow) * P / 2;
      }
      if (f.y + f.h * P >= f.restY) { f.y = f.restY - f.h * P; f.rest = true; }
    } else if (--f.life <= 0) {
      fallingLeaves.splice(i, 1);
      continue;
    }
    if (f.rest && f.life < 45 && floor(f.life / 5) % 2 === 0) continue;
    let sx = L.ox + round((f.x - L.ox) / P) * P;
    let sy = L.groundY + round((f.y - L.groundY) / P) * P;
    for (let c of f.cells) { fill(c.col); rect(sx + c.cx * P, sy + c.cy * P, P, P); }
  }
}

function updateSparks(L) {
  for (let i = sparks.length - 1; i >= 0; i--) {
    let s = sparks[i];
    s.vy += 0.25;
    s.x += s.vx;
    s.y += s.vy;
    if (--s.life <= 0) { sparks.splice(i, 1); continue; }
    fill(s.col);
    rect(L.ox + round((s.x - L.ox) / s.P) * s.P, round(s.y / s.P) * s.P, s.P, s.P);
  }
}

// ---------- 입력 ----------

function inZone(z) {
  return z && mouseX >= z.x0 && mouseX <= z.x1 && mouseY >= z.y0 && mouseY <= z.y1;
}

function leafUnderMouse() {
  for (let i = zones.leaves.length - 1; i >= 0; i--) {
    let z = zones.leaves[i], P = z.O.P;
    let lx = (mouseX - z.O.x - z.dx) / P, ly = (mouseY - z.O.y - z.dy) / P;
    // 잎 칸 주변 반 칸까지는 잡을 수 있게 넉넉히
    if (z.leaf.cells.some((c) => lx > c.x - 0.6 && lx < c.x + 1.6 && ly > c.y - 0.6 && ly < c.y + 1.6)) return z;
  }
  return null;
}

function mousePressed(event) {
  if (editorMode || !pots.length) return;
  if (event && event.target && event.target.tagName !== "CANVAS") return;
  let pot = pots[selected];
  if (pot.habit) {
    let z = leafUnderMouse();
    if (z) {
      grabbed = { id: z.leaf.id, zone: z, startX: mouseX, startY: mouseY, lastX: mouseX, lastY: mouseY, ox: 0, oy: 0, vx: 0, vy: 0, tension: 0 };
      return;
    }
  }
  if (inZone(zones.pot) || inZone(zones.plate)) { openEditor("name"); return; }
  if (pot.name && !pot.habit && inZone(zones.sprout)) openEditor("habit");
}

function mouseDragged() {
  if (!grabbed) return;
  let P = layout().P;
  let px = mouseX - grabbed.startX, py = mouseY - grabbed.startY;
  // 잎이 손을 고무줄처럼 따라오다가 일정 거리를 넘으면 똑 떨어진다
  grabbed.ox = round(px * 0.4 / P) * P;
  grabbed.oy = round(py * 0.4 / P) * P;
  grabbed.tension = dist(0, 0, px, py) / (PULL_DISTANCE * P / CELL);
  grabbed.vx = mouseX - grabbed.lastX;
  grabbed.vy = mouseY - grabbed.lastY;
  grabbed.lastX = mouseX;
  grabbed.lastY = mouseY;
  if (grabbed.tension >= 1) detachLeaf();
}

function mouseReleased() {
  grabbed = null;
}

function updateCursor() {
  if (grabbed) return cursor("grabbing");
  if (editorMode || !pots.length) return cursor(ARROW);
  let pot = pots[selected];
  if (pot.habit && leafUnderMouse()) cursor("grab");
  else if (inZone(zones.pot) || inZone(zones.plate) || (pot.name && !pot.habit && inZone(zones.sprout))) cursor(HAND);
  else cursor(ARROW);
}

// ---------- 화분 관리 ----------

function addPot() {
  pots.push({ name: "", habit: "", count: 0, flowers: 0, style: randomStyle() });
  selected = pots.length - 1;
  resetEffects();
  savePots();
  updateUI();
  openEditor("name");
}

function deletePot() {
  if (!pots.length) return;
  let pot = pots[selected];
  if (!confirm(`'${pot.name || "이름 없는 화분"}' 화분을 삭제할까요? 쌓인 기록도 함께 사라져요.`)) return;
  pots.splice(selected, 1);
  selected = constrain(selected, 0, max(0, pots.length - 1));
  resetEffects();
  closeEditor();
  savePots();
  updateUI();
}

function randomStyle() {
  return {
    v: STYLE_VERSION,
    seed: floor(random(1e9)),
    potShape: floor(random(POT_SHAPES.length)),
    potPattern: floor(random(5)),
    potTheme: floor(random(POT_THEMES.length)),
    plantTheme: floor(random(PLANT_THEMES.length)),
    leafType: floor(random(LEAF_SPRITES.length)),
    flowerType: floor(random(FLOWER_SPRITES.length)),
  };
}

function openEditor(mode) {
  editorMode = mode;
  let input = document.getElementById("editorInput");
  document.getElementById("editorLabel").textContent = mode === "name" ? "화분 이름" : "매일 실천할 행동";
  document.getElementById("saveEditor").textContent = mode === "name" ? "이름 저장" : "행동 심기";
  input.placeholder = mode === "name" ? "예: 나의 아침" : "예: 물 한 잔 마시기";
  input.value = pots[selected][mode];
  document.getElementById("editor").hidden = false;
  input.focus();
}

function saveEditor() {
  if (!editorMode) return;
  let value = document.getElementById("editorInput").value.trim();
  if (!value) return;
  pots[selected][editorMode] = value;
  savePots();
  closeEditor();
}

function closeEditor() {
  editorMode = null;
  document.getElementById("editor").hidden = true;
}

function selectPot(direction) {
  selected = constrain(selected + direction, 0, pots.length - 1);
  resetEffects();
  closeEditor();
  updateUI();
}

function resetEffects() {
  fallingLeaves = [];
  sparks = [];
  plucked = {};
  grabbed = null;
}

function setHint(message) {
  if (message === lastHint) return;
  lastHint = message;
  document.getElementById("hint").textContent = message;
}

function updateUI() {
  document.getElementById("page").textContent = `${pots.length ? selected + 1 : 0} / ${pots.length}`;
  document.getElementById("previous").disabled = selected <= 0;
  document.getElementById("next").disabled = selected >= pots.length - 1;
  document.getElementById("deletePot").disabled = !pots.length;
  if (!pots.length) setHint("화분을 만들고 매일의 작은 행동을 심어 보세요.");
}

function savePots() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pots)); } catch (error) { /* 저장 공간이 없으면 현재 화면에서 계속 사용 */ }
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); }

// ---------- 도우미 ----------

function shade(hex, amount) {
  let key = hex + amount;
  if (!shadeCache.has(key)) {
    let n = parseInt(hex.slice(1), 16);
    let target = amount < 0 ? 0 : 255, k = Math.abs(amount);
    let out = [n >> 16 & 255, n >> 8 & 255, n & 255]
      .map((v) => Math.round(v + (target - v) * k).toString(16).padStart(2, "0"));
    shadeCache.set(key, "#" + out.join(""));
  }
  return shadeCache.get(key);
}

// 화분마다 같은 모양으로 자라도록 씨앗값으로 만드는 난수
function mulberry32(a) {
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 꽃 스프라이트: p 꽃잎, d 짙은 꽃잎, c 꽃술, w 흰 속
function pinwheelFlower() {
  let blade = [[0, -1, "p"], [0, -2, "p"], [0, -3, "p"], [1, -2, "d"], [1, -3, "d"], [2, -3, "d"]];
  let out = [{ x: 0, y: 0, k: "c" }];
  for (let q = 0; q < 4; q++) {
    for (let [x, y, k] of blade) {
      for (let i = 0; i < q; i++) [x, y] = [-y, x];
      out.push({ x, y, k });
    }
  }
  return out;
}

function gridFlower(pick) {
  let out = [];
  for (let y = -3; y <= 3; y++) {
    for (let x = -3; x <= 3; x++) {
      let k = pick(x, y, Math.abs(x) + Math.abs(y));
      if (k) out.push({ x, y, k });
    }
  }
  return out;
}

function diamondFlower() {
  return gridFlower((x, y, d) => (d === 0 ? "c" : d <= 2 ? "p" : d === 3 && (x === 0 || y === 0) ? "d" : null));
}

function hollowFlower() {
  return gridFlower((x, y, d) => (d === 3 ? "p" : d === 0 ? "c" : d < 3 ? "w" : null));
}

function starFlower() {
  return gridFlower((x, y, d) => {
    if (d === 0) return "c";
    if ((x === 0 || y === 0) && d <= 3) return "p";
    if (Math.abs(x) === Math.abs(y) && Math.abs(x) <= 2) return "d";
    return null;
  });
}
