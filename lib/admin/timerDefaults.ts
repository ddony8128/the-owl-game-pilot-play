// 타이머 기본 시간(초). GM 조정값(game_state.timer_config)이 없을 때 쓰인다.
export const DEFENSE_TIMER_DEFAULT_SECONDS = 5 * 60;

export const MAFIA_PHASE_DEFAULTS: Record<string, number | null> = {
  prepare: null,
  auction: 3 * 60,
  trade: 10 * 60,
  apply: null,
  vote: 5 * 60,
  end: null,
};

export const MAFIA_TIMED_PHASES = ["auction", "trade", "vote"] as const;
