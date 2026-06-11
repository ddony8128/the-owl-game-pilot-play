# The Owl Game : Pilot Program

Next.js(App Router)와 Supabase를 사용해 진행하는 **The Owl Game 파일럿 프로그램**의 플레이어 UI 및 GM 대시보드 구현체입니다.  
도메인은 `https://owlgame.perfect.ai.kr`을 기준으로 하며, 모든 플레이어 라우트는 루트(`/`) 기준입니다.

---

## 1. 기술 스택 & 구조

- **Framework**: Next.js(App Router)
- **언어**: TypeScript
- **스타일**: Tailwind CSS v4(애플리케이션 스타일 유틸 클래스로 사용)
- **데이터**: Supabase(PostgreSQL + `@supabase/supabase-js`)
  - **접근 정책**: Supabase는 **서버 환경에서만 직접 접근**합니다.
    - 서버 전용 클라이언트: `lib/supabase/server.ts` (`SUPABASE_SERVICE_KEY` 사용)
    - 클라이언트 컴포넌트/훅에서는 이 클라이언트로부터 파생된 데이터만 사용
- **상태 관리**
  - 서버 상태: Supabase 쿼리 + React 훅(`usePlayerAuth`, `useGameState` 등) 내 비동기 호출
  - 클라이언트 상태: React `useState` / 타이머·이펙트 기반 훅(`useCountdown`, `HiddenPieceModal` 등)
  - 닉네임: LocalStorage(`owlgame:nickname`)
  - **API 레이어**: 모든 클라이언트 페이지/훅은 **Next.js Route Handler (`app/api/**`)를 통해서만\*\* Supabase 데이터에 접근합니다.

폴더 구조(핵심만):

- `app/`
  - `page.tsx` – `/intro`로 리다이렉트
  - `intro/` – 인트로 및 히든 피스
  - `rules/`, `rules/[ruleKey]/`
  - `locked/`, `ask/`
  - `subway/`, `subway/end/`
  - `metropolitan/police/3Rjfk3/`
  - `mafia/`
  - `vote/`
  - `quizshow/`
  - `dashboard/x9a2k7/*` – GM 대시보드(난수형 슬러그 고정)
- `lib/`
  - `supabase/server.ts` – 서버용 Supabase 인스턴스(서비스 키, 서버 전용)
  - `hooks/` – 공통 훅(`usePlayerAuth`, `useGameState`, `useCountdown`, `usePageLock`)
  - `types.ts` – Supabase 테이블 타입들
- `components/`
  - `PageGuard`, `LoadingScreen`, `ErrorMessage`, `TabLayout`
  - `HiddenPieceModal`

---

## 2. 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 생성하고, 아래 값을 설정해 주세요.

```bash
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_KEY=your-service-role-key

# 선택: 설문/피드백 폼 URL
NEXT_PUBLIC_ASK_FORM_URL=https://your-google-form-url
```

- `SUPABASE_SERVICE_KEY`는 **서버 전용 service role key**로, `lib/supabase/server.ts`에서만 사용합니다.
- 클라이언트 코드에서는 Supabase 인스턴스를 직접 생성하지 않으며, 훅/페이지를 통해 서버에서 가져온 데이터만 사용합니다.
- `NEXT_PUBLIC_ASK_FORM_URL`은 `/ask` 진입 시 리다이렉트되는 설문/피드백 폼 주소입니다.

### 2.1 서버 API 라우트 개요

주요 서버 API는 아래와 같습니다. (모두 `app/api/**/route.ts`로 구현되어 있습니다.)

- **공통 상태/인증**
  - `GET /api/state/game` – `game_state(id=1)` + 전체 `rules_state` 조회
  - `POST /api/auth/login` – 닉네임 검증 및 플레이어 존재 여부 확인
  - `POST /api/gm/game/activate` – 현재 진행 게임(`game_state.active_game`) 변경
  - `POST /api/gm/rules/open` – 특정 `rule_key`의 공개 여부 토글
- **1게임 – 이상교통(Subway)**
  - `GET /api/subway/state` – `?nickname=` 쿼리로 플레이어별 상태 조회 / `?all=1` 로 전체 플레이어 상태 조회
  - `POST /api/subway/move` – `{ nickname, direction }`을 받아 이동/정답 판정 및 `subway_players` 업데이트
  - `POST /api/subway/report` – 수배범 신고 내용을 `subway_reports`에 기록
  - `POST /api/gm/subway/scare` – GM이 플레이어에게 놀래키기 연출 트리거
