// =============================================================
// 정원 아카이브 (Midterm) — 화면·입력
// =============================================================
// - 태그 하나 = 식물 하나. 이름만 지으면 모양은 무작위로 정해져 흙 화단 빈자리에 심긴다.
// - 메모가 쌓일수록 식물이 자란다.
// - 식물을 끌어 다른 식물 위에 놓으면(또는 교배 버튼) 태그와 형질을 물려받은 화분이 생긴다.
// - 상세 화면: 위쪽 잎·꽃 = 메모, 가운데 줄기 = 성장, 아래 뿌리 = 부모 → 조상 계보
// - 파일: sprites.js 그림 재료 · data.js 데이터 · render.js 그리기 · sketch.js 화면·입력
// =============================================================

// ---------- 설정값 ----------
const CELL = 6; // 잡아당기는 거리 계산의 기준 칸 크기
const PULL_DISTANCE = 64; // 이만큼 잡아당기면 잎(메모)이 떨어진다
const REGROW_DELAY = 2400; // 잎이 떨어진 뒤 다시 자라기 시작할 때까지(ms)
const REGROW_TIME = 900; // 잎이 다시 다 자라는 데 걸리는 시간(ms)
const DOUBLE_CLICK = 280; // 뿌리를 두 번 눌렀는지 기다리는 시간(ms)
const LONG_PRESS = 550; // 길게 누르면 뿌리 메뉴를 연다(ms)
const WIDE = 900; // 이 폭 이상이면 패널을 오른쪽에, 좁으면 아래쪽에 띄운다 (세로 태블릿도 아래쪽)
const FLASH_TIME = 3200; // 알림 문구를 보여 주는 시간(ms)
const SIZE_TRAITS = ["stemThickness", "leafScale", "flowerScale"];
const ROPE_SLACK = 40; // 끈의 여유(px): 처음 거리보다 이만큼 더 멀어져야 부모가 끌려오기 시작한다
const ROPE_PULL = 0.1; // 끈이 부모를 당기는 세기 (조부모는 더 무거워서 약하게)
const ROPE_DAMP = 0.72; // 흙 위라 금방 멈추는 정도 (작을수록 빨리 멈춘다)
const ROPE_STRETCH = 0.2; // 팽팽할 때 끈이 늘어나는 정도: 클수록 부모가 덜 끌려온다
const SACK_SHAKES = 3; // 씨앗 포대를 이만큼 흔들면 씨앗이 하나 나온다
const SACK_TILT = 0.55; // 포대가 기울 수 있는 최대 각도(라디안)

// ---------- 상태 ----------
let view = "garden"; // 지금 화면: "garden" | "detail" | "book"
let currentId = null; // 상세 화면에서 보고 있는 식물/화분 id
let backStack = []; // 뿌리를 따라 옮겨 온 길 (뒤로 가기)
let listOpen = false; // 좁은 화면에서 메모 목록을 펼쳤는지 (접으면 얇은 띠만 보인다)
let fromBook = false; // 도감에서 연 상세 화면이면 뒤로 가기가 도감으로
let bookScroll = 0; // 도감 세로 스크롤(px)
let panel = null; // 열린 패널: "list" | "memo" | "memoView" | "tag" | "breed" | null
let selectedMemoId = null; // 고른 메모 (그 잎이 깜빡인다)
let rootFilters = []; // 뿌리 필터로 켠 부모·조상 id들 (모두 만족하는 메모만 진하게)
let gardenScroll = 0; // 정원 가로 스크롤(px)
let press = null; // 캔버스를 누른 순간의 정보
let grabbed = null; // 지금 잡고 있는 잎 정보
let dragging = null; // 정원에서 끌고 있는 식물·화분 { id, dx, dy }
let pendingClick = null; // 한 번 누르고 두 번째 누름을 기다리는 중 (뿌리·꽃) { key, timer }
let fallingLeaves = []; // 떨어지는 중이거나 바닥에 놓인 잎
let sparks = []; // 잎이 떨어질 때 튀는 파편
let plucked = {}; // 뽑힌 잎 id → 뽑힌 시각 (다시 자라기용)
let memoDraft = null; // 메모 쓰기 패널의 입력값
let tagDraft = null; // 태그 만들기 패널의 입력값
let breedDraft = null; // 교배 패널의 입력값
let flashMessage = ""; // 잠깐 보여 주는 알림
let flashUntil = 0;
let lastHint = ""; // 마지막으로 보여 준 안내 문구
let lastTitle = ""; // 마지막으로 보여 준 제목
let lastPanel = null; // 마지막으로 그린 패널 (같은 패널이면 스크롤 위치 유지)
let sack = {
  pos: null,
  a: 0,
  va: 0,
  dir: 0,
  turnA: 0,
  shakes: 0,
  lastShake: 0,
}; // 씨앗 포대 (자리·흔들림)
let seeds = []; // 포대에서 나온 씨앗들 { id, x, d, z, vx, vz, landed, back }
let carry = null; // 끌고 있는 포대·씨앗 { kind: "sack" | "seed", id, dx, dy, lastX, vx }
let pickedSeedId = null; // 태그를 만들려고 주운 씨앗
let overCanvas = true; // 마우스가 캔버스 위에 있는지 (패널 위에서는 캔버스 강조 안 함)

// 캔버스를 만들고 저장된 정원을 불러온 뒤 버튼·입력 이벤트를 연결한다.
function setup() {
  createCanvas(windowWidth, windowHeight);
  noStroke();
  textFont("Galmuri11");
  loadData();
  loadShed();
  // 버튼은 모두 data-action으로 구분해서 한 곳에서 처리한다.
  let ui = el("ui");
  ui.addEventListener("click", onAction);
  ui.addEventListener("input", onInput);
  ui.addEventListener("change", onChange);
  ui.addEventListener("keydown", onFieldKey);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") onEscape();
  });
  document.addEventListener("pointermove", (event) => {
    overCanvas = event.target.tagName === "CANVAS";
  });
  document
    .querySelector("canvas")
    .addEventListener("contextmenu", onContextMenu);
  updateUI();
}

// 매 프레임: 지금 화면(또는 미리보기) → 떨어지는 잎 → 파편 순서로 그린다.
function draw() {
  background(BG);
  prevZones = zones;
  zones = emptyZones();
  let area = viewArea();
  if (panel === "tag") drawTagPreview(area);
  else if (panel === "breed") drawBreedPreview(area);
  else if (view === "garden") drawGarden(area);
  else if (view === "detail") drawDetail(area);
  else drawBook(area);
  updateFalling();
  updateSparks();
  updateHint();
  updateCursor();
}

// 캔버스에서 제목·버튼 줄·패널에 가리지 않는 영역
function viewArea() {
  let area = {
    x0: 0,
    x1: width,
    y0: el("header").getBoundingClientRect().bottom + 12,
    y1: el("controls").getBoundingClientRect().top - 10,
  };
  if (panel) {
    let r = el("panel").getBoundingClientRect();
    if (isWide()) area.x1 = r.left - 8;
    else area.y1 = min(area.y1, r.top - 8);
  }
  return area;
}

// ---------- 화면 이동 ----------

function current() {
  return getContainer(currentId);
}

// 정원으로 돌아간다.
function goGarden() {
  view = "garden";
  currentId = null;
  backStack = [];
  fromBook = false;
  rootFilters = [];
  selectedMemoId = null;
  panel = null;
  resetEffects();
  renderPanel();
}

// 식물·화분 상세 화면을 연다. push면 지금 보던 곳을 뒤로 가기 길에 남긴다.
function openDetail(id, push = false) {
  if (!getContainer(id)) return;
  if (push && currentId && currentId !== id) backStack.push(currentId);
  view = "detail";
  currentId = id;
  detailScroll = 0;
  rootFilters = [];
  selectedMemoId = null;
  resetEffects();
  panel = "list"; // 상세 화면에서는 메모 목록이 늘 열려 있다
  renderPanel();
}

// 도감: 모든 식물·화분을 세대별 카드로 모아 본다.
function openBook() {
  goGarden();
  view = "book";
  bookScroll = 0;
  renderPanel();
}

// 도감에서 카드를 누르면 그 식물 화면으로. 뒤로 가기는 도감으로 돌아온다.
function openFromBook(id) {
  openDetail(id);
  fromBook = true;
  updateUI();
}

