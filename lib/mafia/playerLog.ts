// 마피아 "로그" 탭 — 내 라운드별 기록(경매·거래·정산·투표)을 만든다.
// 비공개 원칙: 입력으로 다른 사람의 행이 섞여 들어와도 **내 player_id 행만** 쓴다. 남의 직업·남의 표·강도 대상은 절대 들어가지 않는다.
// (mafia_ability_results 는 애초에 player_id 별로 "그 사람이 알 수 있는 것"만 담겨 있으므로 내 행이면 그대로 보여 줘도 된다.)

export const MAFIA_JOB_LABELS: Record<string, string> = {
  ceo: "CEO",
  salaryman: "월급쟁이",
  police: "경찰",
  robber: "강도",
  mayor: "시장",
  up_manipulator: "상승 주가조작범",
  down_manipulator: "하락 주가조작범",
  tax_auditor: "세무조사원",
  broker: "증권사 직원",
};

export function mafiaJobLabel(job: string | null | undefined): string {
  if (!job) return "없음";
  return MAFIA_JOB_LABELS[job] ?? job;
}

export type MafiaLogActionRow = {
  player_id: string | null;
  round_number: number;
  phase: string;
  action_type: string;
  payload: Record<string, unknown> | null;
  created_at?: string | null;
};

export type MafiaLogVoteRow = {
  voter_id: string | null;
  round_number: number | null;
  target_id: string | null;
  vote_count: number | null;
  unit_price: number | null;
};

export type MafiaLogAbilityResultRow = {
  player_id: string;
  round_number: number | null;
  phase: string | null;
  category: string | null;
  message: string;
};

export type MafiaLogSnapshotRow = {
  player_id: string;
  round_number: number | null;
  phase: string | null;
  job: string | null;
  cash: number | null;
};

export type MafiaLogEntry = {
  /** 'auction' | 'trade' | 'settlement' | 'vote' */
  kind: "auction" | "trade" | "settlement" | "vote";
  text: string;
};

export type MafiaRoundLog = {
  round: number;
  entries: MafiaLogEntry[];
};

export type BuildMafiaPlayerLogInput = {
  playerId: string;
  actions: MafiaLogActionRow[];
  votes: MafiaLogVoteRow[];
  abilityResults: MafiaLogAbilityResultRow[];
  snapshots: MafiaLogSnapshotRow[];
  /** 투표 대상 id → 닉네임(투표 대상은 내가 고른 사람이라 보여 줘도 된다) */
  nicknameById: Map<string, string>;
};

const PHASE_RANK: Record<string, number> = { prepare: 0, auction: 1, trade: 2, apply: 3, vote: 4, end: 5 };

function roundLabel(r: number): string {
  return r === 0 ? "튜토리얼" : `${r}라운드`;
}

