export type DefenseMonsterDefinition = {
  id: number;
  name: string;
  description: string;
  maxHp: number;
  baseTime: number;
  points: number;
  image: string;
};

export const DEFENSE_MONSTERS: DefenseMonsterDefinition[] = [
  {
    id: 1,
    points: 2,
    maxHp: 3,
    baseTime: 1,
    name: "경계병",
    description: "가장 약하지만 빠르게 다가오는 기본 몬스터입니다.",
    image: "/defense/monster_1.png",
  },
  {
    id: 2,
    points: 6,
    maxHp: 7,
    baseTime: 2,
    name: "돌격병",
    description: "적당한 체력과 보상을 가진 전열 몬스터입니다.",
    image: "/defense/monster_2.png",
  },
  {
    id: 3,
    points: 8,
    maxHp: 9,
    baseTime: 2,
    name: "중갑병",
    description: "높은 체력으로 장기전에 강한 몬스터입니다.",
    image: "/defense/monster_3.png",
  },
  {
    id: 4,
    points: 10,
    maxHp: 10,
    baseTime: 3,
    name: "파수꾼",
    description: "공수 밸런스가 좋은 중간 보스급 몬스터입니다.",
    image: "/defense/monster_4.png",
  },
  {
    id: 5,
    points: 12,
    maxHp: 12,
    baseTime: 3,
    name: "정예병",
    description: "높은 체력과 보상을 가진 강력한 몬스터입니다.",
    image: "/defense/monster_5.png",
  },
  {
    id: 6,
    points: 18,
    maxHp: 15,
    baseTime: 4,
    name: "보스 몬스터",
    description: "최대 체력과 보상을 가진 최종 보스급 몬스터입니다.",
    image: "/defense/monster_6.png",
  },
];

export const DEFENSE_MONSTERS_BY_ID: Record<number, DefenseMonsterDefinition> =
  DEFENSE_MONSTERS.reduce(
    (acc, m) => {
      acc[m.id] = m;
      return acc;
    },
    {} as Record<number, DefenseMonsterDefinition>
  );


