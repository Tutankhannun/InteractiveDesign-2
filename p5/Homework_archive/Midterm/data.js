// =============================================================
// 정원 아카이브 (Midterm) — 데이터
// =============================================================
// - 태그 하나 = 1세대 식물 하나. 태그를 만들면 화단에 식물이 심어진다.
// - 부모 둘(식물 또는 화분)을 교배하면 두 부모의 태그를 모두 물려받은 화분이 생긴다.
// - 메모는 한 곳에만 저장하고, 식물·화분은 태그를 비교해 그때그때 찾아 보여 준다.
// - p5 없이 동작하는 순수 로직만 둔다. (tests.html에서도 그대로 불러 쓴다)
// - 데이터는 브라우저 localStorage에 저장된다.
// =============================================================

// ---------- 설정값 ----------
let dataKey = "midterm-garden-archive-v1"; // localStorage 저장 이름 (테스트는 다른 이름을 쓴다)

// 메모 개수에 따른 성장 단계: min개 이상이면 그 단계
const GROWTH_STAGES = [
  { min: 0, name: "씨앗" },
  { min: 1, name: "새싹" },
  { min: 4, name: "잎 성장" },
  { min: 10, name: "꽃 피움" },
  { min: 20, name: "열매 맺음" },
];

// 교배할 때 형질마다 기본으로 따를 쪽. 색은 두 부모 색을 반씩 섞는다.
const DEFAULT_CHOICES = {
  primaryColor: "blend",
  secondaryColor: "blend",
  stemType: "parentA",
  leafType: "parentA",
  flowerType: "parentB",
  fruitType: "parentB",
  stemThickness: "parentA",
  leafScale: "parentA",
  flowerScale: "parentB",
};

// ---------- 상태 ----------
let db = emptyData(); // { tags, memos, containers }
let dataVersion = 0; // 데이터가 바뀔 때마다 올라간다 (계산해 둔 메모 목록을 버리는 기준)
let memoCache = { v: -1, map: new Map() }; // 태그 조합별로 계산해 둔 메모 목록
const shadeCache = new Map(); // 계산해 둔 명암·섞은 색

// ---------- 저장 ----------

function emptyData() {
  return { tags: [], memos: [], containers: [] };
}

// localStorage에서 정원을 불러온다. 망가진 데이터면 빈 정원으로 시작한다.
function loadData() {
  try {
    let saved = JSON.parse(localStorage.getItem(dataKey));
    db = isGardenData(saved) ? saved : emptyData();
  } catch (error) {
    db = emptyData();
  }
  dataVersion++;
}

// 정원을 localStorage에 저장한다.
function saveData() {
  dataVersion++;
  try {
    localStorage.setItem(dataKey, JSON.stringify(db));
  } catch (error) {
    /* 저장 공간이 없으면 현재 화면에서 계속 사용 */
  }
}

// 저장하지 않고 정원을 비운다. (테스트용)
function resetData() {
  db = emptyData();
  dataVersion++;
}

function isGardenData(data) {
  return (
    !!data &&
    ["tags", "memos", "containers"].every((key) => Array.isArray(data[key]))
  );
}

// 백업 파일 내용(JSON 글자)을 만든다.
function exportData() {
  return JSON.stringify(
    { app: "garden-archive", version: 1, exportedAt: stamp(), ...db },
    null,
    2,
  );
}

// ---------- 찾기 ----------

function getTag(id) {
  return db.tags.find((tag) => tag.id === id);
}

function getMemo(id) {
  return db.memos.find((memo) => memo.id === id);
}

function getContainer(id) {
  return db.containers.find((c) => c.id === id);
}

// 태그 하나에 딸린 1세대 식물
function plantOfTag(tagId) {
  return db.containers.find((c) => c.type === "plant" && c.tagIds[0] === tagId);
}

function findTagByName(name) {
  let key = cleanName(name).toLowerCase();
  return db.tags.find((tag) => tag.name.toLowerCase() === key);
}

// 보관하지 않은 식물·화분
function activeContainers() {
  return db.containers.filter((c) => !c.archived);
}

function tagNames(tagIds) {
  return tagIds.map((id) => (getTag(id) ? getTag(id).name : "?"));
}