- **2게임 – 자본주의 마피아(Mafia)**
  - `GET /api/mafia/state` – `?nickname=` 으로 플레이어 상태 조회 / `?all=1` 로 GM용 전체 상태 조회
  - `POST /api/mafia/action` – `{ nickname, type, payload }`를 `mafia_actions`에 기록
  - `POST /api/mafia/vote` – `{ nickname, target_id, vote_count }`를 `mafia_votes`에 기록
  - `POST /api/gm/mafia/advance-phase` – 현재 라운드/페이즈를 전환하고, `mafia_player_snapshots`에 스냅샷 저장
  - `POST /api/gm/logs/add` – GM 공개 로그를 `mafia_public_logs`에 추가

---

## 3. 플레이어 라우트 상세

### 3.1 `/intro` – 메인 인트로 + 히든 피스

구현 파일: `app/intro/page.tsx`

- **닉네임 인증**
  - 최초 진입 시 LocalStorage에 `owlgame:nickname`이 없으면 **닉네임 입력 모달** 노출
  - 입력 후 Supabase `players` 테이블에서 `nickname` 검증
    - 존재하면 LocalStorage에 저장 후 인트로 진입
    - 없으면 에러 메시지 표시(재입력 요청)
- **UI 요소**
  - 태양 슬라이더: `sunLevel(0~100)` 값으로 밝기 조절
  - 부엉이: 좌/우 날개 클릭으로 각각 토글
  - `규칙 보기` 버튼 → `/rules`로 이동
  - 메인 액션 버튼: `game_state.active_game`에 따라 문구 및 이동 경로 변경
  - `subway` → `/subway`
  - `mafia_tutorial`/`mafia` → `/mafia`
  - `defense` → `/defense`
  - `vote` → `/vote`
  - `quiz` → `/quizshow`
    - 그 외(`ready` 등) → 비활성/“곧 시작됩니다”
- **히든 피스**
  - 조건: `sunLevel === 0` && `owlLeftWing === true` && `owlRightWing === true`
  - 조건 만족 시 `HiddenPieceModal` 모달 오픈
    - 부엉이 이미지 5개가 1초 간격으로 순차 표시
    - 코드 입력 후 제출
      - 오답: “틀렸습니다” + 인트로 상태 리셋
      - 정답: GM에게 외칠 문구를 보여주고 닫기

### 3.2 `/rules` – 규칙 리스트

구현 파일: `app/rules/page.tsx`

- `rules_state` 테이블에서 `is_open = true`인 rule만 버튼으로 노출
- rule 키 예시: `intro`, `subway`, `hidden_piece`, `mafia`, `defense`, `quiz`, `quiz_questions`
- 버튼 동작
  - `intro` → 정적 PDF 룰북 `/rulebook/intro.pdf` 새 창으로 열기
  - `hidden_piece` → `/rulebook/hidden.pdf`
  - `subway` → `/rulebook/subway.pdf`
  - `mafia` → `/rulebook/mafia.pdf`
  - `defense` → `/rulebook/defense.pdf` (더미 주소)
  - `quiz` → `/rulebook/quizshow.pdf`
  - `quiz_questions` → `/rules/quiz-questions` 페이지로 이동

### 3.3 `/rules/quiz-questions` – 퀴즈 문제 목록

구현 파일: `app/rules/quiz-questions/page.tsx`

- 공개용 API `GET /api/quiz/questions-list`를 호출해 `quiz_questions` 테이블에서 **id, question만** 로딩
- 각 문제를 `Q{id}. {question}` 형식의 카드로 보여주며, 정답/보기(`correct_answer`, `options`)는 표시하지 않음
- 하단 버튼으로 `/rules` 목록으로 돌아가기

### 3.4 `/locked` – 접근 불가 페이지

구현 파일: `app/locked/page.tsx`

- 아직 열리지 않은 페이지 접근 시 진입하게 되는 잠금 페이지
- 화난 부엉이 이미지는 placeholder(원형 박스)로 표현되어 있으며, 추후 실제 이미지로 교체 가능
- 뒤로가기/메인 이동 버튼 없이 안내 문구만 제공

