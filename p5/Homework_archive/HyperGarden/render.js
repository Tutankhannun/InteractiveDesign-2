// =============================================================
// 정원 아카이브 (Midterm) — 픽셀 그리기
// =============================================================
// - 모든 그래픽은 P×P 크기의 네모 칸(픽셀)을 찍어서 그린다.
// - 유전 형질(geneticTraits)은 모양을, 메모 개수는 크기(줄기 높이·잎·꽃·열매 수)를 정한다.
// - 같은 형질과 씨앗값이면 항상 같은 모양이라, 자랄 때는 보이는 높이만 늘려 준다.
// =============================================================

// ---------- 설정값 ----------
const MAX_STEM = 84; // 다 자랐을 때 줄기 높이(칸)
const LAYOUT_CELLS = 64; // 화면 칸 크기(P)를 정할 때 식물 몫으로 잡는 높이(칸). 잎·꽃이 보이는 크기를 정한다
const PREVIEW_COUNT = 26; // 미리보기는 꽃과 열매가 다 달린 모습(메모 26개)으로 보여 준다
const GARDEN_GAP = 38; // 정원에서 이웃과 이만큼(칸)은 떨어뜨려 심는다
const FORK_AT = 27; // 갈래 줄기가 갈라지는 길이(칸)
const ROOT_ROW = 80; // 조상 뿌리 이름표 줄 간격(px)
const GARDEN_LABEL = 64; // 정원 이름표 최대 폭(칸): 이웃과 조금 겹쳐도 이름이 덜 잘리게
const BOOK_CARD_W = 210; // 도감 카드 최소 폭(px)
const BOOK_CARD_H = 320; // 도감 카드 높이(px)
const BOOK_GAP = 14; // 도감 카드 사이 간격(px)

// 기본 색상
const BG = "#fbf7ee"; // 배경
const GROUND = "#efe7d3"; // 흙바닥
const INK = "#2b3a55"; // 이름표·글자
const PAPER = "#fffdf6"; // 밝은 글자·흰 꽃 속
const MUTED = "#8a8f7a"; // 흐린 글자
const ACCENT = "#e2401c"; // 고른 것·누를 수 있는 것
const ROOT = "#a8794a"; // 뿌리
const SEED = "#8a5a2b"; // 씨앗

// ---------- 상태 ----------
let zones = emptyZones(); // 이번 프레임에 그린 클릭 가능 영역
let prevZones = emptyZones(); // 지난 프레임의 영역 (마우스를 올린 것 강조용)
let detailGround = null; // 상세 화면의 바닥선 (떨어지는 잎이 내려앉는 곳)
let detailScroll = 0; // 상세 화면 세로 스크롤(px): 뿌리가 넘칠 때만 생긴다
const plantCache = new Map(); // 형질·씨앗별로 만들어 둔 식물 구조
const colorCache = new Map(); // 형질 색으로 만든 식물 색 조합
const shownHeight = new Map(); // 지금 화면에 보이는 줄기 높이 (자라는 애니메이션)
const spawnAt = new Map(); // 새 화분이 생긴 시각 (떨어지는 애니메이션)
const placeHints = new Map(); // 새 화분을 심을 때 가까이 두고 싶은 자리 (부모 사이)

function emptyZones() {
  return {
    leaves: [],
    flowers: [],
    roots: [],
    items: [],
    cards: [],
    ui: [],
    body: [],
  };
}

// 기준점 O에서 (x, y)번째 칸에 네모 하나를 찍는다. 모든 픽셀 그림의 기본 단위.
function cellAt(O, x, y) {
  rect(O.x + x * O.P, O.y + y * O.P, O.P, O.P);
}

// 줄기 칸: 굵기만큼 오른쪽으로 칸을 더 찍는다.
function stemCell(O, x, y, thick) {
  for (let i = 0; i < thick; i++) cellAt(O, x + i, y);
}

// y부터 아래로 흙바닥과 점 무늬를 그린다.
function drawSoil(y, h, ox, P) {
  fill(GROUND);
  rect(0, y, width, h);
  fill(shade(GROUND, -0.07));
  rect(0, y, width, P);
  // 흙바닥의 성긴 픽셀 무늬
  fill(shade(GROUND, -0.04));
  for (let yy = y + 3 * P, row = 0; yy < y + h; yy += 3 * P, row++) {
    for (
      let x = (ox % (8 * P)) + (row % 2) * 4 * P - 8 * P;
      x < width;
      x += 8 * P
    )
      rect(x, yy, P, P);
  }
}

// ---------- 식물 ----------

// 형질의 두 색(잎 색, 꽃·열매 색)으로 식물 전체 색 조합을 만든다.
function plantColors(t) {
  let key = t.primaryColor + t.secondaryColor;
  if (!colorCache.has(key)) {
    let [r, g, b] = hexToRgb(t.secondaryColor);
    colorCache.set(key, {
      stem: shade(t.primaryColor, -0.35),
      leaf: t.primaryColor,
      leaf2: shade(t.primaryColor, -0.2),
      flower: t.secondaryColor,
      // 노란 꽃에는 빨간 꽃술, 나머지는 노란 꽃술
      center: r > 200 && g > 170 && b < 120 ? "#e2401c" : "#ffd400",
      fruit: shade(t.secondaryColor, -0.08),
    });
  }
  return colorCache.get(key);
}

// 형질·씨앗마다 식물 구조를 한 번만 만들고 재사용한다.
function getPlant(traits, seed) {
  let key = [
    seed,
    traits.stemType,
    traits.leafType,
    traits.leafScale,
    traits.stemThickness,
    traits.primaryColor,
  ].join("|");
  if (!plantCache.has(key)) {
    if (plantCache.size > 300) plantCache.clear(); // 미리보기에서 색을 바꿀 때마다 쌓이지 않게
    plantCache.set(key, buildPlant(traits, seed));
  }
  return plantCache.get(key);
}