// "#학교 #아침"
function tagLabel(tagIds) {
  return tagNames(tagIds)
    .map((name) => "#" + name)
    .join(" ");
}

// 뿌리 라벨: 부모가 가진 태그 묶음을 하나로 "[학교 + 아침]"
function groupLabel(container) {
  return `[${tagNames(container.tagIds).join(" + ")}]`;
}

// 태그 집합이 똑같은 (보관하지 않은) 화분들
function findPotsByTagSet(tagIds) {
  return db.containers.filter(
    (c) => c.type === "pot" && !c.archived && sameSet(c.tagIds, tagIds),
  );
}

// ---------- 태그 ----------

// 새 태그의 형질을 무작위로 추천한다.
function recommendTraits(rand = Math.random) {
  let pick = (n) => Math.floor(rand() * n);
  let [leaf, flower] = COLOR_PRESETS[pick(COLOR_PRESETS.length)];
  return {
    color: leaf,
    secondaryColor: flower,
    stemType: pick(TRAIT_NAMES.stemType.length),
    leafType: pick(TRAIT_NAMES.leafType.length),
    flowerType: pick(TRAIT_NAMES.flowerType.length),
    fruitType: pick(TRAIT_NAMES.fruitType.length),
  };
}

// 태그를 만들고, 그 태그를 대표하는 1세대 식물도 함께 화단에 심는다.
function createTag(input) {
  let name = cleanName(input.name);
  if (!name) throw new Error("태그 이름을 적어 주세요.");
  if (findTagByName(name)) throw new Error(`'#${name}' 태그는 이미 있어요.`);
  let time = stamp();
  let tag = {
    id: uid("tag"),
    name,
    ...tagFields(input, recommendTraits()),
    createdAt: time,
    updatedAt: time,
  };
  let plant = {
    id: uid("plant"),
    name,
    type: "plant",
    generation: 1,
    tagIds: [tag.id],
    parentIds: [],
    geneticTraits: traitsFromTag(tag),
    seed: Number.isInteger(input.seed) ? input.seed : newSeed(), // 미리보기와 같은 모양으로
    archived: false,
    createdAt: time,
    updatedAt: time,
  };
  db.tags.push(tag);
  db.containers.push(plant);
  saveData();
  return { tag, plant };
}

// 태그 이름·형질을 고친다. 그 태그의 1세대 식물도 같이 바뀌고, 이미 만든 화분은 그대로 둔다.
function updateTag(id, input) {
  let tag = getTag(id);
  if (!tag) throw new Error("없는 태그예요.");
  let name = cleanName(input.name);
  if (!name) throw new Error("태그 이름을 적어 주세요.");
  let same = findTagByName(name);
  if (same && same.id !== id) throw new Error(`'#${name}' 태그는 이미 있어요.`);
  Object.assign(tag, { name, ...tagFields(input, tag), updatedAt: stamp() });
  let plant = plantOfTag(id);
  if (plant) {
    plant.name = name;
    plant.geneticTraits = traitsFromTag(tag);
    plant.updatedAt = tag.updatedAt;
  }
  saveData();
  return tag;
}

// 연결된 메모나 화분이 없을 때만 태그(와 그 식물)를 지운다.
function deleteTag(id) {
  let tag = getTag(id);
  if (!tag) return;
  let memos = db.memos.filter((m) => m.tagIds.includes(id)).length;
  let pots = db.containers.filter(
    (c) => c.type === "pot" && c.tagIds.includes(id),
  ).length;
  if (memos || pots) {
    let links = [memos && `메모 ${memos}개`, pots && `화분 ${pots}개`]
      .filter(Boolean)
      .join("와 ");
    throw new Error(
      `#${tag.name} 태그에 ${links}가 이어져 있어 지울 수 없어요.\n먼저 메모의 태그를 바꾸거나 메모를 지워 주세요.`,
    );
  }
  db.tags = db.tags.filter((t) => t.id !== id);
  db.containers = db.containers.filter(
    (c) => !(c.type === "plant" && c.tagIds[0] === id),
  );
  saveData();
}