function goBack() {
  if (backStack.length) return openDetail(backStack.pop());
  if (view === "detail" && fromBook) return openBook();
  goGarden();
}

// 정원에서 c가 화면 가운데쯤 오게 스크롤한다.
function scrollToItem(c) {
  let area = viewArea(),
    G = gardenLayout(area);
  placeMissing(G, area); // 막 생긴 것은 여기서 자리를 받는다
  gardenScroll = max(0, c.gardenPos.x * G.P - (area.x1 - area.x0) / 2);
}

// 화면을 바꿀 때 떨어지는 잎, 파편, 다시 자라는 중인 잎 기록을 지운다.
function resetEffects() {
  fallingLeaves = [];
  sparks = [];
  plucked = {};
  grabbed = null;
  dragging = null;
  press = null;
  if (pendingClick) clearTimeout(pendingClick.timer);
  pendingClick = null;
  hideContextMenu();
}

// ---------- 캔버스 입력 ----------

function zoneAt(list, x, y) {
  for (let i = list.length - 1; i >= 0; i--) {
    let z = list[i];
    if (x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1) return z;
  }
  return null;
}

function zoneUnderMouse(list) {
  return overCanvas ? zoneAt(list, mouseX, mouseY) : null;
}

// 마우스 아래에 있는 (메모가 달린) 잎을 찾는다. 위에 그려진 잎부터 검사한다.
function leafUnderMouse() {
  for (let i = zones.leaves.length - 1; i >= 0; i--) {
    let z = zones.leaves[i],
      P = z.O.P;
    let lx = (mouseX - z.O.x - z.dx) / P,
      ly = (mouseY - z.O.y - z.dy) / P;
    // 잎 칸 주변 반 칸까지는 잡을 수 있게 넉넉히
    if (
      z.leaf.cells.some(
        (c) =>
          lx > c.x - 0.6 && lx < c.x + 1.6 && ly > c.y - 0.6 && ly < c.y + 1.6,
      )
    )
      return z;
  }
  return null;
}

// 마우스 아래에 줄기나 화분(흙더미)이 있는지 (상세 화면에서 누르면 메모 쓰기)
function bodyUnderMouse() {
  if (!overCanvas) return null;
  return zones.body.find((z) => {
    if (z.x0 !== undefined)
      return (
        mouseX >= z.x0 && mouseX <= z.x1 && mouseY >= z.y0 && mouseY <= z.y1
      );
    let P = z.O.P,
      lx = (mouseX - z.O.x) / P,
      ly = (mouseY - z.O.y) / P;
    return z.cells.some(
      (c) =>
        lx > c.x - 0.8 &&
        lx < c.x + c.w + 0.8 &&
        ly > c.y - 0.3 &&
        ly < c.y + 1.3,
    );
  });
}

// 누른 곳에 따라: 정원의 식물이면 끌 준비, 잎이면 잡기, 뿌리면 길게 누르기 대기.
// 나머지는 손을 뗄 때 처리한다.
function mousePressed(event) {
  // 버튼이나 입력창을 누른 경우, 오른쪽 버튼(메뉴)은 무시한다.
  if (event && event.target && event.target.tagName !== "CANVAS") return;
  if (event && event.button > 0) return;
  hideContextMenu();
  press = {
    x: mouseX,
    y: mouseY,
    scroll: gardenScroll,
    bookScroll,
    detailScroll,
    moved: false,
  };
  if (previewing()) return;
  if (view === "garden") {
    // 씨앗 포대·씨앗은 식물보다 위에 있다
    let ui = zoneUnderMouse(zones.ui);
    if (ui) {
      // 누른 곳과 놓인 자리의 차이를 기억해 두면 끌 때 손 밑에서 그대로 따라온다
      let area = viewArea(),
        G = gardenLayout(area);
      let at =
        ui.id === "sack"
          ? sackLayout(area, G)
          : pointAt(
              seeds.find((s) => s.id === ui.seed),
              G,
              area,
            );
      press.ui = {
        kind: ui.id,
        id: ui.seed,
        dx: at.x - mouseX,
        dy: at.y - mouseY,
      };
      return;
    }
    let item = zoneUnderMouse(zones.items);
    if (item) {
      // 누른 곳과 심은 자리의 차이를 기억해 두면 끌 때 손 밑에서 그대로 따라온다
      let area = viewArea(),
        at = gardenPoint(getContainer(item.id), gardenLayout(area), area);
      Object.assign(press, {
        item: item.id,
        dx: at.x - mouseX,
        dy: at.y - mouseY,
      });
    }
    return;
  }
  if (view !== "detail") return;
  let z = leafUnderMouse();
  if (z) {
    grabbed = {
      id: z.leaf.id,
      zone: z,
      memo: z.memo,
      startX: mouseX,
      startY: mouseY,
      lastX: mouseX,
      lastY: mouseY,
      ox: 0,
      oy: 0,
      vx: 0,
      vy: 0,
      tension: 0,
    };
    return;
  }
  let root = zoneUnderMouse(zones.roots);
  if (root) {
    let p = press;
    p.root = root.id;
    // 터치에서는 길게 누르면 뿌리 메뉴(필터 / 부모로 이동)가 열린다.
    p.timer = setTimeout(() => {
      p.longDone = true;
      showContextMenu(root.id, p.x, p.y);
    }, LONG_PRESS);
  }
}

// 끄는 동안: 잎을 잡았으면 잡아당기고, 정원의 식물이면 들어 옮기고, 빈 흙이면 옆으로 넘긴다.
function mouseDragged() {
  if (!press) return;
  if (dist(mouseX, mouseY, press.x, press.y) > 6) {
    press.moved = true;
    clearTimeout(press.timer);
  }
  if (grabbed) return pullLeaf();
  if (press.ui) {
    if (press.moved && !carry) carry = { ...press.ui, lastX: mouseX, vx: 0 };
    return;
  }
  if (view === "book" && press.moved)
    return (bookScroll = press.bookScroll - (mouseY - press.y));
  // 상세 화면: 빈 곳을 위아래로 끌면 뿌리 쪽으로 넘긴다
  if (view === "detail" && press.moved && !previewing())
    return (detailScroll = press.detailScroll - (mouseY - press.y));
  if (view !== "garden" || previewing() || !press.moved) return;
  if (press.item) {
    if (!dragging) startDrag(press);
  } else gardenScroll = max(0, press.scroll - (mouseX - press.x));
}

// 손을 뗄 때: 끌던 식물은 내려놓고, 움직이지 않고 눌렀다 뗀 경우만 '누르기'로 친다.
function mouseReleased() {
  if (!press) return;
  let p = press,
    g = grabbed,
    d = dragging;
  press = null;
  grabbed = null;
  dragging = null;
  clearTimeout(p.timer);
  if (d) return dropItem(d);
  if (carry) return dropCarry();
  if (p.ui) {
    if (p.moved || previewing()) return;
    return p.ui.kind === "sack" ? tapSack() : pickSeed(p.ui.id);
  }
  if (p.moved || p.longDone || previewing()) return;
  if (g) return showMemo(g.memo.id); // 잎을 누르기만 하면 메모를 연다
  if (p.root) return rootClicked(p.root);
  if (view === "garden") {
    let item = zoneUnderMouse(zones.items);
    if (item) openDetail(item.id);
  } else if (view === "detail") {
    let flower = zoneUnderMouse(zones.flowers);
    if (flower) flowerClicked(flower.memo);
    else if (bodyUnderMouse()) newMemo(current()); // 줄기·화분을 누르면 이 식물에 메모 쓰기
  } else {
    let card = zoneUnderMouse(zones.cards);
    if (card) openFromBook(card.id);
  }
}

// 끌기 시작. 자식 세대(화분)를 끌면 부모·조부모가 끈(뿌리)으로 이어진다.
// 끈 길이는 지금 거리 + 여유. 부모 세대(1세대 식물)를 끌 때는 혼자 움직인다.
function startDrag(p) {
  let area = viewArea(),
    G = gardenLayout(area);
  let home = (id) => gardenPoint(getContainer(id), G, area);
  let followers = [];
  let visit = (c, depth) => {
    for (let id of c.parentIds) {
      let parent = getContainer(id);
      if (!parent || parent.archived || followers.some((f) => f.id === id))
        continue;
      let a = home(c.id),
        b = home(id);
      followers.push({
        id,
        from: c.id,
        rest: dist(a.x, a.y, b.x, b.y) + ROPE_SLACK,
        pull: depth === 1 ? ROPE_PULL : ROPE_PULL * 0.6,
        ox: 0,
        oy: 0,
        vx: 0,
        vy: 0,
      });
      if (depth < 2) visit(parent, depth + 1);
    }
  };
  visit(getContainer(p.item), 1);
  dragging = { id: p.item, dx: p.dx, dy: p.dy, followers };
}