// 씨앗값(seed)으로 다 자란 식물의 구조(줄기 칸, 가지, 잎 위치)를 미리 만든다.
// 줄기는 '자란 길이' h(1칸씩)를 따라 이어지는 길이라서 옆으로 휘거나 갈라져도 자라는 순서가 맞다.
// h ≤ 지금 높이 H인 칸·가지만 보인다. 줄기 모양은 stemType, 잎 모양·크기는 leafType·leafScale을 따른다.
function buildPlant(traits, seed) {
  let rand = mulberry32(seed);
  let colors = plantColors(traits);
  let type = traits.stemType;
  let cactus = type === 5;
  let thick = cactus ? 4 : traits.stemThickness;
  let dir = rand() < 0.5 ? -1 : 1; // 기울거나 갈라지는 쪽
  let phase = rand() * TWO_PI;
  let stem = [], // 모든 줄기 칸 { x, y, h }
    path = [null], // 원줄기: path[h] = { x, y }
    curls = []; // 덩굴손 { h, y, cells }

  // 원줄기: 줄마다 목표 x로 한 칸씩 다가가며(대각선) 올라간다. 계단 줄기는 옆으로 한 번에 걷는다.
  let target = (i) => {
    if (type === 1) return dir * round(18 * pow(i / MAX_STEM, 1.4)); // 기운: 한쪽으로 휘어 오른다
    if (type === 3 && i > FORK_AT)
      return dir * min(5, floor((i - FORK_AT) / 2)); // 갈래: 갈라진 뒤 비켜 오른다
    if (type === 2) return round((abs(((i / 9) % 4) - 2) - 1) * 5); // 지그재그: 크게 꺾인다
    if (type === 4) return round(sin(i / 8 + phase) * 8); // 덩굴: 크게 굽이친다
    if (type === 6) return round(sin(i / 28 + phase) * 2); // 늘어진: 살짝만 휜다
    return null;
  };
  let x = 0,
    y = -1,
    h = 1,
    nextStep = 6 + floor(rand() * 4);
  let put = (cx, cy) => {
    stem.push({ x: cx, y: cy, h });
    path[h] = { x: cx, y: cy };
    h++;
  };
  while (h <= MAX_STEM + 1) {
    let i = -y;
    let tx = target(i);
    if (type === 7 && i >= nextStep) {
      // 계단: 몇 줄마다 옆으로 2~4칸 걸어간다
      let run =
        (2 + floor(rand() * 3)) *
        (x > 2 ? -1 : x < -2 ? 1 : rand() < 0.5 ? -1 : 1);
      for (let r = 0; r < abs(run) && h <= MAX_STEM + 1; r++) {
        x += Math.sign(run);
        put(x, y);
      }
      nextStep = i + 6 + floor(rand() * 5);
    } else if (tx !== null && tx !== x) x += Math.sign(tx - x);
    else if (tx === null && i > 8 && rand() < 0.04) x += rand() < 0.5 ? -1 : 1;
    x = constrain(x, -18, 18);
    put(x, y);
    y--;
  }
  let top = path.length - 1;

  // 갈래: 3분의 1쯤에서 반대쪽으로 줄기가 하나 더 갈라져 오른다.
  let forks = [];
  if (type === 3) {
    let h0 = FORK_AT,
      f = { ...path[h0] },
      fork = [null];
    for (let j = 1; j <= floor((MAX_STEM - h0) * 0.75); j++) {
      if (j < 14 && j % 2) f.x -= dir;
      else f.y--;
      stem.push({ x: f.x, y: f.y, h: h0 + j });
      fork[h0 + j] = { x: f.x, y: f.y };
    }
    forks.push(fork);
  }

  // 가지: 원줄기(와 갈래)를 따라 좌우 번갈아 낸다.
  let branches = [],
    side = rand() < 0.5 ? -1 : 1,
    id = 0;
  let tone = () => (rand() < 0.35 ? colors.leaf2 : colors.leaf);
  let gap = cactus ? 4 : type === 3 ? 4 : type === 6 ? 4 : 3;
  let sprite = LEAF_SPRITES[traits.leafType];
  let growBranch = (line, hh, sideNow, scale = 1) => {
    let p = line[hh];
    let t = hh / MAX_STEM;
    let cells = [],
      bx = p.x + (sideNow > 0 ? thick - 1 : 0),
      by = p.y;
    let leaves = [];
    if (cactus) {
      // 선인장 팔: 옆으로 나갔다가 위로 꺾여 오른다 (두 칸 굵기). 짧은 팔은 가시처럼 잎만.
      let arm = rand() < 0.5 && t > 0.12 && t < 0.7;
      let out = arm ? 3 + floor(rand() * 3) : 1;
      let up = arm ? 6 + floor(rand() * 8) : 0;
      for (let i = 0; i < out; i++) {
        bx += sideNow;
        cells.push({ x: bx, y: by }, { x: bx, y: by - 1 });
      }
      for (let i = 0; i < up; i++) {
        by--;
        cells.push({ x: bx, y: by - 1 }, { x: bx - sideNow, y: by - 1 });
      }
      if (arm) by -= 1;
      leaves.push(
        makeLeaf(
          id++,
          arm ? sprite : SMALL_LEAF,
          sideNow,
          bx + sideNow,
          by - 1,
          tone(),
          -1,
          true,
          arm ? traits.leafScale : 1,
        ),
      );
      return {
        h: hh,
        y: p.y,
        side: sideNow,
        cells,
        leaves,
        tip: { x: bx, y: by },
      };
    }
    let len = max(3, round((6 + rand() * 6) * (1 - t * 0.5) * scale));
    let flat = 1 + floor(rand() * 2);
    let droop = type === 6;
    for (let i = 0; i < len; i++) {
      bx += sideNow;
      // 늘어진 줄기는 조금 오르다 아래로 처지고, 나머지는 대각선 위로 뻗는다
      if (droop) by += i < flat ? -1 : i >= flat + 1 ? 1 : 0;
      else if (i >= flat) by--;
      cells.push({ x: bx, y: by });
    }
    leaves.push(
      droop
        ? makeLeaf(
            id++,
            sprite,
            sideNow,
            bx + sideNow,
            by + 1,
            tone(),
            1,
            true,
            traits.leafScale,
          )
        : makeLeaf(
            id++,
            sprite,
            sideNow,
            bx + sideNow,
            by - 1,
            tone(),
            -1,
            true,
            traits.leafScale,
          ),
    );
    // 긴 가지에는 가운데 아래쪽으로 작은 잎을 하나 더 단다.
    if (len >= 7 && rand() < 0.7) {
      let m = cells[floor(len / 2)];
      leaves.push(
        makeLeaf(
          id++,
          SMALL_LEAF,
          sideNow,
          m.x + sideNow,
          m.y + 1,
          tone(),
          1,
          false,
        ),
      );
    }
    return {
      h: hh,
      y: p.y,
      side: sideNow,
      cells,
      leaves,
      tip: { x: bx, y: by },
    };
  };
  for (let hh = 6; hh < top - 2; hh += gap + floor(rand() * 2)) {
    // 덩굴·지그재그는 줄기가 휘는 바깥쪽으로 가지를 내면 덜 겹친다
    let bend =
      path[hh + 2] && path[hh - 2]
        ? Math.sign(path[hh + 2].x - path[hh - 2].x)
        : 0;
    let s2 = (type === 4 || type === 2) && bend && rand() < 0.6 ? -bend : side;
    branches.push(growBranch(path, hh, s2));
    side = -side;
  }
  for (let fork of forks) {
    let start = fork.findIndex((p) => p);
    for (let hh = start + 4; hh < fork.length - 2; hh += gap + 1)
      branches.push(growBranch(fork, hh, rand() < 0.7 ? -dir : dir, 0.8));
  }

  // 덩굴손: 덩굴 줄기 곳곳에 동그랗게 말린 줄기
  if (type === 4) {
    for (let hh = 10; hh < top - 4; hh += 9 + floor(rand() * 5)) {
      let p = path[hh],
        sd = rand() < 0.5 ? -1 : 1;
      let base = p.x + (sd > 0 ? thick : -1);
      let cells = [
        [0, 0],
        [1, -1],
        [2, -1],
        [3, -2],
        [3, -3],
        [2, -4],
        [1, -3],
        [2, -2],
      ].map(([dx, dy]) => ({ x: base + sd * dx, y: p.y + dy }));
      curls.push({ h: hh + 3, y: p.y, cells });
    }
  }

  // 줄기에 바로 붙는 안쪽 잎 자리 (화분에서 이전 세대 메모용, 흙색이 섞인 바랜 색)
  // 두 칸마다 좌우 번갈아 두되, 같은 쪽 가지와 겹치면 반대쪽, 그래도 겹치면 건너뛴다.
  let inner = [],
    innerSide = -1;
  let blocked = (sd, hh) =>
    branches.some((b) => b.side === sd && b.h <= hh + 3 && b.h >= hh - 1);
  for (let hh = 3; hh < top - 2; hh += 2) {
    let p = path[hh];
    let sd = innerSide;
    innerSide = -innerSide;
    if (blocked(sd, hh)) sd = -sd;
    if (blocked(sd, hh)) continue;
    let leaf = makeLeaf(
      "in" + inner.length,
      SMALL_LEAF,
      sd,
      sd > 0 ? p.x + thick : p.x - 1,
      p.y,
      blendColor(colors.leaf, GROUND, 0.5),
      -1,
      false,
    );
    inner.push({ h: hh, y: p.y, leaf });
  }
  return {
    stem,
    path,
    thick,
    cactus,
    branches,
    curls,
    inner,
    tops: {},
    sprouts: [],
    sproutsOut: [],
    phase: rand() * TWO_PI,
  };
}

// 스프라이트 문자 그림을 실제 칸 목록으로 바꾼다.
// side: 1 오른쪽 / -1 왼쪽(좌우 반전), vy: -1 위로 / 1 아래로(상하 반전), (ax, ay): 붙는 자리
// k: 크기 배율(한 글자를 k×k 칸으로). d는 붙는 자리에서의 거리로, 다시 자랄 때 가까운 칸부터 나타난다.
function makeLeaf(id, sprite, side, ax, ay, base, vy, tip, k = 1) {
  let cells = [],
    h = sprite.length;
  sprite.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      if (ch === ".") return;
      let col =
        ch === "v" ? shade(base, -0.3) : ch === "o" ? shade(base, -0.16) : base;
      for (let i = 0; i < k; i++) {
        for (let j = 0; j < k; j++) {
          let lx = c * k + i,
            ly = (h - 1 - r) * k + j;
          cells.push({ x: ax + side * lx, y: ay + vy * ly, col, d: lx + ly });
        }
      }
    }),
  );
  let xs = cells.map((c) => c.x),
    ys = cells.map((c) => c.y);
  return {
    id,
    tip,
    cells,
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
    maxD: Math.max(...cells.map((c) => c.d)),
  };
}

// 바람에 흔들리는 정도(칸). 위쪽일수록 크게 흔들리고, 반올림해서 한 칸씩 뚝뚝 움직인다.
function sway(y, t) {
  return round(sin(t + y * 0.04) * 1.3 * pow(-y / MAX_STEM, 1.4));
}

// 메모 개수 → 줄기 높이(칸). 단계가 오를 때마다 크게, 단계 안에서는 조금씩 자란다.
function stemHeight(count) {
  if (count < 4) return 2 + count * 2; // 새싹
  if (count < 10) return 16 + (count - 4) * 3; // 줄기와 잎
  if (count < 20) return 34 + (count - 10) * 3; // 가지와 꽃
  return min(MAX_STEM, 64 + round((count - 20) * 1.5)); // 다 자람, 열매
}

// 보이는 높이를 목표 높이까지 조금씩 바꾼다. 처음 보는 식물은 바로 목표 높이.
function growTo(key, target) {
  let h = shownHeight.has(key) ? shownHeight.get(key) : target;
  h += constrain(target - h, -0.6, 0.35);
  shownHeight.set(key, h);
  return h;
}

