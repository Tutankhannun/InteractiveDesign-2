// =============================================================
// 정원 아카이브 (Midterm) — 데이터 테스트
// =============================================================
// - tests.html을 브라우저로 열면 결과가 보인다.
// - 실제 정원과 섞이지 않게 다른 저장 이름(dataKey)을 쓰고, 끝나면 지운다.
// =============================================================

function runTests() {
  let results = [];
  let test = (name, fn) => {
    resetData();
    try {
      fn();
      results.push({ name, ok: true });
    } catch (error) {
      results.push({ name, ok: false, error: error.message });
    }
  };
  let assert = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  let equal = (actual, expected, message) => {
    let a = JSON.stringify(actual),
      e = JSON.stringify(expected);
    if (a !== e) throw new Error(`${message}: ${a} (기대값 ${e})`);
  };
  let throws = (fn, message) => {
    try {
      fn();
    } catch (error) {
      return error;
    }
    throw new Error(message);
  };
  // 자주 쓰는 준비: 태그 이름들로 식물을 심고 이름 → { tag, plant }를 돌려준다.
  let plantTags = (...names) => {
    let out = {};
    for (let name of names) out[name] = createTag({ name });
    return out;
  };
  let memo = (title, ...tags) =>
    createMemo({ title, tagIds: tags.map((t) => t.tag.id) });
  let names = (memos) => memos.map((m) => m.title).sort();

  test("TEST 01 — 단일 태그 생성", () => {
    let { 학교 } = plantTags("학교");
    let plants = db.containers.filter((c) => c.type === "plant");
    equal(plants.length, 1, "화단의 식물 수");
    equal(plants[0].generation, 1, "세대");
    equal(plants[0].tagIds, [학교.tag.id], "식물 태그");
    equal(plants[0].parentIds, [], "부모");
    throws(() => createTag({ name: " #학교 " }), "같은 이름 태그를 또 만들 수 있으면 안 됨");
  });

  test("TEST 02 — 태그별 메모 축적", () => {
    let { 학교 } = plantTags("학교");
    memo("하나", 학교);
    memo("둘", 학교);
    memo("셋", 학교);
    equal(memosOf(학교.plant).length, 3, "학교 식물의 메모 수");
  });

  test("TEST 03 — 다중 태그 메모", () => {
    let { 학교, 아침 } = plantTags("학교", "아침");
    memo("등굣길", 학교, 아침);
    equal(names(memosOf(학교.plant)), ["등굣길"], "학교 식물");
    equal(names(memosOf(아침.plant)), ["등굣길"], "아침 식물");
    equal(db.memos.length, 1, "메모는 복제하지 않음");
  });

  test("TEST 04 — 2세대 생성", () => {
    let { 학교, 아침 } = plantTags("학교", "아침");
    let pot = breed(학교.plant.id, 아침.plant.id);
    equal(pot.type, "pot", "종류");
    equal(pot.generation, 2, "세대");
    assert(sameSet(pot.tagIds, [학교.tag.id, 아침.tag.id]), "태그는 학교 + 아침");
    equal(pot.parentIds, [학교.plant.id, 아침.plant.id], "부모 둘");
  });

  test("TEST 05 — 합집합 조회", () => {
    let { 학교, 아침, 친구, 불안 } = plantTags("학교", "아침", "친구", "불안");
    memo("학교", 학교);
    memo("아침", 아침);
    memo("학교+아침", 학교, 아침);
    memo("학교+친구", 학교, 친구);
    memo("아침+불안", 아침, 불안);
    memo("친구", 친구);
    let pot = breed(학교.plant.id, 아침.plant.id);
    let shown = memosOf(pot);
    equal(
      names(shown),
      ["아침", "아침+불안", "학교", "학교+아침", "학교+친구"],
      "보여 줄 메모",
    );
    equal(new Set(shown.map((m) => m.id)).size, shown.length, "중복 없음");
  });

  test("TEST 06 — 3세대 생성", () => {
    let { 학교, 아침, 친구 } = plantTags("학교", "아침", "친구");
    let pot2 = breed(학교.plant.id, 아침.plant.id);
    let pot3 = breed(pot2.id, 친구.plant.id);
    equal(pot3.generation, 3, "세대");
    equal(tagNames(pot3.tagIds).sort(), ["친구", "아침", "학교"].sort(), "태그");
  });

  test("TEST 07 — 복합 부모 뿌리", () => {
    let { 학교, 아침, 친구 } = plantTags("학교", "아침", "친구");
    let pot2 = breed(학교.plant.id, 아침.plant.id);
    let pot3 = breed(pot2.id, 친구.plant.id);
    let roots = pot3.parentIds.map((id) => groupLabel(getContainer(id)));
    equal(roots, ["[학교 + 아침]", "[친구]"], "뿌리 라벨은 부모 묶음 그대로");
  });

  test("TEST 08 — 뿌리 한 번 클릭 (필터)", () => {
    let { 학교, 아침, 친구 } = plantTags("학교", "아침", "친구");
    memo("학교", 학교);
    memo("아침", 아침);
    memo("친구", 친구);
    memo("친구+아침", 친구, 아침);
    let pot2 = breed(학교.plant.id, 아침.plant.id);
    let pot3 = breed(pot2.id, 친구.plant.id);
    let rootA = getContainer(pot3.parentIds[0]);
    let active = memosOf(pot3).filter((m) => memoMatches(m, rootA.tagIds));
    equal(names(active), ["아침", "친구+아침", "학교"], "학교 또는 아침 메모만");
  });

  test("뿌리 여러 개 켜기 (모두 만족)", () => {
    let { 학교, 아침, 친구, 불안 } = plantTags("학교", "아침", "친구", "불안");
    memo("학교", 학교);
    memo("아침+친구", 아침, 친구);
    memo("학교+불안", 학교, 불안);
    memo("친구", 친구);
    let ab = breed(학교.plant.id, 아침.plant.id);
    let cd = breed(친구.plant.id, 불안.plant.id);
    let abcd = breed(ab.id, cd.id);
    let groups = (...cs) => cs.map((c) => c.tagIds);
    let pick = (...cs) => names(memosOf(abcd).filter((m) => memoMatchesAll(m, groups(...cs))));
    equal(pick(ab), ["아침+친구", "학교", "학교+불안"], "[학교+아침] 하나만: 묶음 안에서는 하나라도");
    equal(pick(ab, cd), ["아침+친구", "학교+불안"], "[학교+아침] 그리고 [친구+불안]");
    equal(pick(학교.plant, 불안.plant), ["학교+불안"], "조상 [학교] 그리고 [불안]");
  });

  test("현재 세대 / 이전 세대 메모 구분", () => {
    let { 학교, 아침, 친구 } = plantTags("학교", "아침", "친구");
    memo("학교", 학교);
    memo("학교+아침", 학교, 아침);
    memo("학교+아침+친구", 학교, 아침, 친구);
    let ab = breed(학교.plant.id, 아침.plant.id);
    createMemoIn(ab.id, { title: "화분에서" });
    let own = memosOf(ab).filter((m) => isOwnMemo(ab, m));
    equal(names(own), ["학교+아침", "학교+아침+친구", "화분에서"], "화분 태그를 모두 가진 메모");
    equal(names(memosOf(ab).filter((m) => !isOwnMemo(ab, m))), ["학교"], "이전 세대 메모");
  });

  test("자기보다 태그가 많은 메모는 꽃", () => {
    let { 학교, 아침, 친구 } = plantTags("학교", "아침", "친구");
    memo("학교", 학교);
    memo("학교+아침", 학교, 아침);
    memo("학교+아침+친구", 학교, 아침, 친구);
    memo("학교+친구+아침?", 학교, 친구);
    let ab = breed(학교.plant.id, 아침.plant.id);
    let flowers = (c) => names(memosOf(c).filter((m) => hasMoreTags(c, m)));
    equal(flowers(학교.plant), ["학교+아침", "학교+아침+친구", "학교+친구+아침?"], "식물: 태그 2개 이상");
    equal(flowers(ab), ["학교+아침+친구"], "2세대 화분: 태그 3개 이상");
  });

  test("TEST 09 — 뿌리 더블 클릭 (부모로 이동)", () => {
    let { 학교, 아침, 친구 } = plantTags("학교", "아침", "친구");
    let pot2 = breed(학교.plant.id, 아침.plant.id);
    let pot3 = breed(pot2.id, 친구.plant.id);
    equal(getContainer(pot3.parentIds[0]).id, pot2.id, "뿌리 A → 2세대 화분");
    equal(getContainer(pot2.parentIds[0]).id, 학교.plant.id, "2세대 → 1세대 식물");
    assert(ancestorsOf(pot3.id).has(학교.plant.id), "1세대까지 거슬러 올라감");
  });

  test("TEST 10 — 화분 내 메모 작성", () => {
    let { 학교, 아침, 친구 } = plantTags("학교", "아침", "친구");
    let pot2 = breed(학교.plant.id, 아침.plant.id);
    let pot3 = breed(pot2.id, 친구.plant.id);
    let m = createMemoIn(pot3.id, { title: "셋 다" });
    assert(sameSet(m.tagIds, pot3.tagIds), "세 태그 모두 자동 부여");
    equal(m.sourceContainerId, pot3.id, "처음 쓴 곳");
  });

  test("TEST 11 — 형질 상속", () => {
    let { 학교, 아침 } = plantTags("학교", "아침");
    let A = 학교.plant.geneticTraits,
      B = 아침.plant.geneticTraits;
    let traits = inheritTraits(학교.plant, 아침.plant, {
      stemType: "parentB",
      flowerType: "parentA",
      primaryColor: "#123456",
      flowerScale: 2,
    });
    let pot = breed(학교.plant.id, 아침.plant.id, { traits });
    equal(pot.geneticTraits.stemType, B.stemType, "줄기는 B");
    equal(pot.geneticTraits.flowerType, A.flowerType, "꽃은 A");
    equal(pot.geneticTraits.leafType, A.leafType, "잎은 기본값 A");
    equal(pot.geneticTraits.primaryColor, "#123456", "직접 고른 색");
    equal(pot.geneticTraits.secondaryColor, blendColor(A.secondaryColor, B.secondaryColor), "꽃 색은 평균");
    equal(pot.geneticTraits.inheritanceMap.stemType, "parentB", "상속 기록");
    equal(pot.geneticTraits.inheritanceMap.primaryColor, "custom", "상속 기록(직접)");
    // 부모 태그를 고쳐도 이미 만든 화분은 그대로
    let before = JSON.stringify(pot.geneticTraits);
    updateTag(학교.tag.id, { ...학교.tag, color: "#000000", stemType: 3 });
    equal(JSON.stringify(getContainer(pot.id).geneticTraits), before, "자식 형질은 독립");
    equal(학교.plant.geneticTraits.primaryColor, "#000000", "1세대 식물은 태그를 따름");
    // 저장 후 다시 불러와도 유지
    saveData();
    loadData();
    equal(getContainer(pot.id).geneticTraits.primaryColor, "#123456", "새로고침 후 유지");
  });

  test("TEST 12 — 메모 변경", () => {
    let { 학교, 아침 } = plantTags("학교", "아침");
    let pot = breed(학교.plant.id, 아침.plant.id);
    let m = memo("하나", 학교);
    for (let i = 0; i < 3; i++) memo("더", 학교);
    equal(memosOf(아침.plant).length, 0, "처음엔 아침 메모 없음");
    equal(growthStage(memosOf(학교.plant).length), 2, "학교 4개 = 잎 성장");
    updateMemo(m.id, { ...m, tagIds: [아침.tag.id] });
    equal(memosOf(아침.plant).length, 1, "태그 바꾸면 아침에 보임");
    equal(growthStage(memosOf(학교.plant).length), 1, "학교 3개 = 새싹으로 재계산");
    equal(memosOf(pot).length, 4, "화분은 그대로 4개");
    deleteMemo(m.id);
    equal(memosOf(pot).length, 3, "삭제하면 화분도 줄어듦");
  });

  test("세대 계산 규칙", () => {
    let { a, b, c, d } = plantTags("a", "b", "c", "d");
    let ab = breed(a.plant.id, b.plant.id); // 2
    let cd = breed(c.plant.id, d.plant.id); // 2
    let abc = breed(ab.id, c.plant.id); // 3
    equal(breed(ab.id, cd.id).generation, 3, "2 + 2");
    equal(breed(abc.id, d.plant.id).generation, 4, "3 + 1");
    equal(breed(abc.id, cd.id).generation, 4, "3 + 2");
  });

  test("교배 예외 규칙", () => {
    let { a, b, c } = plantTags("a", "b", "c");
    assert(breedProblem(a.plant, a.plant), "같은 부모 거부");
    let ab = breed(a.plant.id, b.plant.id);
    assert(breedProblem(ab, a.plant), "조상과 자손 교배 거부");
    let error = throws(() => breed(a.plant.id, b.plant.id), "같은 부모 조합은 확인을 받아야 함");
    equal(error.code, "duplicate", "중복 안내");
    equal(error.existing.id, ab.id, "기존 화분 안내");
    let twin = breed(b.plant.id, a.plant.id, { allowDuplicate: true });
    assert(twin.id !== ab.id, "확인하면 별개 화분 생성");
    let ac = breed(a.plant.id, c.plant.id);
    let bc = breed(b.plant.id, c.plant.id);
    assert(!breedProblem(ac, bc), "태그 집합이 겹쳐도 부모가 다르면 교배 가능");
  });

  test("삭제·보관 규칙", () => {
    let { a, b, c } = plantTags("a", "b", "c");
    let m = memo("a 메모", a);
    throws(() => deleteTag(a.tag.id), "메모가 있는 태그는 지울 수 없음");
    deleteMemo(m.id);
    let ab = breed(a.plant.id, b.plant.id);
    throws(() => deleteTag(a.tag.id), "화분이 있는 태그는 지울 수 없음");
    let abc = breed(ab.id, c.plant.id);
    archiveContainer(ab.id);
    assert(!activeContainers().includes(ab), "보관한 화분은 정원에서 빠짐");
    equal(getContainer(abc.id).parentIds[0], ab.id, "자식의 부모 기록은 유지");
    deleteTag(createTag({ name: "빈" }).tag.id);
    assert(!findTagByName("빈") && !db.containers.some((x) => x.name === "빈"), "빈 태그는 식물과 함께 지움");
  });

  test("태그 이름 수정은 참조 유지", () => {
    let { 학교 } = plantTags("학교");
    let m = memo("하나", 학교);
    updateTag(학교.tag.id, { ...학교.tag, name: "대학교" });
    equal(tagNames(getMemo(m.id).tagIds), ["대학교"], "메모 태그 이름");
    equal(학교.plant.name, "대학교", "식물 이름");
  });

  test("성장 단계 경계", () => {
    equal([0, 1, 3, 4, 9, 10, 19, 20, 99].map(growthStage), [0, 1, 1, 2, 2, 3, 3, 4, 4], "단계");
  });

  test("백업 내보내기", () => {
    let { 학교 } = plantTags("학교");
    memo("등굣길 메모", 학교);
    let backup = JSON.parse(exportData());
    equal(isGardenData(backup), true, "정원 데이터 형식");
    equal(backup.memos.length, 1, "메모 포함");
  });

  resetData();
  try {
    localStorage.removeItem(dataKey);
  } catch (error) {
    /* 저장소가 없으면 그냥 넘어간다 */
  }
  return results;
}
