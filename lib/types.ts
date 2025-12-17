// 주요 테이블에서 사용하는 필드 위주로 타입 정의 (최종 DDL 기준)

// 공통
export type Player = {
  id: string;
  nickname: string;
  is_finalist: boolean | null;
  created_at: string;
};

export type GameState = {
  id: number;
  active_game: string; // 'ready' | 'subway' | 'mafia_tutorial' | 'mafia' | 'vote' | 'quiz' | 'survey'
  updated_at: string;
};

export type RulesState = {
  rule_key: string; // intro | subway | hidden_piece | mafia | quiz | quiz_questions ...
  is_open: boolean;
  updated_at: string;
};

// 1게임 – 이상교통
export type SubwayPlayerState = {
  player_id: string;
  exit_number: number;
  current_location: string | null;
  reset_count: number;
  scare_status: boolean;
  is_finished: boolean;
  finished_rank: number | null;
  updated_at: string;
  nickname?: string | null; // GM 대시보드 등에서 보여주기 위한 용도
};

// 기존 코드와의 호환용 별칭
export type SubwayPlayer = SubwayPlayerState;

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

// 기존 코드와의 호환용 별칭
export type MafiaPlayer = MafiaPlayerState;

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

// 3게임 – 퀴즈쇼
export type QuizPhaseState = {
  id: number;
  current_question: number | null;
  updated_at: string;
};

export type QuizQuestion = {
  id: number;
  question: string;
  options: unknown | null; // jsonb
  correct_answer: string | null;
  is_open: boolean;
  updated_at: string;
};

export type QuizPlayerState = {
  player_id: string;
  score: number;
  chances: Record<string, unknown> | null; // { peek: boolean, bet: boolean, safe: boolean }
  updated_at: string;
};

// 기존 코드와의 호환용 별칭
export type QuizPlayer = QuizPlayerState;

export type QuizEvent = {
  id: string;
  player_id: string | null;
  question_id: number | null;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type QuizSubmission = {
  id: number;
  player_id: string | null;
  question_id: number | null;
  answer: string;
  used_chance: string | null;
  result: string | null;
  created_at: string;
};

// 3게임 전 투표
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