// 끈으로 이어진 부모 f를 한 프레임 움직인다. home은 원래 자리, a는 끈 반대쪽(자식) 위치.
// 끈 길이보다 멀어졌을 때만 끌려간다. 무거워서 조금 늦게 따라가고, 그동안 끈도 조금씩 늘어나서
// 멀리 끌수록 부모는 그 일부만큼만 끌려온다. 자식이 가까이 오면 끈이 느슨해질 뿐 부모는 그대로다.
function pullFollower(f, home, a) {
  let x = home.x + f.ox,
    y = home.y + f.oy;
  let d = dist(a.x, a.y, x, y);
  let tx = x,
    ty = y;
  if (d > f.rest) {
    f.rest += (d - f.rest) * ROPE_STRETCH;
    tx = a.x + ((x - a.x) * f.rest) / d;
    ty = a.y + ((y - a.y) * f.rest) / d;
  }
  f.vx = (f.vx + (tx - x) * f.pull) * ROPE_DAMP;
  f.vy = (f.vy + (ty - y) * f.pull) * ROPE_DAMP;
  f.ox += f.vx;
  f.oy += f.vy;
}

// 끌고 있는 것과 따라오는 것들의 id
function dragIds(d) {
  return [d.id, ...d.followers.map((f) => f.id)];
}

// 끌던 식물을 놓을 곳에 있는 상대 (끌고 있는 것·따라오는 것은 빼고)
function dropTarget(list, ids) {
  return zoneAt(
    list.filter((z) => !ids.includes(z.id)),
    mouseX,
    mouseY,
  );
}

// 끌어다 놓기: 다른 식물·화분 위면 교배, 빈 흙이면 그 자리로 옮겨 심는다.
// 따라오던 부모·조상은 놓는 순간 보이던 자리에 함께 옮겨 심는다. (교배할 때는 제자리)
function dropItem(d) {
  let target = dropTarget(zones.items, dragIds(d));
  if (target) return breedByDrop(d.id, target.id);
  let area = viewArea(),
    G = gardenLayout(area),
    depth = G.bottom - G.top;
  setGardenPos(d.id, {
    x: (mouseX + d.dx - area.x0 + gardenScroll) / G.P,
    d: (mouseY + d.dy - G.top) / depth,
  });
  for (let f of d.followers) {
    let pos = getContainer(f.id).gardenPos;
    setGardenPos(f.id, { x: pos.x + f.ox / G.P, d: pos.d + f.oy / depth });
  }
}

// 식물 위에 식물을 놓으면: 교배할 수 있으면 두 부모를 고른 채로 교배 패널을 연다.
// 새 화분은 두 부모 사이 근처에 심긴다.
function breedByDrop(aId, bId) {
  let a = getContainer(aId),
    b = getContainer(bId);
  let problem = breedProblem(a, b);
  if (problem) return flash(problem);
  startBreed([aId, bId]);
  breedDraft.near = {
    x: (a.gardenPos.x + b.gardenPos.x) / 2,
    d: (a.gardenPos.d + b.gardenPos.d) / 2,
  };
}

// 정원은 휠로도 옆으로 넘긴다.
function mouseWheel(event) {
  if (previewing() || !overCanvas) return;
  if (view === "book") {
    bookScroll += event.deltaY;
    return false;
  }
  if (view === "detail") {
    detailScroll += event.deltaY;
    return false;
  }
  if (view !== "garden") return;
  gardenScroll = max(0, gardenScroll + (event.deltaX || event.deltaY));
  return false;
}

// 잎을 잡고 끄는 동안: 잎 위치, 당긴 정도, 손 속도를 갱신하고 충분히 당기면 떨어뜨린다.
function pullLeaf() {
  let P = grabbed.zone.O.P;
  let px = mouseX - grabbed.startX,
    py = mouseY - grabbed.startY;
  // 잎이 손을 고무줄처럼 따라오다가 일정 거리를 넘으면 똑 떨어진다
  grabbed.ox = round((px * 0.4) / P) * P;
  grabbed.oy = round((py * 0.4) / P) * P;
  grabbed.tension = dist(0, 0, px, py) / ((PULL_DISTANCE * P) / CELL);
  grabbed.vx = mouseX - grabbed.lastX;
  grabbed.vy = mouseY - grabbed.lastY;
  grabbed.lastX = mouseX;
  grabbed.lastY = mouseY;
  if (grabbed.tension >= 1) detachLeaf();
}

// 잡아당긴 잎이 떨어지는 순간: 확인을 받고 떨어지는 잎과 파편을 만든 뒤 메모를 지운다.
function detachLeaf() {
  let g = grabbed;
  grabbed = null;
  press = null;
  if (
    !confirm(
      `'${g.memo.title}' 메모를 지울까요?\n이 메모를 보여 주던 모든 식물·화분에서 사라져요.`,
    )
  )
    return;
  let z = zones.leaves.find((item) => item.leaf.id === g.id) || g.zone;
  let { leaf, O, dx, dy } = z;
  let P = O.P;
  // 잎 칸들을 잎 왼쪽 위 기준 좌표로 바꿔서 떨어지는 잎으로 옮긴다.
  let cells = leaf.cells.map((c) => ({
    cx: c.x - leaf.minX,
    cy: c.y - leaf.minY,
    col: c.col,
  }));
  let x = O.x + leaf.minX * P + dx + g.ox,
    y = O.y + leaf.minY * P + dy + g.oy;
  let w = leaf.maxX - leaf.minX + 1,
    h = leaf.maxY - leaf.minY + 1;
  // 당기던 방향과 속도를 이어받아 톡 튀어 오르며 떨어진다.
  fallingLeaves.push({
    x,
    y,
    gx: O.x,
    gy: O.y,
    cells,
    w,
    h,
    P,
    vx: constrain(g.vx * 0.5, -5, 5),
    vy: constrain(g.vy * 0.3, -3, 1) - 1.6,
    t: 0,
    phase: random(TWO_PI),
    rest: false,
    life: 200,
    restY: (detailGround ? detailGround.y : height) + floor(random(0, 3)) * P,
  });
  // 떨어지는 순간 잎 색의 작은 파편이 튄다.
  for (let i = 0; i < 8; i++) {
    sparks.push({
      x: x + (w * P) / 2,
      y: y + (h * P) / 2,
      gx: O.x,
      P,
      vx: random(-3, 3),
      vy: random(-4, -1),
      life: floor(random(18, 30)),
      col: random(cells).col,
    });
  }
  // 뽑힌 시각을 기록해 두면 drawLeaf에서 잠시 뒤 다시 자라게 한다.
  plucked[leaf.id] = millis();
  deleteMemo(g.memo.id);
  if (selectedMemoId === g.memo.id) selectedMemoId = null;
  afterChange();
  flash(`'${g.memo.title}' 메모를 지웠어요`);
}

// 한 번 누르기와 두 번 누르기를 나눈다. 두 번째 누름을 잠깐 기다렸다가 처리해서,
// 두 번 누를 때 한 번 누르기 동작이 먼저 실행되지 않게 한다.
function delayedClick(key, single, double) {
  if (pendingClick && pendingClick.key === key) {
    clearTimeout(pendingClick.timer);
    pendingClick = null;
    return double();
  }
  if (pendingClick) clearTimeout(pendingClick.timer);
  pendingClick = {
    key,
    timer: setTimeout(() => {
      pendingClick = null;
      single();
    }, DOUBLE_CLICK),
  };
}

// 뿌리 누르기: 한 번이면 필터 켜기/끄기, 두 번이면 그 부모(조상)로 이동.
function rootClicked(id) {
  delayedClick(
    "root:" + id,
    () => toggleRootFilter(id),
    () => goToParent(id),
  );
}

