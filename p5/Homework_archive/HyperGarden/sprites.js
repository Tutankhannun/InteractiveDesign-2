// =============================================================
// 정원 아카이브 (Midterm) — 픽셀 그림 재료
// =============================================================
// - 잎·꽃·열매 스프라이트, 화분 모양·무늬·색, 태그 색 추천값
// - 형질 번호(stemType, leafType …)는 아래 배열의 순서와 같다.
// - p5 없이 쓸 수 있는 값만 둔다. (data.js와 tests.html도 이 파일을 쓴다)
// =============================================================

// 형질 이름: 태그 만들기·교배 화면에 쓰인다. 배열 순서 = 형질 번호
const TRAIT_NAMES = {
  stemType: ["곧은", "기운", "지그재그", "갈래", "덩굴", "선인장", "늘어진", "계단"],
  leafType: ["잎맥", "세모", "네모", "하트", "물방울", "둥근", "바늘", "단풍"],
  flowerType: ["바람개비", "마름모", "테두리", "별", "데이지", "튤립", "송이"],
  fruitType: ["베리", "사과", "포도", "꼬투리", "체리", "레몬"],
};

// 형질 항목 이름
const TRAIT_LABELS = {
  primaryColor: "잎 색",
  secondaryColor: "꽃·열매 색",
  stemType: "줄기",
  leafType: "잎",
  flowerType: "꽃",
  fruitType: "열매",
  stemThickness: "줄기 굵기",
  leafScale: "잎 크기",
  flowerScale: "꽃 크기",
};

// 태그 색 추천값: [잎 색, 꽃·열매 색] — 예전 식물 색 조합에서 가져왔다.
const COLOR_PRESETS = [
  ["#1f8a43", "#e2231a"],
  ["#8cc63f", "#ffd400"],
  ["#e2231a", "#ffd400"],
  ["#f2a477", "#d6246e"],
  ["#1e73d8", "#ffd400"],
  ["#1f7a3a", "#1e73d8"],
  ["#7b4fc9", "#f2a477"],
  ["#1fb5c9", "#e2401c"],
  ["#2e9e6b", "#f7b2c4"],
  ["#5a7d2a", "#f39a1e"],
  ["#3c4f8f", "#ffd400"],
  ["#b5446e", "#fffdf6"],
  ["#6aa84f", "#7b4fc9"],
  ["#0f6b5c", "#ff7a59"],
  ["#c98a2b", "#e2231a"],
  ["#4b9fd6", "#ffffff"],
];

// 화분 모양: 위에서부터 줄마다 반폭(칸)
const POT_SHAPES = [
  { rows: [13, 13, 11, 11, 11, 11, 11, 10, 10, 9, 9, 8, 7] },
  { rows: [10, 11, 12, 13, 13, 13, 13, 13, 12, 11, 10, 9] },
  { rows: [13, 12, 13, 12, 13, 12, 13, 12, 13, 12, 13, 12, 13, 12] },
  { rows: [7, 8, 9, 10, 11, 12, 13, 13, 13, 13] },
  { rows: [11, 11, 10, 9, 10, 11, 12, 13, 13, 12, 11, 8, 7, 9, 9] },
  { rows: [13, 13, 12, 12, 12, 12, 12, 12, 12, 12], legs: true },
  { rows: [9, 8, 8, 10, 12, 13, 13, 13, 12, 11, 9, 8] }, // 항아리
  { rows: [13, 13, 13, 12, 11, 9, 7] }, // 낮은 사발
  { rows: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10] }, // 긴 통
  { rows: [12, 13, 13, 13, 12, 11, 10], legs: true }, // 다리 달린 사발
  { rows: [13, 12, 12, 11, 11, 10, 10, 9, 9, 8] }, // 양동이
];
const POT_PATTERNS = 9; // 화분 무늬 가짓수 (render.js의 potColor 참고)

// 화분 색 조합: pot 바탕, accent 무늬, accent2 포인트 무늬, dark 테두리·그림자
const POT_THEMES = [
  { pot: "#f39a1e", accent: "#e2401c", accent2: "#ffd23f", dark: "#c4561a" },
  { pot: "#ef7d22", accent: "#2b3a55", accent2: "#ffd23f", dark: "#b5501a" },
  { pot: "#e2401c", accent: "#2b3a55", accent2: "#f7b538", dark: "#a82a14" },
  { pot: "#2f6fd6", accent: "#f39a1e", accent2: "#fffdf6", dark: "#1f4b99" },
  { pot: "#7c8a3a", accent: "#2b3a55", accent2: "#d9d36a", dark: "#58622a" },
  { pot: "#2b3a55", accent: "#5c6f91", accent2: "#f39a1e", dark: "#1b263a" },
  { pot: "#7fcfb8", accent: "#2b7a66", accent2: "#fffdf6", dark: "#4f9c86" },
  { pot: "#f4a6b8", accent: "#d6246e", accent2: "#fffdf6", dark: "#c46f86" },
  { pot: "#efe0c0", accent: "#c4561a", accent2: "#2b3a55", dark: "#bfa77a" },
  { pot: "#7b4fc9", accent: "#ffd23f", accent2: "#f4a6b8", dark: "#563596" },
  { pot: "#262626", accent: "#d9a520", accent2: "#fffdf6", dark: "#111111" },
];

