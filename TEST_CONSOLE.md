# 테스트 콘솔 사용 설명서 (`/test`)

부엉이 게임을 **혼자서 여러 탭(플레이어 N명 + GM)으로 1인 다역 테스트 플레이**하기 위한 도구입니다.
실제 게임과 **같은 백엔드·같은 DB·같은 규칙 API**를 그대로 사용하므로, 목(mock)이 아니라 진짜 게임이 돌아갑니다.

> 게임 순서: **1게임 이상교통(방탈출) → 2게임 디펜스 딜레마(자원관리/협력·배신) → 3게임 자본주의 마피아(주식)**

---

## 1. 동작 원리 (왜 이게 되는가)

평소엔 두 가지가 1인 테스트를 막습니다. 테스트 콘솔은 이 둘을 우회합니다.

1. **닉네임 정체성이 탭마다 공유됨**
   원래 닉네임은 `localStorage["owlgame:nickname"]` 한 칸에 저장돼, 같은 브라우저의 모든 탭이 같은 플레이어가 됩니다.
   → 플레이 페이지를 **`?as=<닉네임>`** 로 열면, 그 탭은 `sessionStorage`(탭 단위)에 정체성을 저장해 **탭마다 다른 플레이어**가 됩니다.
   예) `/subway?as=철수` · `/mafia?as=영희` 를 각각 다른 탭에 → 독립 플레이어.
   `?as=` 가 없으면 기존 localStorage 동작 그대로라 **실제 이벤트엔 영향 없음**.

2. **로그인은 "GM이 미리 등록한 닉네임"만 허용**
   → 콘솔의 **플레이어 생성** 버튼이 `players` 테이블에 행을 만들어 줍니다.

---

## 2. 환경 변수 설정

`.env.local` (또는 Vercel 환경변수)에 아래를 설정합니다.

```bash
SUPABASE_URL=...                      # 서버 전용
SUPABASE_SERVICE_KEY=...              # 서버 전용 service role key

# 테스트 콘솔/파괴적 API 활성화 (이게 없으면 생성/초기화 API가 403)
ENABLE_TEST_CONSOLE=1                 # 서버 가드
NEXT_PUBLIC_ENABLE_TEST_CONSOLE=1     # /test 화면 경고 숨김용
```

> ⚠️ **실제 이벤트(본 배포)에서는 이 두 값을 절대 설정하지 마세요.** 설정하지 않으면 `/api/test/*`
> 가 전부 403으로 막혀 DB가 실수로 초기화되지 않습니다.

---

## 3. 사용 순서

브라우저에서 **`/test`** 접속.

1. **① 게임 시작** — 진행할 게임을 눌러 `active_game` 을 설정 (예: `이상교통`).
2. **② 플레이어 생성** — 단건(`철수`) 또는 일괄(`테스터1`~`테스터6`).
3. **③ 플레이어 입장** — 각 플레이어 줄의 게임 버튼을 누르면 **새 탭**에서 그 플레이어로 입장 (`?as=`).
   여러 명을 테스트하려면 여러 버튼을 눌러 탭을 여러 개 띄우세요.
4. **④ GM 대시보드** — GM 탭을 따로 띄워 페이즈 전환·로그·자산 확인.
5. **⑤ DB 초기화** — 판을 다시 시작할 때.

### 게임별 테스트 흐름

- **1게임 이상교통**: 거의 솔로로 완결됩니다. `이상교통` 시작 → 플레이어 1명 입장 → 출구 찾기(앞/뒤 이동, 10초 룰) → 8번 출구 도달까지 그대로 검증 가능.
- **2게임 디펜스 / 3게임 마피아**: 멀티 + 라운드/페이즈 게임입니다.
  플레이어 탭 여러 개 + **GM 탭에서 페이즈/라운드 전환**을 직접 눌러가며 한 바퀴를 돌립니다.
  - 마피아: GM 마피아 대시보드에서 `prepare → auction → trade → apply → vote → end` 순으로 넘기면, 전환 시점에 자산·주가·정산이 실제로 계산됩니다.
  - 디펜스: GM 디펜스 대시보드에서 라운드를 올리면 몬스터 스폰·카드·점수가 계산됩니다. 빔 프로젝터용 보드는 `디펜스 보드(빔)` 링크.

---

## 4. DB 초기화 — 무엇이 지워지고 무엇이 복원되나 (중요)

초기화는 **"전부 truncate"가 아닙니다.** 일부 테이블은 행을 지우면 게임이 **다시 시작조차 안 됩니다**(앱이 그 행을 자동으로 다시 만들지 않음). 그래서 초기화는 **런타임은 삭제, 설정/시드는 초깃값으로 복원(upsert)** 합니다.

| 구분 | 테이블 | 처리 |
|---|---|---|
| 🟢 런타임 (삭제 OK) | `subway_player_state/_events`, `subway_reports`, `mafia_actions`, `mafia_player_state`, `mafia_player_snapshots`, `mafia_votes`, `mafia_public_logs`, `mafia_ability_results`, `mafia_stock_history`, `defense_monster_instance/_snapshot`, `defense_card_state`, `defense_action`, `defense_score/_snapshot`, `defense_player_log`, `player_votes` | **DELETE** |
| 🔴 싱글톤 설정 (지우면 게임 부팅 불가) | `game_state`(id=1), `mafia_phase_state`, `defense_phase_state` | **초깃값 upsert** (`ready` / `round 0·prepare` / `round 0`) |
| 🟠 시드 | `rules_state`(규칙 행), `mafia_stock_state`(주가), `defense_monster_count` | `rules_state`는 행 보존 + 전부 닫기, 나머지는 초깃값 upsert |
| ⚫ 플레이어 | `players` | **전체 초기화에서만** 삭제 |

