// 주요 테이블에서 사용하는 필드 위주로 타입 정의 (최종 DDL 기준)

// 공통
export type Player = {
  id: string;
  nickname: string;
  created_at: string;
};

export type GameState = {
  id: number;
  active_game: string; // 'ready' | 'subway' | 'mafia_tutorial' | 'mafia' | 'defense' | 'vote' | 'survey'
  updated_at: string;
  timer_start: boolean | null;
  timer_start_at: string | null;
  pause_at: string | null;
};

export type RulesState = {
  rule_key: string; // intro | subway | hidden_piece | mafia ...
  is_open: boolean;
  updated_at: string;
};

// 1게임 – 이상교통
export type SubwayPlayerState = {
  player_id: string;
  exit_number: number;
  current_location: string | null;
  reset_count: number;
  is_finished: boolean;
  finished_rank: number | null;
  updated_at: string;
  nickname?: string | null; // GM 대시보드 등에서 보여주기 위한 용도
};

export type SubwayRuleClient = {
  id: number;
  title: string;
  body: string;
  conditionDescription: string;
};

export type SubwayOtherPlayerClient = {
  playerId: string;
  nickname: string | null;
};

export type SubwayPlayerStateClient = {
  playerId: string;
  exitNumber: number;
  currentLocation: string | null;
  timerStart: boolean;
  timerStartAt: string | null;
  pauseAt: string | null;
  totalSeconds: number;
  resetCount: number;
  rules: SubwayRuleClient[];
  othersAtSameLocation: SubwayOtherPlayerClient[];
  isFinished: boolean;
  finishedRank: number | null;
};

export type SubwayPlayerEvent = {
  id: string;
  player_id: string | null;
  event_type: string;
  event_value: unknown;
  created_at: string;
};

export type SubwayReport = {
  id: string;
  player_id: string | null;
  reporter_name: string;
  content: string;
  status: "pending" | "approved" | "rejected" | string;
  created_at: string;
  decided_at: string | null;
};

// 2게임 – 자본주의 마피아
export type MafiaPhase =
  | "prepare"
  | "auction"
  | "trade"
  | "apply"
  | "vote"
  | "end";

export type MafiaPhaseState = {
  id: number;
  round_number: number;
  phase: MafiaPhase;
  updated_at: string;
};

export type MafiaStocksHolding = {
  [stockKey: string]: {
    amount: number;
  };
};

export type MafiaAction = {
  id: string;
  player_id: string | null;
  round_number: number;
  phase: string;
  action_type: string; // 'bid' | 'trade' | 'ability' | 'vote' ...
  payload: Record<string, unknown>;
  created_at: string;
};

export type MafiaStockState = {
  stock_key: string;
  price: number;
  updated_at: string;
};

export type MafiaStockHistory = {
  id: string;
  stock_key: string;
  round_number: number;
  price_before: number | null;
  price_after: number | null;
  meta: Record<string, unknown>;
  created_at: string;
};

export type MafiaPlayerState = {
  player_id: string;
  cash: number;
  is_mafia: boolean;
  job: string | null;
  stocks: MafiaStocksHolding | null;
  updated_at: string;
};

export type MafiaPlayerSnapshot = {
  id: string;
  player_id: string;
  round_number: number | null;
  phase: string | null;
  cash: number | null;
  stocks: Record<string, unknown> | null;
  job: string | null;
  created_at: string;
};

export type MafiaVote = {
  id: string;
  round_number: number | null;
  voter_id: string | null;
  target_id: string | null;
  vote_count: number | null;
  unit_price: number | null;
  created_at: string;
};

export type MafiaLog = {
  id: string;
  content: string;
  created_at: string;
};

export type MafiaAbilityResult = {
  id: string;
  player_id: string;
  round_number: number | null;
  phase: string | null; // "apply" | "vote" 정도가 들어옴
  job: string | null; // ceo | salaryman | broker | robber | police | tax_auditor | mayor ...
  category: string | null; // "salary" | "broker_bonus" | ...
  message: string;
  payload: Record<string, unknown> | null;
  created_at: string;
};

export type PlayerVote = {
  id: string;
  voter_id: string | null;
  topic: string;
  target_id: string | null;
  reason: string;
  created_at: string;
};

export type ApiResult<T> =
  | { data: T; error: null }
  | { data: null; error: string };

// 3게임 – 디펜스 딜레마
export type DefensePhaseState = {
  id: number;
  round: number;
  updated_at: string;
};

export type DefenseMonsterCount = {
  id: number; // 1~6
  count: number;
};

export type DefenseMonsterInstanceStatus = "active" | "defeated" | "expired";

export type DefenseMonsterInstance = {
  id: string; // uuid
  monster_id: number; // 1~6
  current_hp: number;
  remaining_time: number;
  slot_index: number; // 0~3
  status: DefenseMonsterInstanceStatus;
  spawned_round: number;
  removed_round: number | null;
};

export type DefenseMonsterSnapshot = {
  instance_id: string;
  monster_id: number;
  round: number; // 1~12
  current_hp: number;
  remaining_time: number;
  slot_index: number;
};

export type DefenseCardState = {
  player_id: string;
  card_slot: number; // 1~4
  card_value: number;
  is_active: boolean;
};

export type DefenseActionType = "combat" | "rest" | "training";

export type DefenseAction = {
  round: number; // 1~12
  player_id: string;
  action_type: DefenseActionType;
  target_monster_id: string | null;
  used_card_slot: number | null;
  training_from_slot: number | null;
  training_to_slot: number | null;
  rest_card_slot: string | null;
};

export type DefenseScore = {
  player_id: string;
  points: number;
};

export type DefenseScoreSnapshot = {
  player_id: string;
  round: number; // 1~12
  points: number;
};

export type DefensePlayerLog = {
  player_id: string;
  round: number; // 1~12
  log: string;
  created_at: string;
};