// 메모 개수(opts.count)만큼 자란 식물을 그린다.
// opts.memos를 주면 잎·꽃 하나하나에 메모를 아래(오래된 것)부터 단다.
// opts.memoFlowers면 자기보다 태그가 많은 메모는 꽃, 나머지 메모는 잎에 단다.
// opts.layered면 (화분) 잎 메모 중 현재 세대 메모는 바깥(가지 끝 잎), 이전 세대 메모는 안쪽(줄기에 붙은 잎)에 단다.
// opts: count, memos, memoFlowers, layered, key(자라는 애니메이션 기준), filterGroups(뿌리 필터), selectedId, interactive
function drawPlant(c, O, opts) {
  let traits = c.geneticTraits,
    colors = plantColors(traits);
  let count = opts.count;
  if (count === 0) return drawSeed(colors, O);
  let plant = getPlant(traits, c.seed);
  let thick = plant.thick;
  let target = stemHeight(count);
  let H = max(2, round(growTo(opts.key, target)));
  let t = frameCount * 0.02 + plant.phase;
  let slots = [], // 메모를 달 수 있는 자리: 잎 또는 꽃
    fruits = [];
  let memos = opts.memos || [];
  let flowerMemos = opts.memoFlowers
    ? memos.filter((m) => hasMoreTags(c, m))
    : [];
  let leafMemos = memos.filter((m) => !flowerMemos.includes(m));
  let outerMemos = opts.layered ? leafMemos.filter((m) => isOwnMemo(c, m)) : [];
  let innerMemos = opts.layered
    ? leafMemos.filter((m) => !isOwnMemo(c, m))
    : [];
  let k = flowerRadius(traits); // 꽃 반지름(칸)

  let shown = plant.stem.filter((s) => s.h <= H);
  if (plant.cactus) {
    // 선인장 몸통: 굵은 초록 기둥, 둘째 줄은 밝게, 가장자리에 가시, 꼭대기는 둥글게
    let spine = blendColor(colors.leaf, PAPER, 0.6);
    for (let s of shown) {
      let sx = s.x + sway(s.y, t);
      fill(colors.leaf2);
      stemCell(O, sx, s.y, thick);
      fill(shade(colors.leaf, 0.15));
      cellAt(O, sx + 1, s.y);
      if (s.h % 4 === 0) {
        fill(spine);
        cellAt(O, (s.h / 4) % 2 ? sx - 1 : sx + thick, s.y);
      }
    }
    let cap = plant.path[min(H, plant.path.length - 1)];
    fill(colors.leaf2);
    for (let i = 1; i < thick - 1; i++)
      cellAt(O, cap.x + sway(cap.y, t) + i, cap.y - 1);
  } else {
    fill(colors.stem);
    for (let s of shown) stemCell(O, s.x + sway(s.y, t), s.y, thick);
  }
  // 덩굴손
  fill(colors.stem);
  for (let curl of plant.curls)
    if (curl.h <= H)
      for (let cc of curl.cells) cellAt(O, cc.x + sway(curl.y, t), cc.y);
  // 상세 화면에서는 줄기를 누르면 메모를 쓴다
  if (opts.interactive)
    zones.body.push({
      O,
      cells: shown.map((s) => ({ x: s.x + sway(s.y, t), y: s.y, w: thick })),
    });
  let branchColor = plant.cactus ? colors.leaf2 : colors.stem;

  if (count < 4) {
    // 새싹: 메모 하나에 작은 잎(여러 태그 메모는 꽃) 하나씩, 아래서부터 좌우 번갈아
    for (let i = 0; i < count; i++) {
      let side = i % 2 ? 1 : -1,
        at = plant.path[2 + i * 2],
        y = at.y;
      if (2 + i * 2 > H) break;
      let sh = sway(y, t);
      if (flowerMemos.includes(memos[i])) {
        let sx = at.x + (side > 0 ? thick - 1 : 0);
        fill(colors.stem);
        cellAt(O, sx + side + sh, y);
        slots.push({ kind: "flower", x: sx + side * (k + 2) + sh, y: y - 1 });
        continue;
      }
      if (outerMemos.includes(memos[i])) {
        let sx = at.x + (side > 0 ? thick - 1 : 0);
        if (!plant.sproutsOut[i])
          plant.sproutsOut[i] = makeLeaf(
            "so" + i,
            SMALL_LEAF,
            side,
            sx + side * 3,
            y - 1,
            colors.leaf,
            -1,
            false,
          );
        fill(colors.stem);
        cellAt(O, sx + side + sh, y);
        cellAt(O, sx + side * 2 + sh, y - 1);
        slots.push({
          kind: "leaf",
          leaf: plant.sproutsOut[i],
          sh,
          layer: "outer",
        });
        continue;
      }
      if (!plant.sprouts[i]) {
        let sx = at.x;
        plant.sprouts[i] = makeLeaf(
          "s" + i,
          SMALL_LEAF,
          side,
          side > 0 ? sx + thick : sx - 1,
          y,
          colors.leaf,
          -1,
          false,
        );
      }
      slots.push({ kind: "leaf", leaf: plant.sprouts[i], sh, layer: "inner" });
    }
  } else {
    // 현재 높이 안에 있는 가지만 보여 준다.
    let visible = plant.branches.filter((b) => b.h <= H - 3);
    let stage = growthStage(count);
    // 꽃은 '꽃 피움' 단계부터 최대 5송이, 열매는 '열매 맺음' 단계부터 최대 6개
    // 여러 태그 메모가 있으면 단계와 상관없이 그 수만큼 꽃을 피운다. (가지 수 + 꼭대기까지)
    let flowerCount = stage >= 3 ? min(5, 1 + floor((count - 10) / 3)) : 0;
    flowerCount = min(visible.length + 1, max(flowerCount, flowerMemos.length));
    let fruitCount = stage >= 4 ? min(6, 1 + floor((count - 20) / 3)) : 0;
    // 맨 위 꽃 하나 + 위쪽 가지 끝에 양쪽으로 번갈아 띄엄띄엄, 모자라면 나머지 가지에도
    let topDown = visible.slice().reverse();
    let spaced = topDown.filter((b, i) => i % 4 === 1 || i % 4 === 2);
    let bloomBranches = [
      ...spaced,
      ...topDown.filter((b) => !spaced.includes(b)),
    ].slice(0, max(0, flowerCount - 1));
    // 열매는 꽃이 없는 가지에 하나 걸러 하나씩 매단다
    let fruitBranches = visible
      .filter((b) => !bloomBranches.includes(b))
      .filter((b, i) => i % 2 === 0)
      .slice(0, fruitCount);

    for (let b of visible) {
      let sh = sway(b.y, t);
      fill(branchColor);
      for (let cc of b.cells) cellAt(O, cc.x + sh, cc.y);
      let bloom = bloomBranches.includes(b);
      if (bloom) {
        cellAt(O, b.tip.x + b.side + sh, b.tip.y - 1);
        slots.push({
          kind: "flower",
          x: b.tip.x + b.side * k + sh,
          y: b.tip.y - k,
          layer: "outer",
        });
      }
      for (let leaf of b.leaves)
        if (!(bloom && leaf.tip))
          slots.push({
            kind: "leaf",
            leaf,
            sh,
            layer: leaf.tip ? "outer" : "inner",
          });
      if (fruitBranches.includes(b)) {
        let m = b.cells[floor(b.cells.length / 2)];
        fruits.push({ x: m.x + sh, y: m.y + 1 });
      }
    }

    // 줄기 꼭대기: 꽃이 있으면 꽃, 없으면 V자 새순 잎 두 장
    let topAt = plant.path[min(H, plant.path.length - 1)],
      topX = topAt.x,
      topY = topAt.y,
      topSh = sway(topY, t);
    if (flowerCount > 0) {
      slots.push({
        kind: "flower",
        x: topX + topSh + floor(thick / 2),
        y: topY - k,
        layer: "outer",
      });
    } else {
      if (!plant.tops[H]) {
        plant.tops[H] = [
          makeLeaf(
            "top-l",
            SMALL_LEAF,
            -1,
            topX - 1,
            topY,
            colors.leaf,
            -1,
            false,
          ),
          makeLeaf(
            "top-r",
            SMALL_LEAF,
            1,
            topX + thick,
            topY,
            colors.leaf,
            -1,
            false,
          ),
        ];
      }
      for (let leaf of plant.tops[H])
        slots.push({ kind: "leaf", leaf, sh: topSh, layer: "outer" });
    }

    // 화분: 가지 중간 잎으로 모자란 만큼 줄기에 붙은 안쪽 잎을 아래서부터 더 단다.
    if (opts.layered) {
      let need =
        innerMemos.length - slots.filter((s) => s.layer === "inner").length;
      for (let { h, y, leaf } of plant.inner) {
        if (need <= 0 || h > H - 2) break;
        slots.push({ kind: "leaf", leaf, sh: sway(y, t), layer: "inner" });
        need--;
      }
    }
  }

  // 아래 자리부터 오래된 메모를 하나씩 단다.
  let bottomUp = (a, b) => slotY(b) - slotY(a);
  let leafSlots = slots.filter((s) => s.kind === "leaf").sort(bottomUp);
  let assignMemos = (list, memoList) =>
    list.forEach((s, i) => (s.memo = memoList[i] || null));
  if (opts.memoFlowers)
    // 꽃 자리에는 자기보다 태그가 많은 메모
    assignMemos(
      slots.filter((s) => s.kind === "flower").sort(bottomUp),
      flowerMemos,
    );
  if (opts.layered) {
    // 화분: 바깥 잎에는 현재 세대 메모, 안쪽 잎에는 이전 세대 메모
    assignMemos(
      leafSlots.filter((s) => s.layer === "outer"),
      outerMemos,
    );
    assignMemos(
      leafSlots.filter((s) => s.layer === "inner"),
      innerMemos,
    );
  } else assignMemos(opts.memoFlowers ? leafSlots : slots, leafMemos);

  // 잎과 꽃은 줄기·가지 위에 덮이도록 나중에 그린다. 안쪽 잎을 먼저, 바깥 잎을 위에.
  for (let s of slots)
    if (s.kind === "leaf" && s.layer === "inner")
      drawLeaf(s.leaf, O, s.sh, s, opts);
  // 화분에서는 메모가 없는 바깥 잎은 그리지 않는다. (밝은 바깥 잎 = 현재 세대 메모)
  for (let s of slots)
    if (s.kind === "leaf" && s.layer !== "inner" && (s.memo || !opts.layered))
      drawLeaf(s.leaf, O, s.sh, s, opts);
  for (let f of fruits) drawFruit(traits.fruitType, f.x, f.y, colors, O);
  for (let s of slots)
    if (s.kind === "flower")
      drawFlower(
        traits.flowerType,
        s.x,
        s.y,
        colors,
        O,
        traits.flowerScale,
        s,
        opts,
      );
}

// 자리의 높이(칸): 잎은 아래 끝, 꽃은 가운데
function slotY(s) {
  return s.leaf ? s.leaf.maxY : s.y;
}

// 메모가 달린 자리의 색 바꾸기: 뿌리 필터에서 빠진 메모는 흐리게, 고른 메모는 깜빡이게
function slotLook(slot, opts) {
  if (!slot || !slot.memo) return keep;
  if (opts.filterGroups && !memoMatchesAll(slot.memo, opts.filterGroups))
    return fade;
  if (slot.memo.id === opts.selectedId && frameCount % 40 < 24) return glow;
  return keep;
}
function keep(col) {
  return col;
}
function fade(col) {
  return blendColor(col, BG, 0.75);
}
function glow(col) {
  return shade(col, 0.45);
}

// 잎 하나를 그린다. 뽑힌 잎은 잠시 숨겼다가 붙은 자리부터 다시 자라고,
// 잡고 있는 잎은 손을 따라 움직인다. 메모가 달린 다 자란 잎만 잡을 수 있게 zones에 등록한다.
function drawLeaf(leaf, O, sh, slot, opts) {
  let P = O.P;
  let grow = 1;
  if (opts.interactive && plucked[leaf.id] !== undefined) {
    grow = constrain(
      (millis() - plucked[leaf.id] - REGROW_DELAY) / REGROW_TIME,
      0,
      1,
    );
    if (grow <= 0) return;
    if (grow >= 1) delete plucked[leaf.id];
  }
  let dx = sh * P,
    dy = 0;
  if (opts.interactive && grabbed && grabbed.id === leaf.id) {
    dx += grabbed.ox;
    dy += grabbed.oy;
    // 거의 떨어질 때쯤 파르르 떨린다
    if (grabbed.tension > 0.6 && frameCount % 4 < 2) dx += P;
  }
  let look = slotLook(slot, opts);
  let limit = grow * (leaf.maxD + 1);
  for (let c of leaf.cells) {
    if (c.d >= limit) continue;
    fill(look(c.col));
    rect(O.x + c.x * P + dx, O.y + c.y * P + dy, P, P);
  }
  if (opts.interactive && slot.memo && grow >= 1)
    zones.leaves.push({ leaf, O, dx, dy, memo: slot.memo });
}