### 3.5 `/ask` – 설문/피드백 폼 리다이렉트

구현 파일: `app/ask/page.tsx`

- 클라이언트 진입 시 `NEXT_PUBLIC_ASK_FORM_URL`로 `window.location.href` 리다이렉트
- 환경 변수가 없는 경우 안내 문구만 표시

### 3.6 1게임 – 이상교통 8번출구

#### `/subway`

구현 파일: `app/subway/page.tsx`

- `PageGuard`로 보호: `requireLogin`, `allowGames={["subway"]}`
- 플레이어 상태 로딩
  - 클라이언트는 `GET /api/subway/state?nickname=...` 호출
  - 서버에서는 `players` → `subway_players`를 조회해 현재 플레이어 상태를 반환
  - `is_finished`가 `true`면 `/subway/end`로 자동 리다이렉트
  - `exit_number`, `reset_count`, `current_location` 등을 화면에 표시
- 장소 이미지
  - 실제 이미지는 `public/subway-location/**`에 위치하며, 예시는 다음과 같습니다.
    - `01_only_door/01.png`
    - `02_food/02.png`
    - ...
  - 서버에서 무작위로 이미지를 선택하여 `current_location`에 `"{폴더}/{파일}.png"` 형식으로 저장하고,
    클라이언트는 이를 `/subway-location/${current_location}` 경로로 `next/image`를 통해 렌더링합니다.
- 이동/정답 판정 로직(`POST /api/subway/move`)
  - 요청 바디: `{ nickname, direction }` (`direction`은 `"forward" | "back" | "reset"`)
  - 서버에서 아래 규칙을 적용해 `subway_players`를 업데이트합니다.
    - **10초 룰**: 현재 장소에 도착한 지 10초 미만에 이동하면 무조건 `wrong` 처리
    - **장소 그룹별 정답 방향**
      - `01_only_door`, `02_food`, `03_capture_monster`, `05_real_world` 폴더 내 이미지:
        - **뒤로 가기(back)** → `correct`
        - **앞으로 가기(forward)** → `wrong`
      - `04_no_cap_monster`, `06_similar_real`, `07_just_go` 폴더 내 이미지:
        - **앞으로 가기(forward)** → `correct`
        - **뒤로 가기(back)** → `wrong`
    - **정답일 때**: `exit_number`를 1 증가(0 → 1 → 2 → ... → 8)
    - **오답일 때**: `exit_number`를 0으로 리셋
    - `exit_number`가 8에 도달하면 `is_finished = true`로 마킹하고 `/subway/end`로 이동
- UI
  - 상단 안내 + 현재 출구 번호
  - 중앙: 현재 장소 이미지(서버가 지정한 `current_location` 기반)
  - 하단 버튼
    - “다음 출구로 이동” → `direction="forward"`로 `/api/subway/move` 호출
    - “처음부터 다시” → `direction="reset"`로 `/api/subway/move` 호출
    - “(디버그) 놀래키기 연출 보기” → 프론트에서만 간단한 이펙트

#### `/subway/end`

구현 파일: `app/subway/end/page.tsx`

- 이상교통 게임을 마친 플레이어용 결과 화면
- “인트로로 돌아가기” 버튼 → `/intro` 리다이렉트

#### `/metropolitan/police/3Rjfk3`

구현 파일: `app/metropolitan/police/3Rjfk3/page.tsx`
(과거 `3%52jfk3` 폴더는 일부 배포 인프라가 `%52`→`R`로 정규화하여 무한
리다이렉트를 유발했으므로, `%` 없는 슬러그로 변경함. 두 형태 모두 배포에서 동작)

- 수배범 신고 페이지(비밀 URL)
- 입력
  - 닉네임 textarea (2글자 이상)
  - 내용 textarea (2글자 이상)
- 제출 시 Supabase `subway_reports`에 아래 형식으로 insert
  - `player_id`: 현재 로그인 플레이어 ID(없을 수 있음)
  - `reporter_name`: 입력 닉네임
  - `content`: 신고 내용
- 제출 후: 닫기 없는 대기 화면으로 전환 (GM이 승인/기각까지 안내)

### 3.7 2게임 – 자본주의 마피아 (`/mafia`)

구현 파일: `app/mafia/page.tsx`