### 초기화 버튼 3종

- **게임만 초기화** (`subway`/`defense`/`mafia`/`vote`): 그 게임 런타임만 삭제 + 해당 설정 초기화. **플레이어 유지.**
- **전체 런타임 초기화**: 모든 게임 런타임 삭제 + 전체 설정 초기화. **플레이어 유지.** (같은 인원으로 처음부터 다시)
- **⚠ 전체 초기화 (플레이어 포함)**: 위 + `players` 까지 삭제. 완전 clean slate. 설정/시드는 초깃값으로 복원되어 곧바로 다시 시작 가능.

> API: `POST /api/test/reset` `{ scope: "game"|"runtime"|"all", game? }`

---

## 5. 이 방식으로 검증되는 것 / 안 되는 것

**✅ 완전히 검증 가능** — 웹으로 구현된 게임 로직·플로우·페이즈 전환·자산/주가/투표/정산 전부. 판마다 초기화 후 반복.

**⚠️ 본질적으로 이 방식으론 안 됨 (코드 문제 아님)**

- **1게임의 오프라인/물리 요소** — 아래 6절 참고.
- **GM의 구두 판정·연출·타이밍** (사람 몫).
- **N명 동시 입력의 실시간 부하감** — 1인이 순차로 누르므로 "로직/흐름"은 되지만 "동시성 스트레스"는 아님. (폴링 구조라 실제 충돌 위험은 낮음.)

---

## 6. 1게임 오프라인 공간/물리 요소 (현장 세팅 안내)

1게임 이상교통은 **웹(출구 찾기) + 오프라인 공간(방탈출형 단서)** 의 결합입니다.
웹 부분은 테스트 콘솔로 100% 검증되지만, 아래 인쇄물·단서는 **현장에 직접 출력·부착·은닉**해야 완성됩니다.
(기존 와쳐 형식처럼 서랍·소품 사이에 숨기는 방식이 적합합니다.)

저장소에 준비된 인쇄 자산 (`artwork/print/`, `artwork/rulebook_*/`):

| 자산 | 파일 | 용도(현장 배치) |
|---|---|---|
| 수배범 포스터 | `print/wanted.pdf` | 현장에 게시 → 플레이어가 수배범 신고(비밀 URL `/metropolitan/police/3%52jfk3`)로 연결 |
| 현실세계 단서 | `print/real_1~4.pdf` | "진짜 세계" 장소 단서로 곳곳에 부착/은닉 |
| 히든피스 단서 | `print/hidden_1~2.pdf` | 히든 피스 1·2 풀이용 (세계관 연결) |
| 룰북 QR | `rulebook_2nd/*.pdf`, `rulebook_1st/QR_set.pdf` | QR을 인쇄해 두면 `/rules`의 룰북 PDF로 연결 |
| 정보 카드 / 번호 부엉이 / 이름표 | `print/info_cards.pdf`, `print/number_owls.pdf`, `print/player_*/이름표.pdf` | 플레이어 식별·세계관 소품 |
| 결승 상품 카드 | `print/achilles_prize.pdf`, `minerva_prize.pdf`, `odysseus_prize.pdf` | 결승/시상 연출용 |

> 📌 **기획서에서 확정해 채울 것** (Notion 기획서 기준):
> 각 인쇄물의 **정확한 부착 위치·은닉 방식·공개 타이밍**, 현장 공간 동선, GM이 트리거하는 연출(놀래키기 등) 순서.
> — 위 표는 저장소 자산에서 역으로 정리한 초안이며, 기획서의 현장 운영 시나리오로 보강이 필요합니다.

---

## 7. 배포 (브랜치 분리)

- 이 작업은 **`test-console`** 브랜치에 있습니다. (`main` = 실제 이벤트용 원본)
- Vercel에서 이 저장소를 import → Production/Preview Branch 를 `test-console` 로 지정,
  환경변수에 `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ENABLE_TEST_CONSOLE=1`, `NEXT_PUBLIC_ENABLE_TEST_CONSOLE=1` 설정.
- 배포 URL의 **`/test`** 로 접속해 테스트.
- 본 이벤트 배포(`main`)에는 위 두 `ENABLE_*` 값을 넣지 않습니다 → 파괴적 API 차단.

---

## 8. 추가된 파일

```
lib/test/guard.ts                 서버 가드(ENABLE_TEST_CONSOLE)
lib/hooks/usePlayerAuth.ts        (수정) ?as= + sessionStorage 탭별 정체성
app/api/test/players/route.ts     POST 플레이어 생성(단건/다건/일괄)
app/api/test/reset/route.ts       POST 초기화(game|runtime|all) — 위 4절 분류대로
app/api/test/start-game/route.ts  POST active_game 설정 헬퍼
app/test/page.tsx                 테스트 콘솔 UI
```