// 꽃 스프라이트를 (cx, cy) 칸을 중심으로 그린다. k배 크기면 한 칸을 k×k로 찍는다.
// 꽃 반지름(칸): 보통 3 (7×7), 크게 4 (9×9)
function flowerRadius(traits) {
  return traits.flowerScale === 2 ? 4 : 3;
}

// 꽃 스프라이트를 (cx, cy) 칸을 중심으로 그린다.
// 큰 꽃(scale 2)은 2배로 키우지 않고, 바깥 끝 꽃잎마다 한 칸씩 더 내밀어 9×9로 그린다.
function drawFlower(type, cx, cy, colors, O, scale, slot, opts) {
  let look = slotLook(slot, opts);
  let pal = {
    p: colors.flower,
    d: shade(colors.flower, -0.22),
    c: colors.center,
    w: PAPER,
  };
  for (let f of FLOWER_SPRITES[type]) {
    fill(look(pal[f.k]));
    cellAt(O, cx + f.x, cy + f.y);
    if (scale === 2 && (abs(f.x) === 3 || abs(f.y) === 3)) {
      fill(look(pal.d));
      cellAt(
        O,
        cx + f.x + (abs(f.x) === 3 ? Math.sign(f.x) : 0),
        cy + f.y + (abs(f.y) === 3 ? Math.sign(f.y) : 0),
      );
    }
  }
  if (opts.interactive && slot.memo) {
    let r = scale === 2 ? 4 : 3;
    zones.flowers.push({
      x0: O.x + (cx - r) * O.P,
      x1: O.x + (cx + r + 1) * O.P,
      y0: O.y + (cy - r) * O.P,
      y1: O.y + (cy + r + 1) * O.P,
      memo: slot.memo,
    });
  }
}

// 열매 스프라이트를 (ax, ay) 칸에 꼭지가 오도록 매단다.
function drawFruit(type, ax, ay, colors, O) {
  let sprite = FRUIT_SPRITES[type];
  let anchor = sprite[0].indexOf("s");
  let pal = {
    s: colors.stem,
    f: colors.fruit,
    d: shade(colors.fruit, -0.25),
    h: PAPER,
  };
  sprite.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      if (ch === ".") return;
      fill(pal[ch]);
      cellAt(O, ax + c - anchor, ay + r);
    }),
  );
}

// 메모가 없는 식물: 흙 위의 씨앗과 아주 작은 싹. 살짝 들썩인다.
function drawSeed(colors, O) {
  let bob = frameCount % 80 < 40 ? 0 : -1;
  fill(SEED);
  cellAt(O, 0, -1);
  cellAt(O, 1, -1);
  fill(colors.stem);
  cellAt(O, 0, -2 + bob);
  fill(colors.leaf);
  cellAt(O, 1, -3 + bob);
}

// ---------- 화분·화단 ----------

// 화분 높이(칸): 줄 수 + 다리
function potHeight(style) {
  let shape = POT_SHAPES[style.shape];
  return shape.rows.length + (shape.legs ? 2 : 0);
}

// 화분을 줄마다 반폭만큼 칸을 찍어서 그린다. 다리 달린 화분은 다리 두 개를 더한다.
function drawPotBody(style, O) {
  let shape = POT_SHAPES[style.shape],
    th = POT_THEMES[style.theme],
    rows = shape.rows;
  for (let r = 0; r < rows.length; r++) {
    let hw = rows[r];
    for (let x = -hw; x <= hw; x++) {
      fill(potColor(style.pattern, x, r, hw, rows.length, th));
      cellAt(O, x, r);
    }
  }
  if (shape.legs) {
    fill(th.dark);
    for (let r = rows.length; r < rows.length + 2; r++) {
      for (let x = 9; x <= 11; x++) {
        cellAt(O, x, r);
        cellAt(O, -x, r);
      }
    }
  }
}

// 화분 무늬: 칸 위치(x, r)에 따라 그 칸의 색을 정한다. 맨 윗줄은 테두리, 오른쪽은 그늘, 왼쪽은 밝게.
function potColor(pattern, x, r, hw, H, th) {
  if (r === 0) return th.dark;
  let mid = floor(H / 2),
    col = th.pot;
  let m6 = ((x % 6) + 6) % 6;
  if (pattern === 0 && r % 3 === 2) col = th.accent; // 가로 줄무늬
  if (pattern === 1 && r > 1 && r < H - 1 && (((x - r) % 4) + 4) % 4 === 0)
    col = th.accent; // 사선
  if (pattern === 2) {
    // 마름모 띠
    let band = abs(r - mid);
    let d = abs(((((x + 3) % 6) + 6) % 6) - 3) + band;
    if (band === 3) col = th.dark;
    else if (band <= 2 && d === 0) col = th.accent2;
    else if (band <= 2 && d <= 2) col = th.accent;
  }
  if (pattern === 3 && r >= H - 6 && r < H - 1) {
    // 톱니 삼각형
    if (((x % 5) + 5) % 5 <= r - (H - 6)) col = th.accent;
  }
  if (pattern === 4) {
    // 지그재그
    if (r === 2) col = th.accent2;
    if (r === mid - 1 + abs(m6 - 3)) col = th.accent;
  }
  let inside = r > 1 && r < H - 1;
  if (
    pattern === 5 &&
    inside &&
    r % 3 === 1 &&
    (((x + (r % 6 === 4 ? 3 : 0)) % 6) + 6) % 6 === 0
  )
    col = th.accent2; // 물방울 점
  if (pattern === 6 && inside && (floor((x + 30) / 3) + floor(r / 3)) % 2 === 0)
    col = th.accent; // 체크
  if (pattern === 7 && inside && ((x % 4) + 4) % 4 === 0) col = th.accent; // 세로 줄무늬
  if (pattern === 8) {
    // 가운데 띠 + 점
    if (abs(r - mid) <= 1) col = th.accent;
    if (r === mid && m6 === 0) col = th.accent2;
  }
  if (x === hw || r === H - 1) col = shade(col, -0.15);
  else if (x === -hw) col = shade(col, 0.12);
  return col;
}

// 화단에 심긴 1세대 식물 아래의 흙더미 (두 줄)
function drawMound(O) {
  fill(shade(GROUND, -0.2));
  for (let x = -3; x <= 4; x++) cellAt(O, x, 0);
  fill(shade(GROUND, -0.13));
  for (let x = -5; x <= 6; x++) cellAt(O, x, 1);
}

// 새 화분이 위에서 떨어져 선반에 앉는 동안의 높이(px)
function dropOffset(id, P) {
  if (!spawnAt.has(id)) return 0;
  let t = (millis() - spawnAt.get(id)) / 700;
  if (t >= 1) {
    spawnAt.delete(id);
    return 0;
  }
  return round(pow(1 - t, 2) * 30) * P;
}

// ---------- 이름표 ----------

// 픽셀식 둥근 이름표를 (cx, y)를 가운데 위로 해서 그리고 영역을 돌려준다.
// opts: size 글자 크기, bg 바탕, fg 글자, stage 성장 단계 점(0~4), count 오른쪽 숫자,
//       swatch 왼쪽 색 칸, maxW 최대 폭(넘치는 글자는 …), minX/maxX 화면 밖으로 안 나가게
function drawPlate(label, cx, y, opts = {}) {
  let size = opts.size || 12;
  let u = max(2, round(size / 5)); // 이름표의 픽셀 한 칸
  let bg = opts.bg || INK,
    fg = opts.fg || PAPER;
  textSize(size);
  let count = opts.count !== undefined ? String(opts.count) : "";
  let pad = 2 * u;
  let swW = opts.swatch ? 3 * u : 0;
  let dotsW = opts.stage !== undefined ? 2 * u + 9 * u : 0;
  let cW = count ? 2 * u + textWidth(count) : 0;
  let shown = fitText(label, (opts.maxW || 9999) - 2 * pad - swW - dotsW - cW);
  let tw = textWidth(shown);
  let w = ceil((2 * pad + swW + tw + dotsW + cW) / u) * u,
    h = ceil((size + 4 * u) / u) * u;
  let x = round(cx - w / 2);
  if (opts.minX !== undefined) x = max(x, opts.minX);
  if (opts.maxX !== undefined) x = min(x, opts.maxX - w);
  // 모서리 한 칸씩 깎은 픽셀식 둥근 사각형
  fill(bg);
  rect(x + u, y, w - 2 * u, h);
  rect(x, y + u, w, h - 2 * u);
  let px = x + pad;
  if (opts.swatch) {
    fill(opts.swatch);
    rect(px, y + h / 2 - u, 2 * u, 2 * u);
    px += swW;
  }
  fill(fg);
  textAlign(LEFT, CENTER);
  text(shown, px, y + h / 2);
  px += tw;
  if (dotsW) {
    // 성장 단계: 점 5개 중 지금 단계까지 채운다
    px += 2 * u;
    for (let i = 0; i < GROWTH_STAGES.length; i++) {
      fill(i <= opts.stage ? "#ffd400" : shade(bg, 0.25));
      rect(px + i * 2 * u, y + h / 2 - u / 2, u, u);
    }
    px += 9 * u;
  }
  if (count) {
    fill(shade(fg, -0.25));
    text(count, px + 2 * u, y + h / 2);
  }
  return { x0: x, x1: x + w, y0: y, y1: y + h };
}

// 폭을 넘으면 뒤를 잘라 …을 붙인다. (지금 textSize 기준)
function fitText(str, maxW) {
  if (textWidth(str) <= maxW) return str;
  let chars = [...str];
  while (chars.length && textWidth(chars.join("") + "…") > maxW) chars.pop();
  return chars.join("") + "…";
}

// 작은 안내 글자
function caption(str, x, y, size = 11, align = CENTER) {
  fill(MUTED);
  textSize(size);
  textAlign(align, TOP);
  text(str, x, y);
}

// ---------- 정원 (메인 화면) ----------

