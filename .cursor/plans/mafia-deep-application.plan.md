좋습니다. 지금까지 얘기한 내용을 **플랜 문서에 추가/보완할 수 있는 형태**로 정리해드릴게요.

아래 블록들을 `mafia-round-phase-timer-and-logs_6b53a5a9.plan.md`의 **“추가 규칙 정리” 이후**에 그대로 붙여 넣으면 됩니다.

---

### G. 직업 경매 세부 규칙 (낙찰/동점/월급쟁이)

- **낙찰 규칙 (동점 처리)**:

  - 직업별로 다음 순서로 낙찰자를 정한다.

    1. 해당 직업에 대한 모든 베팅을 `amount`별로 그룹화한다.
    2. `amount`를 내림차순으로 정렬한다.
    3. 각 `amount`에 대해, 이 금액으로 베팅한 플레이어가 **1명**이면 그 플레이어가 낙찰자다.
    4. 그 금액으로 베팅한 사람이 2명 이상이면 **다음(amount)** 로 넘어간다.
    5. 끝까지 유일한 금액이 안 나오면 이 직업은 낙찰자 없이 종료된다.

- **월급쟁이 규칙**:
  - 한 라운드의 직업 경매가 끝난 뒤:
    - **어떤 직업이든 낙찰에 성공한 플레이어** → 그 직업을 가진다.
    - **낙찰에 실패한 플레이어** (베팅했지만 안 된 사람) → 월급쟁이.
    - **어느 직업에도 베팅하지 않은 플레이어** → 월급쟁이.
    - **베팅 포기(`give_up`)를 선택한 플레이어** → 월급쟁이.
  - 구현 시:
    - `auction → trade` 전환에서 직업이 배정된 `player_id`를 모은 뒤,
    - 그 외 모든 `player_id`에게 `job: "salaryman"`을 부여하는 방식으로 처리한다.

---

### H. 능력 UI/검증 타입 설계

- **능력 payload 타입 설계 예시** (`lib/mafia/abilities.ts` 등):
  ```ts
  export type MafiaAbilityPayload =
    | { job: "up_manipulator"; stock_key: string } // 국채 제외 종목 1개
    | { job: "down_manipulator"; stock_key: string } // 국채 제외 종목 1개
    | { job: "robber"; targets: [string, string] } // 대상 player_id 또는 nickname 2명
    | { job: "police"; target: string | null } // 조사 대상 (없으면 null)
    | { job: "tax_auditor"; target: string } // 세무조사 대상 1명
    | { job: "broker"; stock_key: string } // 국채 제외 종목 1개
    | { job: "ceo" }
    | { job: "mayor"; ticket_price: 1 | 2 | 3 } // 해당 라운드 표 가격
    | { job: "salaryman" };
  ```

- **클라이언트 UI**:
  - `MafiaAbilityTab`에서 `job`에 따라 필요한 입력 UI를 분기한다.
    - `up_manipulator`, `down_manipulator`, `broker`:
      - **국채를 제외한** 종목만 드롭다운에 노출.
    - `robber`:
      - 현재 라운드 플레이어 목록에서 **자기 자신을 제외한 2명 선택** UI.
    - `mayor`:
      - 1, 2, 3 중 하나를 고르는 라디오 버튼/셀렉트 박스.
    - 등등.
  - 제출 시 `/api/mafia/action`의 `payload`를 위 타입에 맞는 형태로 생성하고,
    - 필수 필드 누락/형식 오류는 클라이언트에서 사전 검증한다.
- **서버**:
  - `advance-phase`(특히 `trade → apply`, `apply → vote`, `vote → end`)에서
    - `payload`를 `MafiaAbilityPayload`로 좁혀 사용하여 직업별 로직을 안전하게 분기한다.
  - 국채는 능력 대상에서 제외되므로, 서버 쪽에서도 `stock_key === "국채"` 인 경우 무시하거나 에러 처리해 이중 방어를 둔다.

---

### I. 보유 주식/현금 상태 구조 (`mafia_player_state.stocks`)

- **DDL 재확인**:
  ```sql
  create table mafia_player_state (
    player_id uuid primary key references players(id),
    cash int not null,
    stocks jsonb,
    is_mafia boolean default false,
    job text,
    updated_at timestamptz default now()
  );
  ```

- **타입 설계** (`lib/types.ts` 확장 예시):
  ```ts
  export type MafiaStocksHolding = {
    [stockKey: string]: {
      amount: number; // 보유 수량
    };
  };
  
  export type MafiaPlayerState = {
    player_id: string;
    cash: number;
    is_mafia: boolean;
    job: string | null;
    stocks: MafiaStocksHolding | null;
    updated_at: string;
  };
  ```

- **거래 반영**:
  - `trade` 페이즈에서 `mafia_actions`의 `buy`/`sell` 내역을 모아,
    - `stocks[stock_key].amount += buyAmount - sellAmount `방식으로 `stocks`를 업데이트한다.
  - 국채는 **일반 매수/매도 및 최종 자산 계산 시 포함**된다.
- **최종 자산 계산**:

  - 5라운드 종료 후, 각 플레이어의 최종 자산:
    - `Σ(모든 stock_key에 대해 amount × 마지막 price)` + `cash`.
  - 동점인 경우:

    1. `cash`가 많은 플레이어 우선.
    2. 그래도 동점이면 지하철(1게임) `finished_rank`가 더 좋은 플레이어 우선.

---

### J. 마피아 타이머 구현 정리 (중복 제거)

- **구현 방향**:
  - `app/api/gm/timers/mafia/route.ts`는 **단일 Timer 구현만** 유지한다.
  - 파일 안에 있던 두 번째 구현(`PHASE_DEFAULTS`, `currentPhaseKey`를 사용하는 쪽)을 기준으로 삼고,
    - 상단의 오래된 `TimerState`/`mafiaTimer`/`recomputeRemaining`/`GET`/`POST` 블록은 제거한다.
- **선호 구현 스케치**:
  ```ts
  type TimerState = {
    remainingSeconds: number;
    isRunning: boolean;
    targetEpochMs: number | null;
  };
  
  const PHASE_DEFAULTS: Record<string, number> = {
    auction: 3 * 60,
    trade: 10 * 60,
    apply: 0,
    vote: 5 * 60,
    end: 0,
  };
  
  let mafiaTimer: TimerState = {
    remainingSeconds: 0,
    isRunning: false,
    targetEpochMs: null,
  };
  let currentPhaseKey: string | null = null;
  
  function recomputeRemaining(state: TimerState) {
    /* ... */
  }
  
  export async function GET() {
    /* ... */
  }
  export async function POST(request: Request) {
    /* ... */
  }
  ```

- **의도**:
  - 빌드 오류(중복 정의)를 방지하고,
  - 페이즈별 기본 시간(경매 3분 / 거래 10분 / 투표 5분)을 서버에서 일관되게 관리한다.