/** 내 라운드별 로그. 라운드 내림차순(최근 먼저). */
export function buildMafiaPlayerLog(input: BuildMafiaPlayerLogInput): MafiaRoundLog[] {
  const { playerId } = input;
  const mine = <T extends { player_id?: string | null; voter_id?: string | null }>(rows: T[], key: "player_id" | "voter_id") =>
    rows.filter((r) => r[key] === playerId);

  const actions = mine(input.actions, "player_id");
  const votes = mine(input.votes, "voter_id");
  const results = mine(input.abilityResults, "player_id");
  const snapshots = mine(input.snapshots, "player_id");

  const byRound = new Map<number, MafiaLogEntry[]>();
  const push = (round: number, entry: MafiaLogEntry) => {
    const arr = byRound.get(round) ?? [];
    arr.push(entry);
    byRound.set(round, arr);
  };

  // 라운드별 "경매 뒤" 직업 = 그 라운드의 trade 이후 스냅샷 중 가장 진행된 것의 job.
  const jobAfterAuction = new Map<number, string | null>();
  for (const s of snapshots) {
    if (s.round_number == null) continue;
    const rank = PHASE_RANK[s.phase ?? "prepare"] ?? 0;
    if (rank < PHASE_RANK.trade) continue;
    const prev = jobAfterAuction.get(s.round_number);
    if (prev === undefined || rank >= (PHASE_RANK[prev ?? ""] ?? -1)) {
      jobAfterAuction.set(s.round_number, s.job ?? null);
    }
  }

  // 경매
  const bets = actions.filter((a) => a.action_type === "bet").sort(sortByCreated);
  for (const b of bets) {
    const p = b.payload ?? {};
    const giveUp = p.give_up === true;
    const job = typeof p.job === "string" ? p.job : null;
    const amount = typeof p.amount === "number" ? p.amount : null;
    const assigned = jobAfterAuction.get(b.round_number);
    let text: string;
    if (giveUp) {
      text = "경매: 베팅을 포기했습니다.";
    } else {
      text = `경매: ${mafiaJobLabel(job)}에 ${amount ?? 0}원 베팅`;
    }
    if (assigned !== undefined) {
      const won = !giveUp && job && assigned === job;
      text += won
        ? ` → 낙찰(${mafiaJobLabel(assigned)}, ${amount ?? 0}원 지불)`
        : ` → 낙찰 실패, 이번 라운드 직업: ${mafiaJobLabel(assigned)}`;
    }
    push(b.round_number, { kind: "auction", text });
  }
  // 베팅을 안 했는데 직업이 정해진 라운드(미베팅 → 월급쟁이)
  for (const [round, job] of jobAfterAuction.entries()) {
    if (bets.some((b) => b.round_number === round)) continue;
    push(round, { kind: "auction", text: `경매: 베팅하지 않음 → 이번 라운드 직업: ${mafiaJobLabel(job)}` });
  }

  // 거래
  const trades = actions.filter((a) => a.action_type === "buy" || a.action_type === "sell").sort(sortByCreated);
  for (const t of trades) {
    const p = t.payload ?? {};
    const stock = typeof p.stock_key === "string" ? p.stock_key : "?";
    const amount = typeof p.amount === "number" ? p.amount : 0;
    const price = typeof p.price === "number" ? p.price : null;
    const verb = t.action_type === "buy" ? "매수" : "매도";
    const priceText = price != null ? ` (주당 ${price}원, 총 ${price * amount}원)` : "";
    push(t.round_number, { kind: "trade", text: `거래: ${stock} ${amount}주 ${verb}${priceText}` });
  }

  // 능력 사용(내가 고른 것) — 대상은 내가 고른 것이라 내 로그에는 적어도 된다.
  const abilities = actions.filter((a) => a.action_type === "ability").sort(sortByCreated);
  for (const a of abilities) {
    const p = a.payload ?? {};
    const job = typeof p.job === "string" ? p.job : null;
    let detail = "";
    if (typeof p.stock_key === "string") detail = ` — ${p.stock_key}`;
    else if (Array.isArray(p.targets)) detail = ` — 대상: ${(p.targets as unknown[]).filter((x) => typeof x === "string").join(", ")}`;
    else if (typeof p.target === "string") detail = ` — 대상: ${p.target}`;
    else if (typeof p.ticket_price === "number") detail = ` — 표 가격 ${p.ticket_price}원`;
    push(a.round_number, { kind: "trade", text: `능력 사용: ${mafiaJobLabel(job)}${detail}` });
  }

  // 정산(월급·능력 결과·강도 피해·벌금·국채 지급·경제사범 공지) — 내 player_id 행만.
  for (const r of results) {
    if (r.round_number == null) continue;
    const head = r.phase === "vote" ? "라운드 종료" : "정산";
    push(r.round_number, { kind: "settlement", text: `${head}: ${r.message}` });
  }

  // 투표 — 내가 던진 표만.
  const voteAgg = new Map<string, { count: number; spent: number }>(); // key round:target
  for (const v of votes) {
    if (v.round_number == null || !v.target_id) continue;
    const cnt = typeof v.vote_count === "number" && v.vote_count > 0 ? v.vote_count : 0;
    if (cnt <= 0) continue;
    const unit = typeof v.unit_price === "number" && v.unit_price > 0 ? v.unit_price : 1;
    const key = `${v.round_number}:${v.target_id}`;
    const prev = voteAgg.get(key) ?? { count: 0, spent: 0 };
    prev.count += cnt;
    prev.spent += cnt * unit;
    voteAgg.set(key, prev);
  }
  for (const [key, agg] of voteAgg.entries()) {
    const [roundStr, targetId] = key.split(":");
    const round = Number(roundStr);
    const name = input.nicknameById.get(targetId) ?? "(알 수 없음)";
    push(round, { kind: "vote", text: `투표: ${name}에게 ${agg.count}표 (${agg.spent}원 사용)` });
  }

  return Array.from(byRound.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([round, entries]) => ({ round, entries }));
}

function sortByCreated(a: { created_at?: string | null }, b: { created_at?: string | null }): number {
  return (a.created_at ?? "").localeCompare(b.created_at ?? "");
}

export { roundLabel as mafiaRoundLabel };