// 꽃 누르기: 한 번이면 메모 보기.
// 자기보다 태그가 많은 메모의 꽃은 두 번 누르면 그 태그 조합의 화분으로 간다.
function flowerClicked(memo) {
  if (!hasMoreTags(current(), memo)) return showMemo(memo.id);
  delayedClick(
    "flower:" + memo.id,
    () => showMemo(memo.id),
    () => goToMemoPot(memo),
  );
}

// 메모의 태그 조합과 똑같은 화분으로 가서 메모를 보여 준다. 없으면 만들지 물어본다.
function goToMemoPot(memo) {
  let pots = findPotsByTagSet(memo.tagIds);
  if (!pots.length) {
    if (
      confirm(
        `${tagLabel(memo.tagIds)} 조합의 화분은 아직 없어요.\n부모 둘을 골라 이 조합의 화분을 만들까요?`,
      )
    )
      startBreed(suggestParents(memo.tagIds));
    return;
  }
  openDetail(pots[0].id, true);
  showMemo(memo.id);
  flash(
    `${tagLabel(memo.tagIds)} 화분으로 왔어요` +
      (pots.length > 1 ? ` (같은 조합 ${pots.length}개 중 첫 번째)` : ""),
  );
}

// 뿌리로 메모 거르기: 여러 뿌리를 켤 수 있고, 켠 뿌리를 다시 누르면 끈다. null이면 모두 해제.
function toggleRootFilter(id) {
  if (id === null) rootFilters = [];
  else if (rootFilters.includes(id))
    rootFilters = rootFilters.filter((f) => f !== id);
  else rootFilters = [...rootFilters, id];
  if (panel === "list") renderPanel();
}

// 켠 뿌리들의 태그 묶음 목록
function filterGroups() {
  return rootFilters
    .map(getContainer)
    .filter(Boolean)
    .map((p) => p.tagIds);
}

function goToParent(id) {
  openDetail(id, true);
  flash(`부모 '${current().name}'(으)로 왔어요 · 뒤로 가기로 돌아갈 수 있어요`);
}

// 오른쪽 버튼(또는 터치 길게 누르기): 뿌리 위면 메뉴를 연다.
function onContextMenu(event) {
  event.preventDefault();
  if (view !== "detail" || previewing()) return;
  let root = zoneAt(zones.roots, event.clientX, event.clientY);
  if (!root) return;
  if (press) press.longDone = true;
  showContextMenu(root.id, event.clientX, event.clientY);
}

function showContextMenu(id, x, y) {
  let menu = el("ctxMenu");
  menu.querySelectorAll("button").forEach((button) => (button.dataset.id = id));
  menu.querySelector("[data-action=root-filter]").textContent =
    rootFilters.includes(id) ? "필터 끄기" : "메모 필터링";
  menu.hidden = false;
  menu.style.left = `${min(x, width - menu.offsetWidth - 8)}px`;
  menu.style.top = `${min(y, height - menu.offsetHeight - 8)}px`;
  menu.querySelector("button").focus();
}

function hideContextMenu() {
  el("ctxMenu").hidden = true;
}

// 상황에 맞게 커서 모양을 바꾼다: 잎 위는 grab, 잡는 중은 grabbing, 누를 수 있는 곳은 손가락
function updateCursor() {
  if (grabbed || dragging || carry) return cursor("grabbing");
  if (!overCanvas || previewing()) return cursor(ARROW);
  if (view === "detail" && leafUnderMouse()) return cursor("grab");
  if (view === "detail" && bodyUnderMouse()) return cursor(HAND);
  let lists =
    view === "garden"
      ? [zones.ui, zones.items]
      : view === "detail"
        ? [zones.flowers, zones.roots]
        : [zones.cards];
  cursor(lists.some((list) => zoneUnderMouse(list)) ? HAND : ARROW);
}

// ---------- 버튼·입력 ----------

// data-action이 붙은 버튼을 누르면 해당 기능을 실행한다.
function onAction(event) {
  let button = event.target.closest("[data-action]");
  if (!button || button.disabled) return;
  let { action, id, key, value } = button.dataset;
  if (button.closest("#ctxMenu")) hideContextMenu();
  let actions = {
    back: goBack,
    "new-tag": () => newTag(),
    "new-memo": () => newMemo(view === "detail" ? current() : null),
    book: openBook,
    demo: applyDemo,
    "toggle-list": () => {
      listOpen = !listOpen;
      renderPanel();
    },
    help: () => (panel === "help" ? closePanel() : openPanel("help")),
    "close-panel": closePanel,
    // 메모
    "toggle-tag": () => toggleMemoTag(id),
    "add-tag": addInlineTag,
    "save-memo": saveMemo,
    "edit-memo": () => editMemo(id),
    "delete-memo": () => removeMemo(id),
    "open-memo": () => showMemo(id),
    "memo-pot": () => goToMemoPot(getMemo(id)),
    "go-container": () => openDetail(id, true),
    // 태그
    "random-tag": rerollTag,
    "save-tag": saveTag,
    "edit-tag": () => editTag(id),
    "delete-tag": () => removeTag(id),
    // 교배
    choose: () => chooseTrait(key, value),
    "reroll-pot": rerollPot,
    "create-pot": createPot,
    // 뿌리·화분
    "root-filter": () => toggleRootFilter(id),
    "root-go": () => goToParent(id),
    "clear-filter": () => toggleRootFilter(null),
    rename: openRename,
    "save-rename": saveRename,
    "cancel-rename": closeRename,
    archive: () => setArchived(true),
    restore: () => setArchived(false),
    // 백업
  };
  if (actions[action]) actions[action]();
}

// 글자를 입력하는 동안 입력값을 기억해 둔다. (패널을 다시 그려도 사라지지 않게)
function onInput(event) {
  let t = event.target,
    { draft, field } = t.dataset;
  if (draft === "memo") memoDraft[field] = t.value;
  if (draft === "tag") tagDraft[field] = t.value;
  if (draft === "breed" && field === "name") {
    breedDraft.name = t.value;
    breedDraft.nameTouched = true;
  }
  if (draft === "breed-color") breedDraft.choices[field] = t.value;
}

// 고르기 칸(부모 선택)이나 색 고르기가 끝나면 패널을 다시 그린다.
function onChange(event) {
  let t = event.target,
    { draft, field } = t.dataset;
  if (draft === "breed" && (field === "aId" || field === "bId")) {
    breedDraft[field] = t.value;
    resetBreedChoices();
    renderPanel();
  }
  if (draft === "breed-color") renderPanel();
}

// 입력칸에서 Enter
function onFieldKey(event) {
  if (event.key !== "Enter" || event.target.tagName !== "INPUT") return;
  let { draft, field } = event.target.dataset;
  if (event.target.id === "editorInput") saveRename();
  else if (draft === "memo" && field === "newTag") addInlineTag();
  else if (draft === "tag" && field === "name") saveTag();
  else return;
  event.preventDefault();
}

// Esc: 메뉴 → 이름 입력창 → 패널 → 화면 순서로 닫는다.
function onEscape() {
  if (!el("ctxMenu").hidden) return hideContextMenu();
  if (!el("editor").hidden) return closeRename();
  if (panel && panel !== "list") return closePanel();
  if (view !== "garden") goBack();
}

// ---------- 패널 ----------

function openPanel(name) {
  panel = name;
  renderPanel();
}

// 패널을 닫는다. 넓은 화면의 상세 화면에서는 메모 목록으로 돌아간다.
function closePanel() {
  panel = view === "detail" ? "list" : null; // 상세 화면에서는 목록으로 돌아간다
  renderPanel();
}

// 지금 패널의 내용을 다시 그린다.
function renderPanel() {
  hideContextMenu();
  let box = el("panel");
  let scrollTop = panel === lastPanel ? box.scrollTop : 0;
  box.hidden = !panel;
  if (panel) {
    let renderers = {
      list: renderListPanel,
      memo: renderMemoPanel,
      memoView: renderMemoView,
      tag: renderTagPanel,
      breed: renderBreedPanel,
      help: renderHelpPanel,
    };
    box.innerHTML = renderers[panel]();
    box.classList.toggle("folded", panel === "list" && listFolded());
    box.scrollTop = scrollTop;
    // 새로 연 입력 패널은 첫 입력칸에 바로 쓸 수 있게
    if (panel !== lastPanel && ["memo", "tag"].includes(panel)) {
      let first = box.querySelector("input:not([type=color]), textarea");
      if (first) first.focus();
    }
  }
  lastPanel = panel;
  updateUI();
}

