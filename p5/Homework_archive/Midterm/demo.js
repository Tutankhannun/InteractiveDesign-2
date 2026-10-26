// =============================================================
// 정원 아카이브 (Midterm) — 데모 스크립트
// =============================================================
// - 첫 진입 시 이 스크립트로 식물 5 · 화분 7 · 4세대 데모 정원을 만든다.
// - 같은 브라우저 탭에서는 한 번만 실행되어 새로고침해도 데모 정원이 유지된다.
// =============================================================

const DEMO_SCRIPT = String.raw`// 정원 아카이브 테스트 데이터: 식물 5 · 화분 7 · 4세대
// 12개(식물 5 + 화분 7)에 줄기 8 · 잎 8 · 꽃 7 · 열매 6 · 화분 모양 7 · 무늬 7 · 색 7가지가 모두 한 번씩은 나오게 나눠 준다.
// Midterm 페이지를 직접 열었을 때도, 과제 모음(iframe) 안에 열었을 때도 동작한다.
function seedGarden() {
  localStorage.removeItem(dataKey);
  localStorage.removeItem(shedKey());
  resetData();
  // i번째(0~11)가 받을 모양: 줄기·잎·꽃·열매·색 조합이 겹치지 않게 돌려 가며 고른다
  const look = (i) => ({
    stemType: i % 8,
    leafType: (i * 3 + 1) % 8,
    flowerType: i % 7,
    fruitType: (i + 2) % 6,
    color: COLOR_PRESETS[(i * 5) % 16][0],
    secondaryColor: COLOR_PRESETS[(i * 5) % 16][1],
  });
  const T = {};
  ["학교", "친구", "운동", "독서", "여행"].forEach((n, i) => (T[n] = createTag({ name: n, ...look(i) })));
  const tag = (...ns) => ns.map((n) => T[n].tag.id);
  const memo = (title, content, ...ns) => createMemo({ title, content, tagIds: tag(...ns) });

  // 1세대 식물 메모 (여러 태그 메모는 꽃으로 핀다)
  [["중간고사 범위 정리", "3~7장, 연습문제 위주"], ["과제 마감 메모", "인터랙티브 디자인 금요일까지"],
   ["도서관 자리", "3층 창가가 조용함"], ["시간표 바뀜", "수요일 2교시 휴강"], ["조별 회의", "역할 나누기"],
   ["노트 필기 팁", "키워드 먼저, 설명은 나중에"]].forEach(([t, c]) => memo(t, c, "학교"));
  [["생일 선물", "민지 생일 다음 주"], ["주말 약속", "토요일 홍대 2시"], ["추천받은 노래", "플레이리스트에 추가"],
   ["오랜만에 통화", "근황 이야기"]].forEach(([t, c]) => memo(t, c, "친구"));
  [["아침 러닝", "5km 32분"], ["스트레칭 루틴", "자기 전 10분"], ["헬스장 등록", "3개월권"],
   ["수영 강습", "화목 저녁 7시"], ["걸음 수", "하루 8천 보 목표"]].forEach(([t, c]) => memo(t, c, "운동"));
  [["데미안", "새는 알을 깨고 나온다"], ["읽을 책 목록", "총균쇠, 코스모스"], ["밑줄 친 문장", "천천히 가도 멈추지만 않으면"],
   ["북클럽 후기", "이번 달은 소설"]].forEach(([t, c]) => memo(t, c, "독서"));
  [["제주도 계획", "4월 초, 2박 3일"], ["여권 갱신", "만료 6개월 전"], ["가고 싶은 곳", "교토, 리스본"]].forEach(([t, c]) => memo(t, c, "여행"));
  memo("친구랑 스터디", "시험 전 주말 카페", "학교", "친구");
  memo("체육 수업", "배드민턴 수행평가", "학교", "운동");
  memo("여행 가서 읽을 책", "가볍게 에세이", "독서", "여행");
  memo("같이 등산", "다음 달 북한산", "친구", "운동", "여행");

  // 화분: 형질은 물려받되 모양은 i번째 몫으로 바꾸고, 크기 형질(굵은 줄기·큰 잎·큰 꽃)도 섞는다.
  // 화분 모양·무늬·색은 서로 다른 것으로
  const potLooks = [
    { shape: 6, pattern: 5, theme: 6 },
    { shape: 1, pattern: 6, theme: 7 },
    { shape: 7, pattern: 2, theme: 3 },
    { shape: 9, pattern: 7, theme: 8 },
    { shape: 4, pattern: 8, theme: 9 },
    { shape: 8, pattern: 3, theme: 10 },
    { shape: 10, pattern: 4, theme: 1 },
  ];
  const sizes = [
    { stemThickness: 2 },
    { flowerScale: 2 },
    { leafScale: 2 },
    {},
    { stemThickness: 2, flowerScale: 2 },
    { flowerScale: 2 },
    { stemThickness: 2 },
  ];
  let potCount = 0;
  const pot = (a, b) => {
    let i = potCount++;
    let { color, secondaryColor, ...types } = look(5 + i);
    let traits = { ...inheritTraits(a, b), ...types, primaryColor: color, secondaryColor, ...sizes[i] };
    return breed(a.id, b.id, { traits, potStyle: potLooks[i] });
  };
  const P = (n) => T[n].plant;
  // 2세대 화분
  const A = pot(P("학교"), P("친구"));
  const B = pot(P("운동"), P("독서"));
  const C = pot(P("친구"), P("여행"));
  const D = pot(P("학교"), P("운동"));
  // 3세대 화분
  const E = pot(A, B);
  const F = pot(C, P("독서"));
  // 4세대 화분
  const G = pot(E, C);

  const inPot = (pot, list) => list.forEach(([t, c]) => createMemoIn(pot.id, { title: t, content: c }));
  inPot(A, [["학교 친구들 단톡", "공지 확인"], ["점심 메뉴 투표", "학식 vs 분식"], ["동아리 신입", "다음 주 OT"]]);
  inPot(B, [["운동 후 독서", "30분씩 번갈아"], ["러닝 오디오북", "듣는 책 정리"]]);
  inPot(C, [["친구랑 여행 적금", "매달 5만원"], ["사진 공유 앨범", "제주 앨범 만들기"], ["숙소 후보", "게스트하우스 3곳"]]);
  inPot(D, [["체력장 준비", "오래달리기 연습"]]);
  inPot(E, [["스터디 겸 산책", "한 바퀴 돌고 토론"], ["독서 모임 후 운동", "공원 걷기"]]);
  inPot(F, [["여행 북클럽", "여행 에세이만 읽기"], ["기차에서 읽을 책", "단편집"]]);
  inPot(G, [["졸업 여행 계획", "다 같이 책 한 권씩 들고 등산 겸 여행"]]);
  // 포대 자리를 먼저 정해 두면 새로고침 뒤 식물들이 포대를 피해 심긴다
  seeds = [];
  sack.pos = { x: 20, d: 0 };
  saveShed();
  location.reload();
}
{
  const frame = document.getElementById("viewer");
  const app = typeof dataKey === "undefined" && frame ? frame.contentWindow : window;
  if (app.eval("typeof dataKey") === "undefined")
    console.error("Midterm 화면이 열려 있지 않아요. 메뉴에서 Midterm을 먼저 열어 주세요.");
  else app.eval("(" + seedGarden + ")()");
}`;

const DEMO_SESSION_KEY = "midterm-garden-demo-seeded";

// 기존 콘솔용 시드 스크립트를 그대로 실행한다. 스크립트 안에서 저장 후 한 번 새로고침한다.
function seedDemoGardenOnce() {
  if (sessionStorage.getItem(DEMO_SESSION_KEY)) return false;
  sessionStorage.setItem(DEMO_SESSION_KEY, "true");
  eval(DEMO_SCRIPT);
  return true;
}