// 정원 배치: 흙 화단 하나에 식물과 화분이 자유롭게 심긴다.
// 자리는 칸 단위 x와 깊이 d(0 뒤쪽 ~ 1 앞쪽)로 저장해서 창 크기가 바뀌어도 배치가 그대로다.
function gardenLayout(area) {
  let w = area.x1 - area.x0,
    h = area.y1 - area.y0;
  // 좁은 화면(휴대폰)은 칸을 작게 해서 식물끼리 덜 겹치고 키 큰 식물도 머리가 안 잘리게
  let P = constrain(floor(min((h - 160) / 80, w / 160)), 2, 3);
  // 보이는 흙바닥의 윗선은 항상 화면 아래쪽 같은 위치에 둔다.
  let top = round(lerp(area.y0, area.y1, 0.26));
  let bottom = area.y1 - 44; // 화단 앞쪽: 이름표 자리를 남긴다
  let items = gardenItems();
  // 뒤쪽에 심은 키 큰 식물의 머리가 제목 위로 넘치면 칸을 한 단계 줄인다 (낮은 가로 화면)
  let headroom = (p) =>
    items.every((c) => {
      let d = c.gardenPos ? c.gardenPos.d : 0;
      return top + d * (bottom - top) - itemHeight(c) * p >= area.y0 - 12;
    });
  while (P > 2 && !headroom(P)) P--;
  // 가장 작은 칸으로도 넘치면 그때만 흙바닥 윗선을 조금 내린다
  while (!headroom(P) && top < bottom - 40) top += 4;
  let right = max(
    0,
    ...items.map((c) => (c.gardenPos ? c.gardenPos.x : 0)),
    ...[sack.pos, ...seeds].filter(Boolean).map((p) => p.x),
  );
  let maxScroll = max(0, (right + 20) * P - w);
  return { P, top, bottom, items, maxScroll };
}

// 정원에서 식물·화분이 땅 위로 차지하는 높이(칸): 화분(또는 흙더미) + 줄기 + 꽃
function itemHeight(c) {
  return plantCells(c, memosOf(c).length);
}

// 메모 count개만큼 자란 식물·화분이 땅 위로 차지하는 높이(칸): 화분(또는 흙더미) + 줄기 + 맨 위 꽃
function plantCells(c, count) {
  let rows = c.type === "pot" ? potHeight(c.potStyle) : 2;
  return (
    rows + (count ? stemHeight(count) + flowerRadius(c.geneticTraits) + 3 : 4)
  );
}

function gardenItems() {
  return activeContainers().sort(byCreated);
}

// 심은 자리의 화면 좌표 (x 가운데, y 땅에 닿는 선)
function gardenPoint(c, G, area) {
  return pointAt(c.gardenPos, G, area);
}

// 아직 자리가 없는 식물·화분을 심는다. (새로 생긴 것, 예전 데이터)
function placeMissing(G, area) {
  for (let c of G.items) {
    if (c.gardenPos) continue;
    placeInGarden(c, G, area, placeHints.get(c.id));
    placeHints.delete(c.id);
  }
}

// 빈자리를 골라 심는다: 후보 자리를 여러 개 뽑아 이웃과 가장 먼 곳을 고른다.
// near가 있으면(끌어다 놓아 교배한 화분) 부모 사이 근처에서 고르고, 자리가 모자라면 화단을 오른쪽으로 넓힌다.
function placeInGarden(c, G, area, near) {
  let depthCells = (G.bottom - G.top) / G.P;
  let others = G.items
    .filter((o) => o.gardenPos && o.id !== c.id)
    .map((o) => o.gardenPos);
  if (sack.pos) others.push(sack.pos); // 씨앗 포대 자리도 비워 둔다
  let span = max(40, (area.x1 - area.x0) / G.P - 30); // 지금 화면에 보이는 화단 폭(칸)
  let best = null;
  for (
    let tries = 0;
    tries < 6 && (!best || best.score < GARDEN_GAP);
    tries++
  ) {
    for (let i = 0; i < 40; i++) {
      let pos = near
        ? {
            x: max(15, near.x + random(-40, 40)),
            d: constrain(near.d + random(-0.35, 0.35), 0, 1),
          }
        : { x: 15 + random(span), d: random() };
      let score = min(
        GARDEN_GAP * 3,
        ...others.map((o) =>
          dist(pos.x, pos.d * depthCells, o.x, o.d * depthCells),
        ),
      );
      if (!best || score > best.score) best = { pos, score };
    }
    // 못 찾으면 화단을 넓혀서 다시
    span += GARDEN_GAP;
    near = null;
  }
  setGardenPos(c.id, best.pos);
}

// 정원 전체: 흙 화단에 뒤쪽부터 앞쪽 순서로 심은 것들을 그린다. 끌고 있는 것은 맨 위에.
function drawGarden(area) {
  let G = gardenLayout(area);
  placeMissing(G, area);
  // 끌고 있는 것이 화면 끝에 가까우면 정원을 그쪽으로 넘긴다
  if (dragging || carry) {
    if (mouseX < area.x0 + 40) gardenScroll -= 8;
    if (mouseX > area.x1 - 40) gardenScroll += 8;
  }
  gardenScroll = constrain(
    gardenScroll,
    0,
    G.maxScroll + (dragging || carry ? 300 : 0),
  );
  let P = G.P;
  drawSoil(G.top - 8 * P, height, area.x0 - gardenScroll, P);
  if (!G.items.length)
    caption(
      "씨앗 포대를 들고 흔들어 첫 씨앗을 꺼내 보세요",
      (area.x0 + area.x1) / 2,
      (G.top + G.bottom) / 2,
      14,
    );

  let target = dragging && dropTarget(prevZones.items, dragIds(dragging));
  // 끌고 있는 자식에 끈으로 이어진 부모·조상을 끈 길이에 맞춰 끌어온다. (자식 → 부모 → 조부모 순서)
  let lifted = null,
    moved = new Map(); // id → 지금 화면 위치
  if (dragging) {
    lifted = { x: round(mouseX + dragging.dx), y: round(mouseY + dragging.dy) };
    moved.set(dragging.id, lifted);
    for (let f of dragging.followers) {
      let home = gardenPoint(getContainer(f.id), G, area);
      pullFollower(f, home, moved.get(f.from));
      moved.set(f.id, { x: round(home.x + f.ox), y: round(home.y + f.oy) });
    }
  }
  // 앞쪽(땅에 닿는 선이 아래)일수록 나중에 그려서 위에 덮이게
  let placed = G.items
    .filter((c) => c.gardenPos && !(dragging && dragging.id === c.id))
    .map((c) => ({ c, at: moved.get(c.id) || gardenPoint(c, G, area) }))
    .sort((a, b) => a.at.y - b.at.y);
  // 흙 위의 끈(뿌리): 식물보다 먼저 그려서 아래로 지나가게
  if (dragging)
    for (let f of dragging.followers) {
      let a = moved.get(f.from),
        b = moved.get(f.id);
      ropeLink(a.x, a.y + 2 * P, b.x, b.y + 2 * P, f.rest, P);
    }
  // 포대와 씨앗도 식물과 함께 앞뒤 순서대로 그린다. 들고 있는 것은 맨 위에.
  let K = sackLayout(area, G);
  updateSack(K);
  updateSeeds(K);
  let carrying = (kind, id) =>
    carry && carry.kind === kind && (!id || carry.id === id);
  let seedOverSack =
    carrying("seed") &&
    zoneAt(
      prevZones.ui.filter((z) => z.id === "sack"),
      mouseX,
      mouseY,
    );
  let scene = placed.map(({ c, at }) => ({
    y: at.y,
    draw: () =>
      drawGardenItem(
        c,
        at.x,
        at.y,
        G,
        area,
        target && target.id === c.id ? "target" : "",
      ),
  }));
  if (!carrying("sack"))
    scene.push({ y: K.y, draw: () => drawSack(K, seedOverSack) });
  for (let s of seeds)
    if (!carrying("seed", s.id) && !s.back)
      scene.push({
        y: pointAt(s, G, area).y,
        draw: () => drawSeedDrop(s, G, area, K),
      });
  scene.sort((a, b) => a.y - b.y).forEach((o) => o.draw());
  if (dragging)
    drawGardenItem(
      getContainer(dragging.id),
      lifted.x,
      lifted.y,
      G,
      area,
      "lifted",
    );
  if (carrying("sack")) drawSack(K, false);
  for (let s of seeds)
    if (carrying("seed", s.id) || s.back) drawSeedDrop(s, G, area, K);
}

// ---------- 씨앗 포대 ----------
// 포대와 씨앗도 식물처럼 흙 위의 자리(칸 x, 깊이 d)에 놓인다. 끌어서 옮길 수 있다.

// 씨앗 포대의 크기와 지금 화면 위치. x 가운데, y 바닥, S 칸 크기, pos 흙 위의 자리
function sackLayout(area, G) {
  let S = G.P * 2;
  let w = SACK[0].length * S,
    h = SACK.length * S;
  if (!sack.pos) sack.pos = { x: round(16 / G.P + SACK.length), d: 0 };
  let carried = carry && carry.kind === "sack";
  let at = carried
    ? { x: round(mouseX + carry.dx), y: round(mouseY + carry.dy) }
    : pointAt(sack.pos, G, area);
  let pos = carried ? posAt(at.x, at.y, G, area) : sack.pos;
  return {
    x: at.x,
    y: at.y,
    pos,
    S,
    w,
    h,
    mouth: { x: at.x + sackLean(0, sack.a) * S, y: at.y - h },
  };
}

// 흙 위의 자리 → 화면 좌표
function pointAt(pos, G, area) {
  return {
    x: round(area.x0 + pos.x * G.P - gardenScroll),
    y: round(G.top + pos.d * (G.bottom - G.top)),
  };
}

// 화면 좌표 → 흙 위의 자리 (화단 밖이면 가장자리로)
function posAt(x, y, G, area) {
  return {
    x: max(5, (x - area.x0 + gardenScroll) / G.P),
    d: constrain((y - G.top) / (G.bottom - G.top), 0, 1),
  };
}

// 줄 r(위에서부터)이 기울기 a만큼 옆으로 밀리는 칸 수: 바닥은 그대로, 위로 갈수록 많이
function sackLean(r, a) {
  return round(tan(a) * (SACK.length - 1 - r) * 0.9);
}