// 데이터가 바뀐 뒤: 목록 패널과 버튼 상태를 새로 고친다.
function afterChange() {
  if (panel === "memoView" && !getMemo(selectedMemoId)) return closePanel();
  if (panel === "list") renderPanel();
  else updateUI();
}

// 상세 화면의 메모 목록: 정보, 뿌리(부모), 메모 카드
function renderListPanel() {
  let c = current();
  if (!c) return "";
  let memos = memosOf(c).slice().reverse();
  // 좁은 화면: 접혀 있으면 이름과 메모 수만 보이는 띠 하나 (누르면 펼친다)
  if (listFolded())
    return `<button type="button" class="sheet-bar" data-action="toggle-list">
      <b>${esc(c.name)}</b><span>메모 ${memos.length} · 펼치기 ▴</span>
    </button>`;
  let stage = growthStage(memos.length);
  let isPot = c.type === "pot";
  let groups = filterGroups();
  let filterNote = groups.length
    ? `<p class="note">켠 뿌리 ${groups.length}개 <button type="button" class="link" data-action="clear-filter">모두 끄기</button></p>`
    : "";
  return `
    ${isWide() ? "" : `<button type="button" class="sheet-fold" data-action="toggle-list">접기 ▾</button>`}
    <h2>${esc(c.name)}${c.archived ? " <small>(보관됨)</small>" : ""}</h2>
    <p class="meta">${c.generation}세대 ${isPot ? "화분" : "식물"} · ${GROWTH_STAGES[stage].name} · 메모 ${memos.length}개</p>
    <div class="chips">${c.tagIds.map((id) => tagBadge(getTag(id))).join("")}</div>
    <div class="actions left">
      ${
        isPot
          ? `<button type="button" class="ghost small" data-action="rename">이름 바꾸기</button>
             <button type="button" class="ghost small" data-action="${c.archived ? "restore" : "archive"}">${c.archived ? "정원으로 꺼내기" : "보관하기"}</button>`
          : `<button type="button" class="ghost small" data-action="edit-tag" data-id="${c.tagIds[0]}">태그 고치기</button>`
      }
    </div>
    ${filterNote}
    ${
      !memos.length
        ? `<p class="meta">아직 메모가 없어요. 메모를 쓰면 씨앗이 싹을 틔워요.</p>`
        : memoGroup(
            "꽃",
            memos.filter((m) => hasMoreTags(c, m)),
            groups,
          ) +
          (isPot
            ? memoGroup(
                "바깥쪽 잎",
                memos.filter((m) => !hasMoreTags(c, m) && isOwnMemo(c, m)),
                groups,
              ) +
              memoGroup(
                "안쪽 잎",
                memos.filter((m) => !hasMoreTags(c, m) && !isOwnMemo(c, m)),
                groups,
              )
            : memoGroup(
                "잎",
                memos.filter((m) => !hasMoreTags(c, m)),
                groups,
              ))
    }`;
}

// 정원 사용법: 심기·옮기기·교배, 씨앗 포대
function renderGardenHelp() {
  let list = (items) =>
    `<ul class="help">${items.map((t) => `<li>${t}</li>`).join("")}</ul>`;
  return `
    <h2>사용법</h2>
    <div class="label">식물 · 화분</div>
    ${list([
      "누르면 그 식물(화분) 화면으로 가요.",
      "끌어서 빈 흙에 놓으면 옮겨 심어요.",
      "다른 식물 위에 놓으면 교배해서 두 쪽의 태그와 형질을 물려받은 화분이 생겨요.",
      "화분을 끌면 부모 세대가 끈(뿌리)으로 이어져 따라와요. 멀리 끌수록 많이 끌려와요.",
      "빈 흙을 옆으로 끌거나 휠을 굴리면 정원을 넘겨 봐요.",
    ])}
    <div class="label">씨앗 포대</div>
    ${list([
      "포대를 들고 좌우로 흔들면 씨앗이 하나씩 튀어나와요. 누르기만 해도 툭 흔들려요.",
      "포대와 씨앗은 끌어서 원하는 자리로 옮길 수 있어요.",
      "씨앗을 누르면 이름만 지어 새 태그(1세대 식물)를 심어요. 색과 모양은 무작위예요.",
      "씨앗을 포대 위에 놓으면 다시 들어가며 사라져요.",
    ])}
    <div class="label">아래 버튼</div>
    ${list(["책 아이콘: 모든 식물을 모아 보는 도감", "+ 메모: 태그를 골라 메모 쓰기"])}
    <div class="actions">
      <button type="button" class="ghost" data-action="close-panel">닫기</button>
    </div>`;
}

// 사용법: 상세 화면에서 할 수 있는 동작을 모아 둔다. (화면 위 설명 글 대신)
function renderHelpPanel() {
  if (view === "garden") return renderGardenHelp();
  let c = current();
  let isPot = c && c.type === "pot";
  let list = (items) =>
    `<ul class="help">${items.map((t) => `<li>${t}</li>`).join("")}</ul>`;
  return `
    <h2>사용법</h2>
    <div class="label">잎 · 꽃</div>
    ${list([
      "잎이나 꽃을 누르면 그 메모를 열어요.",
      "잎을 잡아 멀리 당기면 떨어지면서 메모를 지워요.",
      "꽃은 이 " +
        (isPot ? "화분" : "식물") +
        "보다 태그가 많은 메모예요. 두 번 누르면 그 태그 조합의 화분으로 가요.",
      ...(isPot
        ? ["바깥쪽 잎은 이 세대 메모, 줄기 안쪽 잎은 이전 세대 메모예요."]
        : []),
    ])}
    <div class="label">줄기 · ${isPot ? "화분" : "흙더미"}</div>
    ${list([
      `줄기나 ${isPot ? "화분" : "흙더미"}을 누르면 여기에 메모를 써요.`,
      `메모가 쌓일수록 자라요: ${GROWTH_STAGES.map((g) => `${g.name}(${g.min})`).join(" → ")}`,
    ])}
    ${
      isPot
        ? `<div class="label">뿌리</div>
    ${list([
      "뿌리 이름표를 한 번 누르면 켜고 끄기: 그 부모의 메모만 진하게 보여요.",
      "여러 뿌리를 켜면 모두 만족하는 메모만 진하게 보여요.",
      "두 번 누르면 그 부모로 옮겨 가요. 오른쪽 클릭(길게 누르기)으로 메뉴를 열 수 있어요.",
    ])}`
        : ""
    }
    <div class="actions">
      <button type="button" class="ghost" data-action="close-panel">닫기</button>
    </div>`;
}

// 화분의 메모 목록 한 묶음 (이 세대 / 이전 세대)
function memoGroup(title, memos, groups) {
  return (
    `<div class="label">${title} ${memos.length}</div>` +
    (memos.length
      ? `<ul class="memo-list">${memos.map((m) => memoCard(m, groups)).join("")}</ul>`
      : `<p class="meta">없어요.</p>`)
  );
}

function memoCard(m, groups) {
  let dim = groups.length && !memoMatchesAll(m, groups);
  return `<li><button type="button" class="memo-card${dim ? " dim" : ""}${m.id === selectedMemoId ? " selected" : ""}" data-action="open-memo" data-id="${m.id}">
    <b>${esc(m.title)}</b><span>${formatDate(m.createdAt)} · ${esc(tagLabel(m.tagIds))}</span>
  </button></li>`;
}

// 메모 보기
function renderMemoView() {
  let m = getMemo(selectedMemoId);
  if (!m) return "";
  let source = getContainer(m.sourceContainerId);
  return `
    <h2>${esc(m.title)}</h2>
    <p class="meta">${formatDate(m.createdAt)}${m.updatedAt !== m.createdAt ? ` · 고침 ${formatDate(m.updatedAt)}` : ""}</p>
    <div class="chips">${m.tagIds.map((id) => tagBadge(getTag(id))).join("")}</div>
    <div class="memo-body">${esc(m.content) || '<span class="meta">내용 없음</span>'}</div>
    ${source ? `<p class="meta">처음 쓴 곳 · <button type="button" class="link" data-action="go-container" data-id="${source.id}">${esc(source.name)}</button></p>` : ""}
    ${m.tagIds.length > 1 && !(current() && sameSet(current().tagIds, m.tagIds)) ? `<p class="meta"><button type="button" class="link" data-action="memo-pot" data-id="${m.id}">${esc(tagLabel(m.tagIds))} 화분으로 ›</button></p>` : ""}
    <div class="actions">
      <button type="button" class="ghost danger" data-action="delete-memo" data-id="${m.id}">삭제</button>
      <button type="button" class="ghost" data-action="close-panel">닫기</button>
      <button type="button" class="green" data-action="edit-memo" data-id="${m.id}">고치기</button>
    </div>`;
}

