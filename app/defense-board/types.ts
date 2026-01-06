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


