export type DefenseMonsterDefinition = {
  id: number;
  name: string;
  description: string;
  maxHp: number;
  baseTime: number;
  points: number;
  baseCount: number;
  image: string;
};

export const DEFENSE_MONSTERS: DefenseMonsterDefinition[] = [
  {
    id: 1,
    points: 2,
    maxHp: 1,
    baseTime: 2,
    baseCount: 6,
    name: "스컬 스파이더",
    description:
      "빠르고 작고 징그럽습니다. 실험에 쓰고 남은 두개골들로 만들었다고 합니다.",
    image: "/defense/monster_1.png",
  },
  {
    id: 2,
    points: 3,
    maxHp: 5,
    baseTime: 5,
    baseCount: 4,
    name: "종이 연구원",
    description:
      "전에 봤던 수배범입니다! 괴물 제작 연구를 하며, 그림으로 스스로를 복제합니다.",
    image: "/defense/monster_2.png",
  },
  {
    id: 3,
    points: 9,
    maxHp: 9,
    baseTime: 5,
    baseCount: 5,
    name: "복싱 팩맨",
    description: "눈이 마주치면 남녀노소 가리지 않고 복싱 시합을 요구합니다.",
    image: "/defense/monster_3.png",
  },
  {
    id: 4,
    points: 12,
    maxHp: 11,
    baseTime: 3,
    baseCount: 4,
    name: "슬렌더맨",
    description:
      "신사적이고 예의바르지만, 귀를 기울이지 마십시오. 신성모독 단체 포교 경력이 있습니다.",
    image: "/defense/monster_4.png",
  },
  {
    id: 5,
    points: 16,
    maxHp: 13,
    baseTime: 2,
    baseCount: 3,
    name: "문어의 악마",
    description: "두족류의 원수인 인간을 산채로 요리하고 싶어합니다.",
    image: "/defense/monster_5.png",
  },
  {
    id: 6,
    points: 21,
    maxHp: 15,
    baseTime: 6,
    baseCount: 2,
    name: "서브웨이맨",
    description:
      "힘을 합쳐 물리쳐야 하는 보스 몬스터입니다! 지하철보다 훨씬 느립니다.",
    image: "/defense/monster_6.png",
  },
];

export const DEFENSE_MONSTERS_BY_ID: Record<number, DefenseMonsterDefinition> =
  DEFENSE_MONSTERS.reduce((acc, m) => {
    acc[m.id] = m;
    return acc;
  }, {} as Record<number, DefenseMonsterDefinition>);