// 씨앗 포대: 픽셀이 깨지지 않게 줄마다 옆으로 밀어서 기울인다.
// open이면 씨앗을 넣을 수 있다는 표시로 입구 테두리가 강조된다.
function drawSack(K, open) {
  let O = { x: K.x - K.w / 2, y: K.y - K.h, P: K.S };
  let hold = carry && carry.kind === "sack";
  let over =
    !dragging &&
    !carry &&
    zoneUnderMouse(prevZones.ui.filter((z) => z.id === "sack"));
  let pal = {
    o: shade(SEED, -0.35),
    b: over || hold ? "#d9b27a" : "#cfa56c",
    d: "#b08550",
    f: open ? ACCENT : "#e2c48f",
    s: SEED,
    l: PAPER,
  };
  // 바닥 그림자 (들고 있으면 조금 떨어져 보이게)
  fill(shade(GROUND, -0.1));
  rect(O.x + K.S, K.y + (hold ? 3 * K.S : 0), K.w - 2 * K.S, K.S);
  SACK.forEach((row, r) => {
    let off = sackLean(r, sack.a);
    [...row].forEach((ch, c) => {
      if (ch === ".") return;
      fill(pal[ch]);
      cellAt(O, c + off, r);
    });
  });
  // 이름표 글씨
  fill(INK);
  textSize(K.S * 2.2);
  textAlign(CENTER, CENTER);
  text("씨앗", K.x + sackLean(9, sack.a) * K.S, O.y + 9.5 * K.S);
  let lean = sackLean(0, sack.a) * K.S;
  zones.ui.push({
    id: "sack",
    x0: O.x + min(0, lean) - K.S,
    x1: O.x + K.w + max(0, lean) + K.S,
    y0: O.y,
    y1: K.y,
  });
}

// 포대 흔들림: 들고 다니면 움직이는 방향으로 기울고(손이 빠를수록 많이), 놓으면 용수철처럼 바로 선다.
// 들고 있는 동안 방향이 크게 바뀔 때마다 한 번 흔든 것으로 센다.
function updateSack(K) {
  let a = sack.a,
    target = 0;
  if (carry && carry.kind === "sack") {
    carry.vx = lerp(carry.vx, mouseX - carry.lastX, 0.35);
    carry.lastX = mouseX;
    target = constrain(carry.vx * 0.06, -SACK_TILT, SACK_TILT);
  }
  sack.va = (sack.va + (target - sack.a) * 0.2) * 0.8;
  sack.a += sack.va;
  let dir = sack.va > 0.004 ? 1 : sack.va < -0.004 ? -1 : 0;
  if (dir && dir !== sack.dir) {
    if (carry && carry.kind === "sack" && abs(a - sack.turnA) > 0.25)
      shakeSack(K);
    sack.turnA = a;
    sack.dir = dir;
  }
}

// 한 번 흔들었다: 입구에서 겨가 조금 날리고, 정해진 만큼 흔들면 씨앗이 하나 튀어나온다.
function shakeSack(K) {
  let now = millis();
  sack.shakes = now - sack.lastShake > 1500 ? 1 : sack.shakes + 1;
  sack.lastShake = now;
  for (let i = 0; i < 3; i++)
    sparks.push({
      x: K.mouth.x + random(-3, 3) * K.S,
      y: K.mouth.y,
      gx: 0,
      vx: random(-1.5, 1.5) + sack.va * 20,
      vy: -random(1.5, 3.5),
      life: 18,
      col: random() < 0.5 ? "#e2c48f" : SEED,
      P: max(2, K.S - 2),
    });
  if (sack.shakes < SACK_SHAKES) return;
  sack.shakes = 0;
  // 씨앗은 포대 앞쪽 흙으로 튀어 떨어진다. 포대가 기운 쪽으로 (똑바로면 아무 쪽으로)
  let area = viewArea(),
    G = gardenLayout(area);
  let ahead = random(0.04, 0.14);
  let side = sack.a > 0.05 ? 1 : sack.a < -0.05 ? -1 : random() < 0.5 ? -1 : 1;
  seeds.push({
    id: uid("seed"),
    x: (K.mouth.x - area.x0 + gardenScroll) / G.P,
    d: min(1, K.pos.d + ahead),
    z: K.h + ahead * (G.bottom - G.top), // 땅에서의 높이(px): 포대 입구에서 시작
    vx: side * random(0.5, 0.9), // 칸/프레임
    vz: random(4, 6), // px/프레임 (위로 +)
    landed: false,
  });
}

// 씨앗 움직임: 튀어 올랐다 흙에 몇 번 튀고 멈춘다. 포대에 넣은 씨앗은 입구로 날아 들어간다.
function updateSeeds(K) {
  for (let i = seeds.length - 1; i >= 0; i--) {
    let s = seeds[i];
    if (s.back) {
      s.back.t += 0.07;
      if (s.back.t >= 1) {
        seeds.splice(i, 1);
        sack.va += 0.05;
        saveShed();
      }
      continue;
    }
    if (s.landed) continue;
    s.vz -= 0.45;
    s.z += s.vz;
    s.x = max(5, s.x + s.vx);
    if (s.z > 0) continue;
    s.z = 0;
    if (s.vz < -2.5) {
      s.vz *= -0.4;
      s.vx *= 0.55;
    } else {
      s.landed = true;
      saveShed();
    }
  }
}

// 씨앗 하나 (3×2칸) + 그림자 + 반짝임. 멈춘 씨앗은 누르거나 끌 수 있다.
function drawSeedDrop(s, G, area, K) {
  let S = G.P + 2;
  let held = carry && carry.kind === "seed" && carry.id === s.id;
  let ground = pointAt(s, G, area),
    x,
    y,
    shadowY = ground.y;
  if (held) {
    x = mouseX + carry.dx;
    y = mouseY + carry.dy - 3 * S;
    shadowY = y + 3 * S;
  } else if (s.back) {
    // 포대 입구로 포물선을 그리며 날아 들어간다
    let t = s.back.t;
    x = lerp(s.back.x, K.mouth.x, t);
    y = lerp(s.back.y, K.mouth.y + S, t) - sin(t * PI) * 40;
  } else {
    x = ground.x;
    y = ground.y - s.z;
  }
  x = round(x / S) * S;
  y = round(y / S) * S;
  let over =
    s.landed &&
    !held &&
    !carry &&
    !dragging &&
    zoneUnderMouse(prevZones.ui.filter((z) => z.seed === s.id));
  if (!s.back) {
    fill(shade(GROUND, -0.12));
    rect(x - S, round(shadowY / S) * S + S, S * 3, S);
  }
  if (over || held) {
    fill(ACCENT);
    rect(x - 2 * S, y - 2 * S, S * 5, S * 4);
  }
  fill(SEED);
  rect(x - S, y - S, S * 3, S * 2);
  fill(shade(SEED, 0.35));
  rect(x - S, y - S, S, S);
  if (s.landed && !held && (frameCount + s.x * 7) % 90 < 12) {
    fill(PAPER);
    rect(x + 2 * S, y - 3 * S, S, S);
  }
  if (over)
    caption(
      "누르면 태그 만들기 · 포대에 넣으면 버리기",
      x + S / 2,
      y + 3 * S + 4,
      11,
    );
  if (s.landed && !held && !s.back)
    zones.ui.push({
      id: "seed",
      seed: s.id,
      x0: x - 4 * S,
      x1: x + 5 * S,
      y0: y - 4 * S,
      y1: y + 4 * S,
    });
}

// 정원에서 자식을 끌 때 자식과 부모를 잇는 끈(뿌리)을 s px 칸으로 그린다.
// 끈 길이(rest)보다 가까우면 남는 만큼 아래로 처지고, 다 펴지면 곧고 짙게 당겨진다.
function ropeLink(x1, y1, x2, y2, rest, s) {
  let len = dist(x1, y1, x2, y2);
  let sag = len < rest ? min(90, sqrt(rest * rest - len * len) * 0.5) : 0;
  let n = ceil((max(len, sag * 2) / s) * 1.5) + 1;
  fill(len >= rest - 2 ? shade(ROOT, -0.25) : ROOT);
  for (let i = 0; i <= n; i++) {
    let t = i / n;
    let x = x1 + (x2 - x1) * t,
      y = y1 + (y2 - y1) * t + sag * 4 * t * (1 - t);
    rect(floor(x / s) * s, floor(y / s) * s, s, s);
  }
}

// 정원의 식물·화분 하나: 그림자, 식물(흙더미 또는 화분), 이름표. 화분은 세대·태그 한 줄을 더한다.
// mode: "lifted" 끌고 있는 것(살짝 떠 있다) / "target" 놓으면 교배할 상대
function drawGardenItem(c, x, groundY, G, area, mode = "") {
  let P = G.P;
  if (x + 20 * P < area.x0 || x - 20 * P > area.x1) return; // 화면 밖은 그리지 않는다
  let count = memosOf(c).length;
  let isPot = c.type === "pot";
  let rows = isPot ? potHeight(c.potStyle) : 2;
  let lift = mode === "lifted" ? 3 * P : 0;
  let O = {
    x,
    y: groundY - rows * P - lift - (isPot ? dropOffset(c.id, P) : 0),
    P,
  };
  let zone = {
    x0: x - 16 * P,
    x1: x + 17 * P,
    y0: groundY - itemHeight(c) * P,
    y1: groundY + (isPot ? 40 : 28),
    id: c.id,
  };
  let hover = !dragging && zoneUnderMouse(prevZones.items)?.id === c.id;

  fill(shade(GROUND, -0.12)); // 그림자
  if (isPot) rect(x - 11 * P, groundY, 23 * P, P);
  else rect(x - 6 * P, groundY, 13 * P, P);
  drawPlant(c, O, {
    count,
    key: c.id,
    memos: memosOf(c),
    memoFlowers: true,
    layered: isPot,
  });
  if (isPot) drawPotBody(c.potStyle, O);
  else drawMound(O);
  zones.items.push(zone);
  if (mode === "lifted") return; // 끌고 있는 것은 이름표 없이 (놓을 상대의 이름표가 보이게)

  let ly = groundY + P + 4;
  drawPlate(mode === "target" ? "+ 여기에 교배" : c.name, x + P / 2, ly, {
    size: 11,
    count: mode === "target" ? undefined : count,
    maxW: GARDEN_LABEL * P,
    bg: mode === "target" ? "#1f7a3a" : hover ? ACCENT : INK,
  });
}

// ---------- 상세 화면 ----------