// 메모 쓰기·고치기
function renderMemoPanel() {
  let d = memoDraft;
  let chips = db.tags
    .map((tag) => {
      let on = d.tagIds.includes(tag.id),
        locked = d.locked.includes(tag.id);
      return tagChip(
        tag,
        `${on ? "on" : ""}${locked ? " locked" : ""}`,
        "toggle-tag",
      );
    })
    .join("");
  let notice = "";
  if (d.tagIds.length >= 2) {
    let pots = findPotsByTagSet(d.tagIds);
    notice = pots.length
      ? `<p class="note">이 태그 조합은 '${esc(pots[0].name)}' 화분에서도 보여요.</p>`
      : `<p class="meta">이 조합의 화분은 아직 없어요. 저장한 뒤 만들 수 있어요. (화분이 없어도 각 태그 식물에서 볼 수 있어요)</p>`;
  }
  let source = getContainer(d.sourceContainerId);
  return `
    <h2>${d.id ? "메모 고치기" : "새 메모"}</h2>
    ${source && !d.id ? `<p class="meta">'${esc(source.name)}'에 쓰는 메모 · 태그가 자동으로 붙어요</p>` : ""}
    <label>제목<input data-draft="memo" data-field="title" maxlength="60" value="${esc(d.title)}" placeholder="예: 등굣길에 본 것" autocomplete="off" /></label>
    <label>내용<textarea data-draft="memo" data-field="content" rows="6" placeholder="자유롭게 적어 주세요">${esc(d.content)}</textarea></label>
    <div class="label">태그 ${d.tagIds.length ? d.tagIds.length + "개" : "· 하나 이상 골라 주세요"}</div>
    <div class="chips">${chips || '<span class="meta">아직 태그가 없어요. 아래에서 새로 만들어 주세요.</span>'}</div>
    <div class="inline">
      <input data-draft="memo" data-field="newTag" maxlength="20" placeholder="새 태그 이름" value="${esc(d.newTag)}" autocomplete="off" />
      <button type="button" class="ghost" data-action="add-tag">+ 태그</button>
    </div>
    ${notice}
    <div class="actions">
      ${d.id ? `<button type="button" class="ghost danger" data-action="delete-memo" data-id="${d.id}">삭제</button>` : ""}
      <button type="button" class="ghost" data-action="close-panel">취소</button>
      <button type="button" class="green" data-action="save-memo">저장</button>
    </div>`;
}

// 태그 만들기·고치기: 이름만 받는다. 색과 모양은 무작위로 뽑고, 마음에 안 들면 다시 뽑는다.
function renderTagPanel() {
  let d = tagDraft;
  let traits = ["stemType", "leafType", "flowerType", "fruitType"]
    .map((key) => `${TRAIT_LABELS[key]} ${TRAIT_NAMES[key][d[key]]}`)
    .join(" · ");
  let pots = d.id
    ? db.containers.filter((c) => c.type === "pot" && c.tagIds.includes(d.id))
        .length
    : 0;
  return `
    <h2>${d.id ? "태그 고치기" : "새 태그 심기"}</h2>
    <p class="meta">이름만 지어 주세요. 색과 모양은 무작위로 정해지고, 메모가 쌓이면 자라요.</p>
    <label>태그 이름<input data-draft="tag" data-field="name" maxlength="20" value="${esc(d.name)}" placeholder="예: 학교" autocomplete="off" /></label>
    <div class="label">이번에 나온 모양</div>
    <p class="meta"><i class="dot" style="background:${d.color}"></i><i class="dot" style="background:${d.secondaryColor}"></i> ${traits}</p>
    ${pots ? `<p class="meta">이 태그로 이미 만든 화분 ${pots}개는 생길 때의 모양을 그대로 지켜요.</p>` : ""}
    <div class="actions">
      ${d.id ? `<button type="button" class="ghost danger" data-action="delete-tag" data-id="${d.id}">삭제</button>` : ""}
      ${d.id ? "" : `<button type="button" class="ghost" data-action="random-tag">모양 다시 뽑기</button>`}
      <button type="button" class="ghost" data-action="close-panel">취소</button>
      <button type="button" class="primary" data-action="save-tag">${d.id ? "저장" : "심기"}</button>
    </div>`;
}

// 교배: 부모 고르기, 형질마다 물려받을 쪽 고르기, 화분 이름
function renderBreedPanel() {
  let d = breedDraft;
  let [a, b] = breedParents();
  let options = (chosen) =>
    `<option value="">고르기</option>` +
    activeContainers()
      .slice()
      .sort((x, y) => x.generation - y.generation || byCreated(x, y))
      .map(
        (c) =>
          `<option value="${c.id}"${c.id === chosen ? " selected" : ""}>${esc(c.name)} · ${c.generation}세대</option>`,
      )
      .join("");
  let problem = breedProblem(a, b);
  let twin = !problem && findSameParents(a, b);
  let body = "";
  if (!problem) {
    let A = a.geneticTraits,
      B = b.geneticTraits,
      traits = breedTraits();
    let swatch = (col) => `<i style="background:${col}"></i>`;
    let colorRow = (key) => `
      <div class="label">${TRAIT_LABELS[key]}</div>
      <div class="seg">
        ${choiceButton(key, "parentA", swatch(A[key]) + "A")}
        ${choiceButton(key, "parentB", swatch(B[key]) + "B")}
        ${choiceButton(key, "blend", swatch(blendColor(A[key], B[key])) + "섞기")}
        <label class="pick${traits.inheritanceMap[key] === "custom" ? " on" : ""}"><input type="color" data-draft="breed-color" data-field="${key}" value="${traits[key]}" />직접</label>
      </div>`;
    let typeRow = (key) => `
      <div class="label">${TRAIT_LABELS[key]}</div>
      <div class="seg">
        ${choiceButton(key, "parentA", `A · ${TRAIT_NAMES[key][A[key]]}`)}
        ${choiceButton(key, "parentB", `B · ${TRAIT_NAMES[key][B[key]]}`)}
      </div>`;
    let sizeRow = (key, names) => `
      <div class="label">${TRAIT_LABELS[key]}</div>
      <div class="seg">${[1, 2]
        .map(
          (v) =>
            `<button type="button" class="${traits[key] === v ? "on" : ""}" data-action="choose" data-key="${key}" data-value="${v}">${names[v - 1]}${v === A[key] ? " · A" : ""}${v === B[key] ? " · B" : ""}</button>`,
        )
        .join("")}</div>`;
    body = `
      ${colorRow("primaryColor")}
      ${colorRow("secondaryColor")}
      ${["stemType", "leafType", "flowerType", "fruitType"].map(typeRow).join("")}
      ${sizeRow("stemThickness", ["1칸", "2칸"])}
      ${sizeRow("leafScale", ["보통", "크게"])}
      ${sizeRow("flowerScale", ["보통", "크게"])}
      <div class="label">화분</div>
      <button type="button" class="ghost small" data-action="reroll-pot">화분 모양 바꾸기</button>
      <label>화분 이름<input data-draft="breed" data-field="name" maxlength="30" value="${esc(d.name)}" autocomplete="off" /></label>`;
  }
  return `
    <h2>교배하기</h2>
    <p class="meta">두 부모의 태그를 모두 물려받고, 형질은 고른 쪽을 따라요.</p>
    <label>부모 A<select data-draft="breed" data-field="aId">${options(d.aId)}</select></label>
    <label>부모 B<select data-draft="breed" data-field="bId">${options(d.bId)}</select></label>
    ${
      problem
        ? `<p class="warn">${esc(problem)}</p>`
        : `<p class="note">${nextGeneration(a, b)}세대 화분 · ${esc(tagLabel(unique([...a.tagIds, ...b.tagIds])))}</p>`
    }
    ${twin ? `<p class="warn">같은 부모로 만든 '${esc(twin.name)}' 화분이 이미 있어요.</p>` : ""}
    ${body}
    <div class="actions">
      <button type="button" class="ghost" data-action="close-panel">취소</button>
      <button type="button" class="primary" data-action="create-pot"${problem ? " disabled" : ""}>화분 만들기</button>
    </div>`;
}