- `PageGuard`로 보호: `requireLogin`, `allowGames={["mafia", "mafia_tutorial"]}`
- 초기 로딩 및 주기적 폴링
  - 클라이언트는 `GET /api/mafia/state?nickname=...` 호출
  - 서버에서 아래 테이블을 조회해 하나의 JSON으로 반환
    - `mafia_player_state` – 본인 자산/직업/보유 주식 상태
    - `mafia_stock_state` – 전체 주가 정보
    - `mafia_phase_state` – 현재 라운드 번호/페이즈
    - `mafia_public_logs` – 최근 공개 로그(예: 50건)
    - `mafia_ability_results` – 본인 능력 결과 로그
  - 클라이언트는 일정 주기로 동일 API를 폴링해 phase·현금·능력결과·투표 요약을 갱신
- 상단 공통 영역
  - 현재 라운드 번호/페이즈 (`mafia_phase_state.round_number`, `phase`)
  - `/api/gm/timers/mafia` 기반 카운트다운(페이즈 전환 시 GM API에서 자동 리셋)
- 탭 구조(`TabLayout` 사용)
  - 항상: 정보, 규칙, 주가
  - `phase='auction'`: 경매 탭 추가
  - `phase='trade' | 'apply'`: 거래, 능력사용 탭 추가
  - `phase='apply' | 'vote'`: 능력결과 탭 추가
  - `phase='vote'`: 투표 탭 추가
- 각 탭 동작 (모두 서버 API를 통해 간접적으로 DB에 기록)
  - **정보**: 보유 현금/총 자산, 보유 주식, 직업 아이콘+이름 표시
  - **규칙**: 마피아 게임 요약 텍스트
  - **주가**: `mafia_stock_state` 리스트와 회사 로고(`public/mafia/company/**`)
  - **경매**: 직업 선택 카드(UI에 직업 아이콘 사용) → 베팅 금액 입력 후 `POST /api/mafia/action` 호출 → 서버에서 `mafia_actions(action_type='bet')`로 기록
  - **거래**: 종목 키 + 수량 입력 → `POST /api/mafia/action` (`type='buy' | 'sell'`)
  - **능력사용**: 대상/내용 입력 → `POST /api/mafia/action` (`type='ability'`)
  - **능력결과**: `mafia_ability_results` 기반 개인 능력 결과 + `mafia_public_logs` 표시
  - **투표**: 대상 닉네임/표 수 입력 → `POST /api/mafia/vote` 호출(서버에서 `mafia_votes`에 기록, 잔액 검증 포함)

---

## 4. GM 대시보드 라우트

대시보드 베이스 URL: `/dashboard/x9a2k7/*`  
(파일럿용 고정 난수 슬러그이며, 별도 인증은 두지 않았습니다.)

### 4.1 레이아웃

구현 파일: `app/dashboard/x9a2k7/layout.tsx`

- 좌측 사이드바에 섹션 링크
  - 메인, 이상교통, 마피아, 퀴즈 관리, 쇼 진행
- 우측 메인 영역에 각 페이지 내용 렌더

### 4.2 `/dashboard/x9a2k7/main` – 메인

구현 파일: `app/dashboard/x9a2k7/main/page.tsx`

- `game_state.active_game` 선택 박스
  - ready / subway / mafia_tutorial / mafia / vote / survey
- `rules_state` 리스트
  - 각 `rule_key`에 대해 공개 여부 토글 체크박스
- 결승 진출자 정보(현재 버전에서는 별도 상태를 관리하지 않고, 참고용 섹션만 존재)

### 4.3 `/dashboard/x9a2k7/subway` – 이상교통 현황

구현 파일: `app/dashboard/x9a2k7/subway/page.tsx`

- `subway_players` 전체를 테이블로 표시
  - `player_id`, `exit_number`, `current_location`, `reset_count`, `is_finished`, `finished_rank`
- 카운트다운/놀래키기 트리거는 v1에서는 **프론트 표시만** 담당(실시간 동기화는 미구현)

### 4.4 `/dashboard/x9a2k7/mafia` – 마피아 관리

구현 파일: `app/dashboard/x9a2k7/mafia/page.tsx`