// 태그 입력값에서 형질만 골라 확인한다. 잘못된 값은 base 값을 쓴다.
function tagFields(input, base) {
  return {
    color: validColor(input.color, base.color),
    secondaryColor: validColor(input.secondaryColor, base.secondaryColor),
    stemType: validIndex(input.stemType, TRAIT_NAMES.stemType, base.stemType),
    leafType: validIndex(input.leafType, TRAIT_NAMES.leafType, base.leafType),
    flowerType: validIndex(
      input.flowerType,
      TRAIT_NAMES.flowerType,
      base.flowerType,
    ),
    fruitType: validIndex(input.fruitType, TRAIT_NAMES.fruitType, base.fruitType),
  };
}

// 태그의 형질로 1세대 식물의 유전 형질을 만든다.
function traitsFromTag(tag) {
  return sanitizeTraits({
    primaryColor: tag.color,
    secondaryColor: tag.secondaryColor,
    stemType: tag.stemType,
    leafType: tag.leafType,
    flowerType: tag.flowerType,
    fruitType: tag.fruitType,
    stemThickness: 1,
    leafScale: 1,
    flowerScale: 1,
    inheritanceMap: {},
  });
}

// ---------- 메모 ----------

// 메모를 만든다. 태그는 하나 이상, 중복 없이.
function createMemo(input) {
  let fields = memoFields(input);
  let time = stamp();
  let memo = {
    id: uid("memo"),
    ...fields,
    sourceContainerId: input.sourceContainerId || null,
    createdAt: time,
    updatedAt: time,
  };
  db.memos.push(memo);
  saveData();
  return memo;
}

// 식물·화분 안에서 메모를 만든다. 그 식물·화분의 태그를 모두 자동으로 붙인다.
function createMemoIn(containerId, input) {
  let c = getContainer(containerId);
  if (!c) throw new Error("없는 식물이에요.");
  return createMemo({
    ...input,
    tagIds: [...c.tagIds, ...(input.tagIds || [])],
    sourceContainerId: c.id,
  });
}

// 메모를 고친다. 메모는 한 곳에만 있으니 이 메모를 보여 주는 모든 식물·화분에 바로 반영된다.
function updateMemo(id, input) {
  let memo = getMemo(id);
  if (!memo) throw new Error("없는 메모예요.");
  Object.assign(memo, memoFields(input), { updatedAt: stamp() });
  saveData();
  return memo;
}

function deleteMemo(id) {
  db.memos = db.memos.filter((m) => m.id !== id);
  saveData();
}

// 메모 입력값 확인: 제목이나 내용 중 하나, 태그 하나 이상
function memoFields(input) {
  let title = String(input.title || "")
    .trim()
    .slice(0, 60);
  let content = String(input.content || "").trim();
  let tagIds = unique(input.tagIds || []).filter(getTag);
  if (!title && !content) throw new Error("제목이나 내용을 적어 주세요.");
  if (!tagIds.length) throw new Error("태그를 하나 이상 골라 주세요.");
  return { title: title || content.split("\n")[0].slice(0, 30), content, tagIds };
}

// 메모의 태그 중 하나라도 tagIds에 있으면 true
function memoMatches(memo, tagIds) {
  return memo.tagIds.some((id) => tagIds.includes(id));
}

// 현재 세대 메모: 식물·화분의 태그를 모두 가진 메모. (화분 안에서 쓴 메모, 같은 조합 메모)
// 나머지는 부모·조상의 태그로만 이어진 이전 세대 메모다.
function isOwnMemo(container, memo) {
  return container.tagIds.every((id) => memo.tagIds.includes(id));
}

// 자기보다 태그가 많은 메모: 식물·화분에서 꽃으로 핀다.
function hasMoreTags(container, memo) {
  return memo.tagIds.length > container.tagIds.length;
}

// 뿌리 필터: 켠 묶음(groups)을 모두 만족하는 메모. 묶음 안에서는 태그가 하나라도 있으면 된다.
function memoMatchesAll(memo, groups) {
  return groups.every((tagIds) => memoMatches(memo, tagIds));
}