function choiceButton(key, value, label) {
  let on = breedDraft.choices[key] === value;
  return `<button type="button" class="${on ? "on" : ""}" data-action="choose" data-key="${key}" data-value="${value}">${label}</button>`;
}

// 찾기: 검색어 입력, 결과, 백업
// ---------- 메모 ----------

// 새 메모. 식물·화분 안에서 쓰면 그 태그가 자동으로 붙고 뺄 수 없다.
function newMemo(container) {
  let tags = container ? [...container.tagIds] : [];
  memoDraft = {
    id: null,
    title: "",
    content: "",
    tagIds: tags,
    locked: [...tags],
    sourceContainerId: container ? container.id : null,
    newTag: "",
  };
  openPanel("memo");
}

function editMemo(id) {
  let m = getMemo(id);
  memoDraft = {
    id,
    title: m.title,
    content: m.content,
    tagIds: [...m.tagIds],
    locked: [],
    sourceContainerId: m.sourceContainerId,
    newTag: "",
  };
  openPanel("memo");
}

function toggleMemoTag(id) {
  if (memoDraft.locked.includes(id))
    return flash("이 식물·화분의 태그는 자동으로 붙어요");
  memoDraft.tagIds = memoDraft.tagIds.includes(id)
    ? memoDraft.tagIds.filter((t) => t !== id)
    : [...memoDraft.tagIds, id];
  renderPanel();
}

// 메모를 쓰다가 새 태그를 만든다. 태그의 식물도 화단에 바로 심긴다.
function addInlineTag() {
  try {
    let { tag, plant } = createTag({ name: memoDraft.newTag });
    shownHeight.set(plant.id, 0);
    memoDraft.tagIds.push(tag.id);
    memoDraft.newTag = "";
    flash(`#${tag.name} 식물을 화단에 심었어요`);
    renderPanel();
  } catch (error) {
    alert(error.message);
  }
}

// 메모 저장. 여러 태그인데 같은 조합의 화분이 없으면 화분을 만들지 물어본다.
function saveMemo() {
  let d = memoDraft,
    memo;
  try {
    memo = d.id
      ? updateMemo(d.id, d)
      : d.sourceContainerId
        ? createMemoIn(d.sourceContainerId, d)
        : createMemo(d);
  } catch (error) {
    return alert(error.message);
  }
  flash(d.id ? "메모를 고쳤어요" : "메모를 심었어요");
  afterChange();
  if (
    !d.id &&
    memo.tagIds.length >= 2 &&
    !findPotsByTagSet(memo.tagIds).length &&
    confirm(
      `${tagLabel(memo.tagIds)} 조합의 화분은 아직 없어요.\n부모 둘을 골라 이 조합의 화분을 만들까요?`,
    )
  )
    return startBreed(suggestParents(memo.tagIds));
  showMemo(memo.id);
}

// 태그 조합을 만들 수 있는 부모 둘을 추천한다. 못 찾으면 빈 목록.
function suggestParents(tagIds) {
  if (tagIds.length === 2) return tagIds.map((id) => plantOfTag(id).id);
  let pots = activeContainers()
    .filter(
      (c) => c.type === "pot" && c.tagIds.every((id) => tagIds.includes(id)),
    )
    .sort((x, y) => y.tagIds.length - x.tagIds.length);
  for (let pot of pots) {
    let rest = tagIds.filter((id) => !pot.tagIds.includes(id));
    if (rest.length === 1) return [pot.id, plantOfTag(rest[0]).id];
  }
  return [];
}

function showMemo(id) {
  selectedMemoId = id;
  openPanel("memoView");
}

function removeMemo(id) {
  let m = getMemo(id);
  if (!m || !confirm(`'${m.title}' 메모를 지울까요?`)) return;
  deleteMemo(id);
  selectedMemoId = null;
  afterChange();
  if (panel === "memo") closePanel();
  flash("메모를 지웠어요");
}

// ---------- 태그 ----------

// 포대를 누르기만 하면 한 번 툭 흔든다.
function tapSack() {
  sack.va += (sack.a > 0 ? -1 : 1) * 0.09;
  let area = viewArea();
  shakeSack(sackLayout(area, gardenLayout(area)));
}

// 들고 있던 포대·씨앗을 내려놓는다.
// 씨앗을 포대 위에 놓으면 포대 속으로 들어가 사라진다(씨앗 버리기). 아니면 그 흙에 놓인다.
function dropCarry() {
  let k = carry;
  carry = null;
  let area = viewArea(),
    G = gardenLayout(area);
  let x = mouseX + k.dx,
    y = mouseY + k.dy;
  if (k.kind === "sack") {
    sack.pos = posAt(x, y, G, area);
    return saveShed();
  }
  let s = seeds.find((s) => s.id === k.id);
  if (!s) return;
  if (
    zoneAt(
      prevZones.ui.filter((z) => z.id === "sack"),
      mouseX,
      mouseY,
    )
  ) {
    s.back = { t: 0, x, y: y - 3 * (G.P + 2) };
    return flash("씨앗을 포대에 다시 넣었어요");
  }
  Object.assign(s, posAt(x, y, G, area), { z: 0 });
  saveShed();
}

// 흙에 떨어진 씨앗을 주우면 새 태그 만들기를 연다. 저장하면 그 씨앗 자리 근처에 심긴다.
function pickSeed(id) {
  let s = seeds.find((s) => s.id === id);
  if (!s || !s.landed) return;
  newTag();
  pickedSeedId = id;
}

// 포대 자리와 흙에 놓인 씨앗은 따로 저장한다. (정원 데이터·백업과는 별개인 화면 상태)
function shedKey() {
  return `${dataKey}-sack`;
}

function loadShed() {
  try {
    let saved = JSON.parse(localStorage.getItem(shedKey()) || "{}");
    if (saved.sack) sack.pos = saved.sack;
    seeds = (saved.seeds || []).map((s) => ({
      ...s,
      z: 0,
      vx: 0,
      vz: 0,
      landed: true,
    }));
  } catch (error) {
    seeds = [];
  }
}

function saveShed() {
  try {
    let landed = seeds
      .filter((s) => s.landed && !s.back)
      .map(({ id, x, d }) => ({ id, x, d }));
    localStorage.setItem(
      shedKey(),
      JSON.stringify({ sack: sack.pos, seeds: landed }),
    );
  } catch (error) {
    // 저장이 막혀 있어도 이번 화면에서는 그대로 쓴다
  }
}

function newTag() {
  pickedSeedId = null;
  tagDraft = { id: null, name: "", ...recommendTraits(), seed: newSeed() };
  shownHeight.set("tag-preview", 0);
  openPanel("tag");
}

function editTag(id) {
  tagDraft = { ...getTag(id), seed: plantOfTag(id).seed };
  shownHeight.set("tag-preview", 0);
  openPanel("tag");
}

// 새 태그의 모양을 다시 뽑는다. (이미 심은 태그는 모양을 바꾸지 않는다)
function rerollTag() {
  Object.assign(tagDraft, recommendTraits(), { seed: newSeed() });
  shownHeight.set("tag-preview", 0);
  renderPanel();
}

// 태그 저장: 새 태그면 화단에 식물을 심고, 고친 태그면 그 식물 상세로 간다.
function saveTag() {
  try {
    if (tagDraft.id) {
      updateTag(tagDraft.id, tagDraft);
      flash("태그를 고쳤어요");
      return openDetail(plantOfTag(tagDraft.id).id);
    }
    let { tag, plant } = createTag(tagDraft);
    shownHeight.set(plant.id, 0);
    let picked = seeds.find((s) => s.id === pickedSeedId);
    if (picked) {
      // 포대에서 꺼낸 씨앗이면 씨앗이 놓인 자리 근처에 심는다
      placeHints.set(plant.id, { x: picked.x, d: picked.d });
      seeds = seeds.filter((s) => s !== picked);
      pickedSeedId = null;
      saveShed();
    }
    goGarden();
    scrollToItem(plant);
    flash(`#${tag.name} 식물을 화단에 심었어요`);
  } catch (error) {
    alert(error.message);
  }
}