// 잎 스프라이트: 왼쪽 아래가 가지에 붙는 자리. X 잎, o 그림자, v 잎맥
const LEAF_SPRITES = [
  ["....XX", "...XvX", "..XvXo", ".XvXo.", "XvXo..", "vXo..."],
  ["X.....", "XX....", "XXX...", "XXXX..", "XXXXX.", "XXXXXX"],
  ["XXXXv", "XXXvX", "XXvXX", "XvXXX", "vXXXX"],
  ["XX.XX", "XXXXX", "XXXXo", "XXXo.", "XXo.."],
  ["...XX", "..XXX", ".XXXo", "XXXo.", "XXo.."],
  [".XXX.", "XXXXX", "XXXvo", "XXvo.", "Xv..."], // 둥근
  ["......X", ".....X.", "....X..", "...X...", "..X....", ".X.....", "X......"], // 바늘
  ["X..X.", "XX.XX", ".XXXX", "XXvXo", "..vo.", ".v...", "v...."], // 단풍
];
// 가지 중간·꼭대기·새싹에 쓰는 작은 잎
const SMALL_LEAF = ["..X", ".XX", "XXo"];
// 꽃 스프라이트 7종: 바람개비, 마름모, 테두리, 별, 데이지, 튤립, 송이
const FLOWER_SPRITES = [
  pinwheelFlower(),
  diamondFlower(),
  hollowFlower(),
  starFlower(),
  daisyFlower(),
  tulipFlower(),
  clusterFlower(),
];
// 열매 스프라이트 4종: 첫 줄의 s(꼭지)가 가지에 매달리는 자리. f 열매, d 그늘, h 빛
const FRUIT_SPRITES = [
  [".s.", "hff", "ffd", ".d."],
  ["..s..", ".fff.", "fhfff", "ffffd", ".fdd."],
  ["..s..", "fhfdf", "dfdfd", ".fdf.", "..d.."],
  ["s..", "ff.", "hfd", "ffd", ".dd"],
  ["..s..", ".s.s.", "ff.ff", "hf.hf", "dd.dd"], // 체리
  ["s...", "ff..", "hff.", ".ffd", "..dd"], // 레몬
];

// 꽃 스프라이트: p 꽃잎, d 짙은 꽃잎, c 꽃술, w 흰 속
function pinwheelFlower() {
  let blade = [
    [0, -1, "p"],
    [0, -2, "p"],
    [0, -3, "p"],
    [1, -2, "d"],
    [1, -3, "d"],
    [2, -3, "d"],
  ];
  let out = [{ x: 0, y: 0, k: "c" }];
  for (let q = 0; q < 4; q++) {
    for (let [x, y, k] of blade) {
      for (let i = 0; i < q; i++) [x, y] = [-y, x];
      out.push({ x, y, k });
    }
  }
  return out;
}

// -3~3 칸 격자를 돌며 pick이 돌려준 종류(p/d/c/w)로 꽃 칸을 만든다. d는 중심에서의 마름모 거리.
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

// 마름모 꽃: 꽃술 + 꽃잎 + 네 방향 끝
function diamondFlower() {
  return gridFlower((x, y, d) =>
    d === 0 ? "c" : d <= 2 ? "p" : d === 3 && (x === 0 || y === 0) ? "d" : null,
  );
}

// 속이 흰 테두리 꽃
function hollowFlower() {
  return gridFlower((x, y, d) =>
    d === 3 ? "p" : d === 0 ? "c" : d < 3 ? "w" : null,
  );
}

// 십자 + 대각선으로 뻗은 별 꽃
function starFlower() {
  return gridFlower((x, y, d) => {
    if (d === 0) return "c";
    if ((x === 0 || y === 0) && d <= 3) return "p";
    if (Math.abs(x) === Math.abs(y) && Math.abs(x) <= 2) return "d";
    return null;
  });
}

// 씨앗 포대자루 (정원 왼쪽 위): 흔들면 씨앗이 하나 튀어나온다.
// o 테두리 · b 삼베 · d 삼베 결 · f 접힌 입구 · s 안에 보이는 씨앗 · l 이름표
const SACK = [
  "...oooooooo...",
  "..offffffffo..",
  "..ofsfssfsfo..",
  "...offffffo...",
  "...obbbbbbo...",
  "..obbdbbbbbo..",
  ".obbbbbbbdbbo.",
  ".obllllllllbo.",
  "obbllllllllbbo",
  "obbllllllllbbo",
  "obbllllllllbbo",
  "obdbbbbbbbbbbo",
  "obbbbbdbbbbbbo",
  "obbbbbbbbbdbbo",
  ".obbdbbbbbbbo.",
  "..oobbbbbboo..",
  "....oooooo....",
];

// 데이지: 노란 꽃술 둘레로 흰 꽃잎이 열 방향으로, 끝만 꽃 색
function daisyFlower() {
  return gridFlower((x, y, d) => {
    if (d <= 1) return "c";
    if ((x === 0 || y === 0) && d <= 3) return d === 3 ? "p" : "w";
    if (Math.abs(x) === Math.abs(y) && Math.abs(x) <= 2) return "w";
    return null;
  });
}

// 튤립: 위가 갈라진 컵 모양
function tulipFlower() {
  return gridFlower((x, y) => {
    let ax = Math.abs(x);
    if (y === -3) return ax === 2 || x === 0 ? "p" : null;
    if (y === -2) return ax <= 2 ? "p" : null;
    if (y === -1) return ax <= 2 ? (ax === 2 ? "d" : "p") : null;
    if (y === 0) return ax <= 1 ? "d" : null;
    if (y === 1) return x === 0 ? "c" : null;
    return null;
  });
}

// 송이: 작은 꽃 세 송이가 모여 있다
function clusterFlower() {
  let centers = [[-2, -1], [2, -1], [0, 2]];
  return gridFlower((x, y) => {
    for (let [cx, cy] of centers) {
      let d = Math.abs(x - cx) + Math.abs(y - cy);
      if (d === 0) return "c";
      if (d === 1) return "p";
    }
    return null;
  });
}