// 상세 화면: 위 잎·꽃(메모), 가운데 줄기와 성장 이름표, 아래 뿌리(부모 → 조상 계보)
function drawDetail(area) {
  let c = current();
  if (!c) return;
  let memos = memosOf(c),
    count = memos.length;
  let isPot = c.type === "pot";
  let rows = isPot ? potHeight(c.potStyle) : 2;
  let levels = isPot ? rootLevels(c, area.x1 - area.x0) : 0;
  // 칸 크기는 늘 같은 기준으로 정해서 잎·꽃 크기를 지키고, 크게 자란 식물이 넘칠 때만 줄인다.
  let avail = area.y1 - area.y0 - max(0, levels - 1) * ROOT_ROW;
  let tall = plantCells(c, count);
  // 바닥선은 식물·화분의 높이와 무관하게 화면 아래쪽에 고정한다.
  // 줄기가 긴 경우에는 위쪽 영역 안에 들어오도록 칸 크기만 줄인다.
  let groundY = round(lerp(area.y0, area.y1, 0.76));
  let P = max(
    2,
    floor(
      min(
        8,
        (area.x1 - area.x0) / 46,
        avail / (LAYOUT_CELLS + rows + 26),
        avail / (tall + 26),
        (groundY - area.y0 - 8) / tall,
      ),
    ),
  );
  let ox = round((area.x0 + area.x1) / 2 - P / 2);
  // 뿌리(조상 이름표)가 화면 아래로 넘치면 세로로 넘겨 볼 수 있게 한다.
  let rootDepth = isPot ? 15 * P + (levels - 1) * ROOT_ROW + 64 : 8 * P + 48;
  let maxScroll = max(0, groundY + rootDepth - area.y1);
  detailScroll = constrain(detailScroll, 0, maxScroll);
  groundY -= round(detailScroll);
  // 아래에 더 볼 뿌리가 남아 있으면 맨 아래 한 줄을 안내 문구 자리로 비운다
  let more = detailScroll < maxScroll - 2;
  let clipBottom = area.y1 - (more ? 28 : 0);
  detailGround = { y: groundY, P };
  drawSoil(groundY, height - groundY, ox, P);
  // 식물·뿌리는 제목 아래부터 버튼 줄(또는 안내 문구) 위까지만 보이게
  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.rect(0, area.y0 - 12, width, clipBottom - area.y0 + 12);
  drawingContext.clip();
  drawRoots(c, ox, groundY, P, area, levels);

  let O = { x: ox, y: groundY - rows * P, P };
  let groups = filterGroups();
  drawPlant(c, O, {
    count,
    memos,
    memoFlowers: true,
    layered: isPot,
    key: c.id,
    filterGroups: groups.length ? groups : null,
    selectedId: selectedMemoId,
    interactive: true,
  });
  if (isPot) drawPotBody(c.potStyle, O);
  else drawMound(O);
  // 화분(흙더미)도 누르면 메모를 쓴다
  let hw = isPot ? max(...POT_SHAPES[c.potStyle.shape].rows) : 6;
  zones.body.push({
    O,
    x0: O.x - hw * P,
    x1: O.x + (hw + 1) * P,
    y0: O.y,
    y1: groundY,
  });

  // 성장 이름표: 단계 이름, 단계 점, 메모 개수
  let stage = growthStage(count);
  drawPlate(GROWTH_STAGES[stage].name, ox + P / 2, groundY + 2 * P, {
    size: constrain(P * 2, 12, 15),
    stage,
    count: `메모 ${count}`,
  });
  drawingContext.restore();
  if (more) caption("▾ 아래로 넘겨 뿌리 보기", (area.x0 + area.x1) / 2, clipBottom + 8, 11);
}

// 뿌리를 몇 단(부모 = 1단, 조부모 = 2단 …)까지 펼칠지: 실제 계보 깊이, 화면 폭, 최대 3단
function rootLevels(c, w) {
  return max(1, min(c.generation - 1, floor(Math.log2(w / 70)), 3));
}

// 뿌리: 원뿌리에서 구불구불한 두 갈래로 뻗어 끝마다 부모의 태그 묶음 이름표를 달고,
// 그 아래로 조상 묶음을 잇는다. 1세대 식물은 부모가 없어서 짧은 계단 뿌리만 그린다.
function drawRoots(c, ox, groundY, P, area, levels) {
  let O = { x: ox, y: groundY, P };
  let isPot = c.type === "pot";
  let w = area.x1 - area.x0;
  let thick = c.geneticTraits.stemThickness;
  let reach = isPot ? 14 : 8; // 뿌리 깊이(칸)
  let spread = isPot ? max(6, floor(w / 4 / P)) : 5; // 좌우로 뻗는 폭(칸)
  let rand = mulberry32(c.seed + 7);
  fill(ROOT);
  for (let y = 0; y < 4; y++) stemCell(O, 0, y, thick);
  if (isPot) {
    // 원뿌리 끝에서 부모 이름표까지 구불구불한 뿌리 두 갈래
    let hoverId = zoneUnderMouse(prevZones.roots)?.id;
    c.parentIds.forEach((id, i) => {
      let side = i ? 1 : -1;
      let ex = ox + side * spread * P;
      wildRoot(
        ox,
        groundY + 3 * P,
        ex,
        groundY + (reach + 1) * P,
        P,
        c.seed + i * 131,
      );
      drawRootNode(
        id,
        ex + P / 2,
        groundY + (reach + 1) * P,
        w / 2,
        1,
        levels,
        area,
        P,
        hoverId,
      );
    });
    return;
  }
  for (let side of [-1, 1]) {
    let x = side > 0 ? thick - 1 : 0,
      y = 3,
      hairs = [];
    // 남은 깊이에 맞춰 한 줄 내려갈 때마다 옆으로 몇 칸씩 뻗는다
    while (y < reach) {
      let steps = ceil((spread - abs(x)) / (reach - y));
      for (let k = 0; k < steps; k++) {
        x += side;
        cellAt(O, x, y);
      }
      y++;
      cellAt(O, x, y);
      if (rand() < 0.3) hairs.push({ x: x - side, y: y + 1 });
    }
    // 잔뿌리
    fill(shade(ROOT, -0.18));
    for (let hair of hairs) cellAt(O, hair.x, hair.y);
    fill(ROOT);
  }
  caption(
    "1세대 식물 · 부모가 없는 첫 뿌리",
    ox + P / 2,
    groundY + (reach + 2) * P,
    12,
  );
}

// 뿌리 이름표 하나: [학교 + 아침]처럼 태그 묶음을 나누지 않고 하나로 단다.
// 펼칠 단이 남았으면 그 묶음의 부모 둘을 아래에 이어 단다. 켠 뿌리는 강조색.
function drawRootNode(id, x, y, slotW, level, levels, area, P, hoverId) {
  let p = getContainer(id);
  let zone = drawPlate(p ? groupLabel(p) : "[사라진 부모]", x, y, {
    size: level === 1 ? constrain(P * 2, 12, 15) : 12,
    bg: rootFilters.includes(id)
      ? ACCENT
      : hoverId === id
        ? shade(INK, 0.2)
        : INK,
    maxW: slotW - 8,
    minX: area.x0 + 4,
    maxX: area.x1 - 4,
  });
  zones.roots.push({ ...zone, id });
  if (!p) return;
  let cx = round((zone.x0 + zone.x1) / 2);
  caption(
    `${p.generation}세대 ${p.type === "plant" ? "식물" : "화분"}${p.archived ? " · 보관됨" : ""}`,
    cx,
    zone.y1 + 3,
    10,
  );
  if (!p.parentIds.length) return;
  if (level >= levels) return caption("⋯", cx, zone.y1 + 16, 12);
  p.parentIds.forEach((parentId, i) => {
    let px = round(x + ((i ? 1 : -1) * slotW) / 4);
    wildRoot(
      cx,
      zone.y1 + 15,
      px,
      y + ROOT_ROW,
      max(2, round(P * 0.6)),
      p.seed + i * 977,
    );
    drawRootNode(
      parentId,
      px,
      y + ROOT_ROW,
      slotW / 2,
      level + 1,
      levels,
      area,
      P,
      hoverId,
    );
  });
}

// (x1, y1)에서 (x2, y2)까지 s px 칸으로 구불구불한 뿌리를 그린다.
// 몇 칸 곧게 내려가다 갈라져(뿌리마다 갈라지는 높이가 다르다) 옆으로 휘는 S자 길에,
// 씨앗값마다 다른 물결을 얹는다. 옆으로 멀리 뻗을수록 물결도 크다.
// 시작 쪽은 굵게, 군데군데 잔뿌리를 단다. 같은 seed면 매 프레임 같은 모양.
function wildRoot(x1, y1, x2, y2, s, seed) {
  let rand = mulberry32(seed);
  let sx = 0,
    sy = 0,
    tx = round((x2 - x1) / s),
    rows = max(1, round((y2 - y1) / s));
  let drop = min(rows - 1, 1 + floor(rand() * 5)); // 갈라지기 전 곧게 내려가는 줄 수
  let phase = rand() * TWO_PI,
    wave = 1 + rand() * 2 + abs(tx - sx) * (0.08 + rand() * 0.1), // 물결 크기(칸)
    freq = 0.35 + rand() * 0.6; // 물결 촘촘함
  let cells = [],
    x = sx;
  for (let r = 0; r <= rows; r++) {
    let t = r <= drop ? 0 : (r - drop) / (rows - drop);
    let ease = t * t * (3 - 2 * t);
    let bend = sin(phase + r * freq) * wave * sin(PI * t); // 양 끝에서는 0
    let want = round(sx + (tx - sx) * ease + bend);
    while (x !== want) {
      x += Math.sign(want - x);
      cells.push({ x, y: sy + r, t });
    }
    cells.push({ x, y: sy + r, t });
  }
  let hairs = [];
  fill(ROOT);
  for (let c of cells) {
    rect(x1 + c.x * s, y1 + c.y * s, s, s);
    // 갈라지기 전과 시작 쪽 40%는 한 칸 더 굵게
    if (c.t < 0.4) rect(x1 + (c.x + 1) * s, y1 + c.y * s, s, s);
    if (c.t > 0.15 && c.t < 0.85 && rand() < 0.1) {
      let side = rand() < 0.5 ? -1 : 1;
      hairs.push({ x: c.x + side, y: c.y + 1 });
      if (rand() < 0.5) hairs.push({ x: c.x + 2 * side, y: c.y + 2 });
    }
  }
  fill(shade(ROOT, -0.18));
  for (let h of hairs) rect(x1 + h.x * s, y1 + h.y * s, s, s);
}

// ---------- 도감 ----------

