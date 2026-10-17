export type BoardMonster = {
  instanceId: string;
  monsterId: number;
  slotIndex: number;
  name: string;
  description: string;
  maxHp: number;
  baseTime: number;
  points: number;
  image: string;
  snapshotHp: number;
  snapshotRemainingTime: number;
  statusAfter: "active" | "defeated" | "expired" | "missing";
  hpAfter: number | null;
  remainingTimeAfter: number | null;
};

export type BoardApiResponse = {
  round: number;
  monsters: BoardMonster[];
};

/** /api/defense/board-scores 의 한 줄 — rank·tieCount 는 lib/defense/rank.ts 가 매긴다 */
export type BoardScore = {
  playerId: string;
  nickname: string | null;
  points: number;
  damage: number;
  rank: number;
  tieCount: number;
};

export type BoardScoresResponse = {
  round: number;
  scores: BoardScore[];
};

/** /api/defense/board-phase */
export type BoardPhaseResponse = {
  round: number;
  prevRound?: number;
  endedEarlyFrom?: number | null;
  updatedAt: string | null;
  roomStatus: "active" | "ended" | null;
  playerCount: number;
  serverNow: string;
};