// 식물·화분이 보여 줄 메모:태그가 하나라도 겹치는 메모 (합집합, 중복 없음, 오래된 순)
// 저장하지 않고 계산하되, 데이터가 바뀌기 전까지는 계산해 둔 목록을 쓴다.
function memosOf(container) {
  if (memoCache.v !== dataVersion) memoCache = { v: dataVersion, map: new Map() };
  let key = container.tagIds.join(",");
  if (!memoCache.map.has(key)) {
    memoCache.map.set(
      key,
      db.memos.filter((m) => memoMatches(m, container.tagIds)).sort(byCreated),
    );
  }
  return memoCache.map.get(key);
}

// 메모 개수 → 성장 단계 번호 (GROWTH_STAGES 참고)
function growthStage(count) {
  let stage = 0;
  GROWTH_STAGES.forEach((g, i) => {
    if (count >= g.min) stage = i;
  });
  return stage;
}

// ---------- 교배·계보 ----------

// 자식 세대 = 부모 세대 중 큰 쪽 + 1
function nextGeneration(a, b) {
  return Math.max(a.generation, b.generation) + 1;
}

// id의 모든 조상 id
function ancestorsOf(id, seen = new Set()) {
  let c = getContainer(id);
  if (!c) return seen;
  for (let parentId of c.parentIds) {
    if (seen.has(parentId)) continue;
    seen.add(parentId);
    ancestorsOf(parentId, seen);
  }
  return seen;
}

// 교배할 수 없는 이유. 교배할 수 있으면 null
function breedProblem(a, b) {
  if (!a || !b) return "부모 둘을 골라 주세요.";
  if (a.id === b.id) return "서로 다른 두 부모를 골라 주세요.";
  if (ancestorsOf(a.id).has(b.id) || ancestorsOf(b.id).has(a.id))
    return "조상과 자손은 교배할 수 없어요. (계보가 꼬여요)";
  if (unique([...a.tagIds, ...b.tagIds]).length < 2)
    return "서로 다른 태그가 2개 이상 있어야 해요.";
  return null;
}

// 같은 부모 조합으로 이미 만든 화분
function findSameParents(a, b) {
  return db.containers.find(
    (c) => c.type === "pot" && !c.archived && sameSet(c.parentIds, [a.id, b.id]),
  );
}

// 부모 a, b의 형질을 물려받은 자식 형질. choices[형질]로 따를 쪽을 고른다.
// "parentA" | "parentB" | "blend"(색을 반씩 섞기) | 그 밖의 값은 직접 고른 값
function inheritTraits(a, b, choices = {}) {
  let A = a.geneticTraits,
    B = b.geneticTraits;
  let traits = { inheritanceMap: {} };
  for (let key of Object.keys(DEFAULT_CHOICES)) {
    let pick = choices[key] !== undefined ? choices[key] : DEFAULT_CHOICES[key];
    traits[key] =
      pick === "parentA"
        ? A[key]
        : pick === "parentB"
          ? B[key]
          : pick === "blend"
            ? blendColor(A[key], B[key])
            : pick;
    traits.inheritanceMap[key] = ["parentA", "parentB", "blend"].includes(pick)
      ? pick
      : "custom";
  }
  return sanitizeTraits(traits);
}

// 부모 둘을 교배해 화분을 만든다.
// options: name, traits(미리보기에서 고른 형질), potStyle, seed, allowDuplicate
function breed(aId, bId, options = {}) {
  let a = getContainer(aId),
    b = getContainer(bId);
  let problem = breedProblem(a, b);
  if (problem) throw new Error(problem);
  let twin = findSameParents(a, b);
  if (twin && !options.allowDuplicate) {
    let error = new Error(`같은 부모로 만든 '${twin.name}' 화분이 이미 있어요.`);
    error.code = "duplicate";
    error.existing = twin;
    throw error;
  }
  let tagIds = unique([...a.tagIds, ...b.tagIds]);
  let time = stamp();
  let pot = {
    id: uid("pot"),
    name:
      String(options.name || "")
        .trim()
        .slice(0, 30) || tagNames(tagIds).join(" + "),
    type: "pot",
    generation: nextGeneration(a, b),
    tagIds,
    parentIds: [a.id, b.id],
    geneticTraits: sanitizeTraits(options.traits || inheritTraits(a, b)),
    seed: options.seed || newSeed(),
    potStyle: options.potStyle || randomPotStyle(),
    archived: false,
    createdAt: time,
    updatedAt: time,
  };
  db.containers.push(pot);
  saveData();
  return pot;
}

