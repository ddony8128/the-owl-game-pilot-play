/**
 * 디펜스 딜레마 순위 (Iteration 5 계약 — 보드 점수 API·결과 화면·GM 대시보드가 **이 함수 하나**를 쓴다).
 *
 * 룰지(디펜스-딜레마-룰지 §순위) 정본:
 *   점수가 높은 사람이 앞선다 → 동점이면 본게임에서 전투에 낸 카드 숫자의 합(누적 데미지)이 큰 사람이 앞선다
 *   → 그래도 같으면 **공동 순위**(같은 등수 번호, 다음 등수는 건너뜀: 1, 1, 3).
 *
 * 닉네임·등록 순서·ID로는 절대 가르지 않는다. 같은 (점수, 데미지)면 같은 rank 를 받고, 그 안의 배열 순서는
 * 입력 순서를 그대로 유지한다(안정 정렬) — 화면이 어떤 순서로 그리든 등수는 같다.
 *
 * 수산시장·증권가 반면교사 1-14: 화면과 계산이 다른 함수를 쓰면 "전원 동자산인데 왕관 6개" 같은 사고가 난다.
 * 그래서 순위 번호를 매기는 곳은 여기뿐이어야 한다.
 */

export type DefenseRankInput = {
  /** 현재 점수 */
  points: number;
  /** 본게임 전투에 낸 카드 숫자 합(튜토리얼 제외). 없으면 0으로 본다. */
  damage?: number | null;
};

export type Ranked<T> = T & {
  /** 1부터. 공동 순위는 같은 번호, 다음 번호는 건너뛴다(1, 1, 3). */
  rank: number;
  /** 같은 등수인 사람 수(1이면 단독) */
  tieCount: number;
};

/** 룰지 문구와 대조하는 검사(verify:docs)용 상수 — 문구를 바꾸면 룰지·GM 안내도 같이 바꾼다. */
export const DEFENSE_RANK_RULE_TEXT =
  "점수 → 동점이면 본게임 전투에 낸 카드 숫자의 합이 큰 쪽 → 그래도 같으면 공동 순위";

/** 점수 내림차순 → 누적 데미지 내림차순. 0이면 동순위. 닉네임은 보지 않는다. */
export function compareDefenseRank(a: DefenseRankInput, b: DefenseRankInput): number {
  if (b.points !== a.points) return b.points - a.points;
  return (b.damage ?? 0) - (a.damage ?? 0);
}

/**
 * 비교 함수로 정렬한 뒤 공동 순위 번호를 매긴다(일반형 — 마피아 보드도 같은 함수로 등수를 매긴다).
 * 입력 배열은 바꾸지 않는다. 정렬은 안정적이라 동순위 안에서는 입력 순서를 유지한다.
 */
export function assignSharedRanks<T>(rows: readonly T[], compare: (a: T, b: T) => number): Ranked<T>[] {
  const sorted = rows
    .map((row, index) => ({ row, index }))
    .sort((x, y) => compare(x.row, y.row) || x.index - y.index)
    .map((x) => x.row);

  const out: Ranked<T>[] = [];
  let groupStart = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0 && compare(sorted[groupStart], sorted[i]) !== 0) groupStart = i;
    out.push({ ...sorted[i], rank: groupStart + 1, tieCount: 0 });
  }
  // tieCount 채우기(같은 rank 의 개수)
  const countByRank = new Map<number, number>();
  for (const r of out) countByRank.set(r.rank, (countByRank.get(r.rank) ?? 0) + 1);
  for (const r of out) r.tieCount = countByRank.get(r.rank) ?? 1;
  return out;
}

/**
 * 디펜스 순위. 점수 → 누적 데미지 → 공동 순위.
 * 반환 배열은 등수 오름차순(1위부터)이며 각 원소에 rank·tieCount 가 붙는다.
 */
export function rankPlayers<T extends DefenseRankInput>(rows: readonly T[]): Ranked<T>[] {
  return assignSharedRanks(rows, compareDefenseRank);
}

/** 화면용 등수 표기 — 공동이면 "공동 1위", 아니면 "1위". */
export function rankLabel(rank: number, tieCount: number): string {
  return tieCount > 1 ? `공동 ${rank}위` : `${rank}위`;
}