// 도감: 모든 식물·화분을 세대별로 묶어 카드로 늘어놓는다. 위아래로 넘겨 본다.
function drawBook(area) {
  let w = area.x1 - area.x0;
  let cols = max(1, floor((w - 32 + BOOK_GAP) / (BOOK_CARD_W + BOOK_GAP)));
  let cardW = min(260, floor((w - 32 - (cols - 1) * BOOK_GAP) / cols));
  let x0 = round(area.x0 + (w - cols * cardW - (cols - 1) * BOOK_GAP) / 2);
  let entries = db.containers
    .slice()
    .sort((a, b) => a.generation - b.generation || byCreated(a, b));
  if (!entries.length)
    return caption(
      "아직 도감이 비어 있어요. 씨앗 포대에서 씨앗을 꺼내 심어 보세요",
      (area.x0 + area.x1) / 2,
      (area.y0 + area.y1) / 2,
      14,
    );
  // 넘긴 만큼 그리되, 제목·버튼 줄 밑으로는 그리지 않는다
  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.rect(area.x0, area.y0, w, area.y1 - area.y0);
  drawingContext.clip();
  let y = area.y0 + 4 - bookScroll;
  for (let gen of unique(entries.map((c) => c.generation))) {
    let list = entries.filter((c) => c.generation === gen);
    fill(INK);
    textSize(14);
    textAlign(LEFT, TOP);
    text(`${gen}세대 ${gen === 1 ? "식물" : "화분"} · ${list.length}`, x0, y);
    fill(shade(GROUND, -0.15));
    rect(x0, y + 22, cols * cardW + (cols - 1) * BOOK_GAP, 3);
    y += 36;
    list.forEach((c, i) =>
      drawBookCard(
        c,
        x0 + (i % cols) * (cardW + BOOK_GAP),
        y + floor(i / cols) * (BOOK_CARD_H + BOOK_GAP),
        cardW,
        area,
      ),
    );
    y += ceil(list.length / cols) * (BOOK_CARD_H + BOOK_GAP) + 10;
  }
  drawingContext.restore();
  // 끝까지 넘기면 더 넘어가지 않게
  bookScroll = constrain(bookScroll, 0, max(0, y + bookScroll - area.y1));
}

// 도감 카드 하나: 식물 모습(화분 없이), 이름, 잎·꽃 수, 계보(부모 → 조상)
function drawBookCard(c, x, y, w, area) {
  let h = BOOK_CARD_H;
  if (y > area.y1 || y + h < area.y0) return;
  let hover = !press && zoneUnderMouse(prevZones.cards)?.id === c.id;
  let u = 3;
  // 종이 카드: 모서리를 한 칸씩 깎은 픽셀 사각형 + 그림자
  let box = (dx, dy, col) => {
    fill(col);
    rect(x + dx + u, y + dy, w - 2 * u, h);
    rect(x + dx, y + dy + u, w, h - 2 * u);
  };
  box(u, u, shade(GROUND, -0.12));
  box(0, 0, hover ? ACCENT : shade(GROUND, -0.3));
  fill(c.archived ? shade(PAPER, -0.04) : PAPER);
  rect(x + u, y + u, w - 2 * u, h - 2 * u);

  // 식물 모습: 카드 위쪽 칸에 맞는 크기로 (화분·흙더미 없이 흙 한 줄만)
  let memos = memosOf(c),
    count = memos.length;
  let plantH = 168;
  let tall = count ? stemHeight(count) + flowerRadius(c.geneticTraits) + 3 : 5;
  let P = constrain(floor(min(plantH / (tall + 2), (w - 24) / 44)), 1, 4);
  let groundY = y + 14 + plantH;
  fill(GROUND);
  rect(x + 3 * u, groundY, w - 6 * u, 2 * u);
  drawPlant(
    c,
    { x: round(x + w / 2 - P / 2), y: groundY, P },
    {
      count,
      key: "book-" + c.id,
      memos,
      memoFlowers: true,
      layered: c.type === "pot",
    },
  );

  // 이름과 잎·꽃 수
  let ty = groundY + 2 * u + 10;
  let plate = drawPlate(
    c.name + (c.archived ? " (보관됨)" : ""),
    x + w / 2,
    ty,
    {
      size: 12,
      swatch: c.geneticTraits.primaryColor,
      bg: hover ? ACCENT : INK,
      maxW: w - 16,
    },
  );
  let flowers = memos.filter((m) => hasMoreTags(c, m)).length;
  fill(INK);
  textSize(12);
  textAlign(CENTER, TOP);
  text(`잎 ${count - flowers} · 꽃 ${flowers}`, x + w / 2, plate.y1 + 7);

  // 계보: 부모 묶음, 그 아래로 조상 묶음을 한 줄씩 들여 쓴다
  let ly = plate.y1 + 30;
  fill(shade(GROUND, -0.15));
  rect(x + 3 * u, ly, w - 6 * u, 2);
  caption("계보", x + 4 * u, ly + 6, 10, LEFT);
  let lines = [];
  let level = [c];
  for (let depth = 0; depth < 4; depth++) {
    let parents = unique(level.flatMap((k) => k.parentIds))
      .map(getContainer)
      .filter(Boolean);
    if (!parents.length) break;
    lines.push(
      (depth ? " ".repeat(depth - 1) + "└ " : "") +
        parents.map(groupLabel).join(" × "),
    );
    level = parents;
  }
  if (!lines.length) lines.push("처음 심은 식물 · 부모 없음");
  textSize(11);
  lines.forEach((line, i) => {
    fill(i ? MUTED : INK);
    textAlign(LEFT, TOP);
    text(fitText(line, w - 8 * u), x + 4 * u, ly + 22 + i * 16);
  });
  zones.cards.push({
    x0: x,
    x1: x + w,
    y0: max(y, area.y0),
    y1: min(y + h, area.y1),
    id: c.id,
  });
}

// ---------- 미리보기 (태그 만들기·교배) ----------

// 미리보기 식물 c를 area 가운데에 다 자란 모습으로 그린다.
function drawPreview(c, area, label) {
  let rows = c.type === "pot" ? potHeight(c.potStyle) : 2;
  let avail = area.y1 - area.y0 - 50,
    tall = plantCells(c, PREVIEW_COUNT);
  let P = max(
    2,
    floor(
      min(
        7,
        (area.x1 - area.x0) / 46,
        avail / (LAYOUT_CELLS + rows),
        avail / tall,
      ),
    ),
  );
  let ox = round((area.x0 + area.x1) / 2 - P / 2);
  let groundY = area.y0 + max(LAYOUT_CELLS + rows, tall) * P;
  drawSoil(groundY, height - groundY, ox, P);
  let O = { x: ox, y: groundY - rows * P, P };
  drawPlant(c, O, { count: PREVIEW_COUNT, key: c.id });
  if (c.type === "pot") drawPotBody(c.potStyle, O);
  else drawMound(O);
  drawPlate(label, ox + P / 2, groundY + 2 * P, {
    size: 13,
    maxW: area.x1 - area.x0 - 16,
  });
}

function drawTagPreview(area) {
  let traits = traitsFromTag(tagDraft);
  let label = cleanName(tagDraft.name)
    ? "#" + cleanName(tagDraft.name)
    : "새 태그";
  drawPreview(
    {
      id: "tag-preview",
      type: "plant",
      geneticTraits: traits,
      seed: tagDraft.seed,
    },
    area,
    label,
  );
}

function drawBreedPreview(area) {
  let a = getContainer(breedDraft.aId),
    b = getContainer(breedDraft.bId);
  let problem = breedProblem(a, b);
  if (problem) {
    caption(problem, (area.x0 + area.x1) / 2, (area.y0 + area.y1) / 2, 14);
    return;
  }
  drawPreview(
    {
      id: "breed-preview",
      type: "pot",
      geneticTraits: breedTraits(),
      seed: breedDraft.seed,
      potStyle: breedDraft.potStyle,
    },
    area,
    `${nextGeneration(a, b)}세대 화분 · 다 자란 모습`,
  );
}

// ---------- 떨어지는 잎 ----------

// 떨어지는 잎: 흔들리며 내려오다 바닥에 닿으면 잠시 누워 있다가 깜빡이며 사라진다.
function updateFalling() {
  for (let i = fallingLeaves.length - 1; i >= 0; i--) {
    let f = fallingLeaves[i],
      P = f.P;
    if (!f.rest) {
      f.t++;
      f.vy = min(f.vy + 0.12, 2.6);
      f.vx *= 0.98;
      f.x += f.vx + sin(f.t * 0.08 + f.phase) * 0.9;
      f.y += f.vy;
      // 픽셀 느낌을 살리려고 90도씩 뚝뚝 돈다
      if (f.t % 14 === 0) {
        let ow = f.w,
          oh = f.h;
        f.cells = f.cells.map((c) => ({
          cx: oh - 1 - c.cy,
          cy: c.cx,
          col: c.col,
        }));
        f.w = oh;
        f.h = ow;
        f.x += ((ow - oh) * P) / 2;
        f.y += ((oh - ow) * P) / 2;
      }
      // 바닥에 닿으면 멈춘다.
      if (f.y + f.h * P >= f.restY) {
        f.y = f.restY - f.h * P;
        f.rest = true;
      }
    } else if (--f.life <= 0) {
      fallingLeaves.splice(i, 1);
      continue;
    }
    // 사라지기 직전에는 깜빡인다.
    if (f.rest && f.life < 45 && floor(f.life / 5) % 2 === 0) continue;
    // 위치를 픽셀 칸에 맞춰 반올림해서 그린다.
    let sx = f.gx + round((f.x - f.gx) / P) * P;
    let sy = f.gy + round((f.y - f.gy) / P) * P;
    for (let c of f.cells) {
      fill(c.col);
      rect(sx + c.cx * P, sy + c.cy * P, P, P);
    }
  }
}

// 잎이 떨어질 때 튀는 파편: 중력을 받아 떨어지다 수명이 다하면 사라진다.
function updateSparks() {
  for (let i = sparks.length - 1; i >= 0; i--) {
    let s = sparks[i];
    s.vy += 0.25;
    s.x += s.vx;
    s.y += s.vy;
    if (--s.life <= 0) {
      sparks.splice(i, 1);
      continue;
    }
    fill(s.col);
    rect(
      s.gx + round((s.x - s.gx) / s.P) * s.P,
      round(s.y / s.P) * s.P,
      s.P,
      s.P,
    );
  }
}