// 화분 이름을 바꾼다. (식물 이름은 태그 이름을 따른다)
function renameContainer(id, name) {
  let c = getContainer(id);
  name = String(name || "")
    .trim()
    .slice(0, 30);
  if (!c || !name) return;
  c.name = name;
  c.updatedAt = stamp();
  saveData();
}

// 정원에 심은 자리: x는 칸 단위, d는 깊이(0 뒤쪽 ~ 1 앞쪽)
function setGardenPos(id, pos) {
  let c = getContainer(id);
  if (!c) return;
  c.gardenPos = {
    x: Math.max(10, Math.round(pos.x)),
    d: Math.min(1, Math.max(0, pos.d)),
  };
  saveData();
}

// 화분은 계보 때문에 지우지 않고 보관한다. 자식 화분의 부모 기록은 그대로 남는다.
function archiveContainer(id, archived = true) {
  let c = getContainer(id);
  if (!c || c.type !== "pot") return;
  c.archived = archived;
  c.updatedAt = stamp();
  saveData();
}

// 유전 형질 값이 범위를 벗어나지 않게 정리한다.
function sanitizeTraits(t) {
  return {
    primaryColor: validColor(t.primaryColor, COLOR_PRESETS[0][0]),
    secondaryColor: validColor(t.secondaryColor, COLOR_PRESETS[0][1]),
    stemType: validIndex(t.stemType, TRAIT_NAMES.stemType, 0),
    leafType: validIndex(t.leafType, TRAIT_NAMES.leafType, 0),
    flowerType: validIndex(t.flowerType, TRAIT_NAMES.flowerType, 0),
    fruitType: validIndex(t.fruitType, TRAIT_NAMES.fruitType, 0),
    stemThickness: Number(t.stemThickness) === 2 ? 2 : 1,
    leafScale: Number(t.leafScale) === 2 ? 2 : 1,
    flowerScale: Number(t.flowerScale) === 2 ? 2 : 1,
    inheritanceMap: { ...(t.inheritanceMap || {}) },
  };
}

// 새 화분의 모양·무늬·색을 무작위로 정한다.
function randomPotStyle() {
  let pick = (n) => Math.floor(Math.random() * n);
  return {
    shape: pick(POT_SHAPES.length),
    pattern: pick(POT_PATTERNS),
    theme: pick(POT_THEMES.length),
  };
}

// ---------- 도우미 ----------

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function stamp() {
  return new Date().toISOString();
}

function newSeed() {
  return Math.floor(Math.random() * 1e9);
}

function unique(list) {
  return [...new Set(list)];
}

// 순서와 상관없이 같은 값들을 가졌는지
function sameSet(a, b) {
  let A = unique(a),
    B = unique(b);
  return A.length === B.length && A.every((v) => B.includes(v));
}

function byCreated(a, b) {
  return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
}

// 태그 이름: 앞뒤 공백과 맨 앞 #을 뗀다.
function cleanName(name) {
  return String(name || "")
    .trim()
    .replace(/^#+/, "")
    .trim()
    .slice(0, 20);
}

function validColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
}

function validIndex(value, options, fallback) {
  value = Number(value);
  return Number.isInteger(value) && value >= 0 && value < options.length
    ? value
    : fallback;
}

function hexToRgb(hex) {
  let n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(rgb) {
  return (
    "#" +
    rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")
  );
}

// 두 색을 섞는다. t = 0이면 a, 1이면 b. 기본은 반씩(평균).
function blendColor(a, b, t = 0.5) {
  let key = a + b + t;
  if (!shadeCache.has(key)) {
    let A = hexToRgb(a),
      B = hexToRgb(b);
    shadeCache.set(key, rgbToHex(A.map((v, i) => v + (B[i] - v) * t)));
  }
  return shadeCache.get(key);
}

// 색을 어둡게(amount < 0) 또는 밝게(amount > 0) 만든다. 매 프레임 쓰여서 결과를 캐시한다.
function shade(hex, amount) {
  return blendColor(hex, amount < 0 ? "#000000" : "#ffffff", Math.abs(amount));
}

// 식물마다 같은 모양으로 자라도록 씨앗값으로 만드는 난수
function mulberry32(a) {
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