function removeTag(id) {
  let tag = getTag(id);
  if (!confirm(`#${tag.name} 태그와 식물을 지울까요?`)) return;
  try {
    deleteTag(id);
  } catch (error) {
    return alert(error.message);
  }
  goGarden();
  flash(`#${tag.name} 태그를 지웠어요`);
}

// ---------- 교배 ----------

// 교배 패널을 연다. parentIds로 부모를 미리 골라 둘 수 있다.
function startBreed(parentIds = []) {
  breedDraft = {
    aId: parentIds[0] || "",
    bId: parentIds[1] || "",
    name: "",
    nameTouched: false,
    potStyle: randomPotStyle(),
    seed: newSeed(),
  };
  resetBreedChoices();
  shownHeight.set("breed-preview", 0);
  openPanel("breed");
}

function breedParents() {
  return [getContainer(breedDraft.aId), getContainer(breedDraft.bId)];
}

// 부모가 바뀌면 형질 선택을 기본값으로, 이름은 (직접 고치지 않았으면) 태그 이름으로
function resetBreedChoices() {
  let [a, b] = breedParents();
  breedDraft.choices = { ...DEFAULT_CHOICES };
  if (!breedDraft.nameTouched)
    breedDraft.name =
      a && b ? tagNames(unique([...a.tagIds, ...b.tagIds])).join(" + ") : "";
}

function breedTraits() {
  let [a, b] = breedParents();
  return inheritTraits(a, b, breedDraft.choices);
}

// 형질 하나의 물려받을 쪽을 고른다. 크기 형질은 값(1/2)을 고르고, 부모 값과 같으면 그 부모로 기록한다.
function chooseTrait(key, value) {
  if (SIZE_TRAITS.includes(key)) {
    let [a, b] = breedParents(),
      v = Number(value);
    value =
      v === a.geneticTraits[key]
        ? "parentA"
        : v === b.geneticTraits[key]
          ? "parentB"
          : v;
  }
  breedDraft.choices[key] = value;
  renderPanel();
}

function rerollPot() {
  breedDraft.potStyle = randomPotStyle();
}

// 화분 만들기. 같은 부모 조합이 이미 있으면 한 번 더 확인한다.
function createPot() {
  let [a, b] = breedParents();
  let options = {
    name: breedDraft.name,
    traits: breedTraits(),
    potStyle: breedDraft.potStyle,
    seed: breedDraft.seed,
  };
  let pot;
  try {
    pot = breed(a.id, b.id, options);
  } catch (error) {
    if (error.code !== "duplicate") return alert(error.message);
    if (
      !confirm(
        `${error.message}\n그래도 새 화분을 하나 더 만들까요? (취소하면 기존 화분으로 가요)`,
      )
    )
      return openDetail(error.existing.id);
    pot = breed(a.id, b.id, { ...options, allowDuplicate: true });
  }
  // 새 화분은 (끌어다 놓아 교배했으면 부모 사이에) 위에서 떨어져 심기고, 줄기가 0부터 자란다.
  if (breedDraft.near) placeHints.set(pot.id, breedDraft.near);
  shownHeight.set(pot.id, 0);
  spawnAt.set(pot.id, millis());
  goGarden();
  scrollToItem(pot);
  flash(`${pot.generation}세대 화분 '${pot.name}'이(가) 생겼어요`);
}

// ---------- 화분 관리 ----------

function openRename() {
  el("editorInput").value = current().name;
  el("editor").hidden = false;
  el("editorInput").focus();
}

function saveRename() {
  renameContainer(currentId, el("editorInput").value);
  closeRename();
  afterChange();
}

function closeRename() {
  el("editor").hidden = true;
}

// 화분 보관·꺼내기. 보관해도 계보와 메모는 그대로 남는다.
function setArchived(archived) {
  let c = current();
  if (
    archived &&
    !confirm(
      `'${c.name}' 화분을 보관할까요?\n정원에서는 숨겨지지만 계보와 메모는 그대로 남아요. (찾기에서 다시 꺼낼 수 있어요)`,
    )
  )
    return;
  archiveContainer(c.id, archived);
  if (archived) {
    goGarden();
    flash(`'${c.name}' 화분을 보관했어요`);
  } else {
    afterChange();
    flash("화분을 정원으로 다시 꺼냈어요");
  }
}

// 데모 버튼: 지금 정원을 지우고 데모 정원(demo.js)으로 바꾼 뒤 새로고침한다.
function applyDemo() {
  if (
    !confirm(
      "지금 정원을 지우고 데모 정원(식물 5 · 화분 7 · 4세대)으로 바꿀까요?\n지금 있는 메모와 식물은 모두 사라져요.",
    )
  )
    return;
  seedGarden();
}

// ---------- 화면 글자·버튼 ----------

// 잠깐 안내 문구 자리에 알림을 띄운다.
function flash(message) {
  flashMessage = message;
  flashUntil = millis() + FLASH_TIME;
}

// 제목과 안내 문구를 지금 화면에 맞게 바꾼다. 같은 내용이면 DOM을 건드리지 않는다.
function updateHint() {
  let c = current();
  let title =
    view === "book" ? "식물 도감" : !c || view === "garden" ? "" : c.name;
  let hint = millis() < flashUntil ? flashMessage : defaultHint(c);
  if (title !== lastTitle) {
    lastTitle = title;
    el("title").textContent = title;
  }
  if (hint !== lastHint) {
    lastHint = hint;
    el("hint").textContent = hint;
    el("hint").hidden = !hint;
  }
}

function defaultHint(c) {
  if (panel === "tag")
    return "이름만 지어 주세요. 색과 모양은 무작위로 정해져요. (미리보기는 다 자란 모습)";
  if (panel === "breed")
    return "형질마다 부모 A·B 중 물려받을 쪽을 골라 주세요.";
  if (view === "book")
    return "잎·꽃 수와 계보를 볼 수 있어요 · 카드를 누르면 그 식물로 가요.";
  return ""; // 정원·상세 화면의 동작 설명은 사용법 버튼 안에
}

// 버튼 줄을 지금 화면에 맞게 보여 주고, 패널이 버튼 줄을 가리지 않게 한다.
function updateUI() {
  document
    .querySelectorAll("#controls [data-on]")
    .forEach(
      (node) => (node.hidden = !node.dataset.on.split(" ").includes(view)),
    );
  el("demo").hidden = view !== "garden";
  el("back").textContent = backStack.length
    ? "‹ 뒤로"
    : view === "detail" && fromBook
      ? "‹ 도감"
      : "‹ 정원";
  el("panel").style.bottom =
    `${innerHeight - el("controls").getBoundingClientRect().top + 10}px`;
}

// 창 크기가 바뀌면 캔버스도 맞춘다.
function windowResized() {
  let wasWide = isWide();
  resizeCanvas(windowWidth, windowHeight);
  // 넓은 화면 ↔ 좁은 화면이 바뀌면 목록 패널 모양(접힌 띠)도 바뀐다
  if (wasWide !== isWide() && panel === "list") return renderPanel();
  updateUI();
}

// ---------- 도우미 ----------

function el(id) {
  return document.getElementById(id);
}

// 좁은 화면에서 메모 목록이 접혀 있는지
function listFolded() {
  return !isWide() && !listOpen;
}

function isWide() {
  return width >= WIDE;
}

// 태그 만들기·교배 패널이 열려 있으면 캔버스는 미리보기를 보여 준다.
function previewing() {
  return panel === "tag" || panel === "breed";
}

// 누를 수 없는 태그 표시
function tagBadge(tag) {
  if (!tag) return "";
  return `<span class="chip" style="--dot:${tag.color}">#${esc(tag.name)}</span>`;
}

// 태그 칩 버튼
function tagChip(tag, cls, action) {
  if (!tag) return "";
  return `<button type="button" class="chip ${cls}" data-action="${action}" data-id="${tag.id}" style="--dot:${tag.color}">#${esc(tag.name)}</button>`;
}

// HTML에 넣을 글자의 특수문자를 바꾼다.
function esc(value) {
  return String(value == null ? "" : value).replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ],
  );
}

// "2026.10.20 14:05"
function formatDate(iso) {
  let d = new Date(iso),
    two = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${two(d.getMonth() + 1)}.${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`;
}