- 라운드/페이즈
  - `mafia_phase_state`에서 현재 `round_number`, `phase` 표시
  - `prepare`, `auction`, `trade`, `apply`, `vote`, `end` 버튼으로 페이즈 전환 (`POST /api/gm/mafia/advance-phase`)
  - 특정 전환 시(prepare→auction, auction→trade, apply→vote) `/api/gm/timers/mafia`를 통해 타이머 자동 리셋
- 자산 현황
  - `mafia_player_state` + `players`를 조인해 플레이어별 카드 표시(cash, job, is_mafia, 보유 주식, 총 자산)
- 주가
  - `mafia_stock_state`를 pill/카드 형태로 표시(회사 로고 포함)
- 라운드 로그
  - 공개 로그 입력 후 `POST /api/gm/logs/add` → `mafia_public_logs`에 insert
  - 최신 공개 로그 리스트 표시
- 라운드별 요약
  - `GET /api/gm/mafia/round-state?round=n`으로 라운드별 경매/능력/거래/투표/주가 변동을 카드 형태로 표시

---

## 5. 공통 훅 & 유틸

### 5.1 `usePlayerAuth`

경로: `lib/hooks/usePlayerAuth.ts`

- LocalStorage에서 닉네임(`owlgame:nickname`)을 읽고/설정하는 클라이언트 훅
- 서버 전용 Supabase 클라이언트(`createServerSupabaseClient`)를 통해 `players` 테이블에서 닉네임을 검증하고 플레이어 정보를 조회
  - effect 내부에서는 `setState`를 직접 호출하지 않고, `setTimeout` + async 호출 패턴으로 안전하게 상태를 갱신하도록 구성
- 반환값
  - `nickname`, `player`, `isLoading`, `error`
  - `setNickname`, `clearNickname`

### 5.2 `useGameState`

경로: `lib/hooks/useGameState.ts`

- `game_state`(id=1)와 `rules_state` 전체를 로딩
- 반환값
  - `activeGame` – 현재 전역 게임 상태
  - `rulesMap` – `{ [rule_key]: is_open }` 형태의 맵

### 5.3 `useCountdown`

경로: `lib/hooks/useCountdown.ts`

- 타깃 시각(ISO 문자열)을 받아 남은 시간을 `ms/seconds/minutes/hours` 단위로 반환
- 내부적으로 `setTimeout`/`setInterval`을 사용해 effect 본문에서는 동기 `setState`를 호출하지 않도록 구성
- 마피아/서브웨이 타이머 등에 사용 가능

### 5.4 `usePageLock` & `PageGuard`

경로: `lib/hooks/usePageLock.ts`, `components/PageGuard.tsx`

- 인자: `{ requireLogin?: boolean; allowGames?: string[]; requireFinalist?: boolean }`
- 내부적으로
  - `usePlayerAuth`로 로그인 여부/플레이어 정보 확인
  - `useGameState`로 현재 `active_game`과 규칙 상태 확인
  - 조건 미충족 시 `/locked`로 리다이렉트
- `PageGuard` 컴포넌트는 위 훅을 사용해 페이지 접근을 보호

---

## 6. 개발/실행 방법

### 6.1 의존성 설치 & 로컬 실행

```bash
npm install
npm run dev
```

- 기본 포트는 `http://localhost:3000`입니다.
- Supabase 환경 변수가 설정되어 있지 않으면 일부 페이지에서 경고/에러 메시지가 표시될 수 있습니다.

### 6.2 린트

프로젝트 전체에 ESLint가 설정되어 있습니다.

```bash
npm run lint
```

현재 기준 `app/`, `components/`, `lib/` 경로에는 린트 에러가 없도록 정리되어 있습니다.

---

## 7. 주의사항 & 확장 포인트

- 이 프로젝트는 **파일럿 이벤트**를 위한 것으로, GM 수동 운영을 전제로 합니다.
  - 예: 실시간 동기화, 자동 승패 계산, 복잡한 권한 관리는 의도적으로 제외
- 추후 확장 시 고려할 수 있는 것들
  - Supabase Realtime 또는 짧은 폴링으로 더 실시간에 가까운 상태 반영
  - RLS 정책 강화 및 API 래핑
  - 각 게임별 정교한 UI/애니메이션 및 디자인 리소스 교체

구현 세부를 변경하고 싶거나, 추가 게임/페이즈를 붙이고 싶다면 상기 구조를 기준으로 페이지/훅/대시보드 섹션을 확장하면 됩니다.
