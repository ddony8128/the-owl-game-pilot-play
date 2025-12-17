import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  MafiaAction,
  MafiaPhase,
  MafiaPhaseState,
  MafiaPlayerState,
  MafiaPlayerSnapshot,
  MafiaStockState,
  Player,
  SubwayPlayerState,
} from "@/lib/types";
import type { MafiaAbilityPayload } from "@/lib/mafia/abilities";

type AdvanceBody = {
  from?: string;
  to?: string;
};

type AdvanceResponse = { ok: true; phase: MafiaPhaseState } | { error: string };

async function handlePrepareToAuction(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  current: MafiaPhaseState
) {
  // 튜토리얼(0) 또는 1라운드에서만 현금 30 + 보너스 초기화
  if (current.round_number !== 0 && current.round_number !== 1) {
    return;
  }

  // 플레이어 전체 조회
  const { data: playerRows, error: playersError } = await supabase
    .from("players")
    .select("id, nickname, is_finalist, created_at");

  if (playersError || !playerRows) {
    throw new Error(playersError?.message ?? "players 조회에 실패했습니다.");
  }

  const players = playerRows as Player[];

  if (players.length === 0) {
    return;
  }

  // 1게임(지하철) 등수 정보 조회
  const { data: subwayStates, error: subwayError } = await supabase
    .from("subway_player_state")
    .select("player_id, finished_rank, is_finished");

  if (subwayError || !subwayStates) {
    throw new Error(
      subwayError?.message ?? "subway_player_state 조회에 실패했습니다."
    );
  }

  const byPlayerId = new Map<string, SubwayPlayerState>();
  for (const row of subwayStates as unknown as SubwayPlayerState[]) {
    if (row.player_id) {
      byPlayerId.set(row.player_id, row);
    }
  }

  // 완료된 플레이어들 중 최대 finished_rank 계산
  const finishedRanks: number[] = [];
  for (const state of byPlayerId.values()) {
    if (typeof state.finished_rank === "number") {
      finishedRanks.push(state.finished_rank);
    }
  }
  const lastClearedRank =
    finishedRanks.length > 0 ? Math.max(...finishedRanks) : 0;

  type BonusEntry = { player_id: string; cash: number };
  const bonuses: BonusEntry[] = [];

  for (const p of players) {
    const subway = byPlayerId.get(p.id) ?? null;
    let rank: number;
    if (subway && typeof subway.finished_rank === "number") {
      rank = subway.finished_rank;
    } else {
      // 통과하지 못한 경우: 마지막 등수 + 1등으로 계산
      rank = lastClearedRank + 1 || 1;
    }

    let bonus = 10 - (rank - 1);
    if (bonus < 0) bonus = 0;

    const cash = 30 + bonus;
    bonuses.push({ player_id: p.id, cash });
  }

  if (bonuses.length > 0) {
    const { error: upsertError } = await supabase
      .from("mafia_player_state")
      .upsert(bonuses, { onConflict: "player_id" });

    if (upsertError) {
      throw new Error(
        upsertError.message ?? "mafia_player_state 현금 초기화에 실패했습니다."
      );
    }
  }
}

async function handleAuctionToTrade(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  current: MafiaPhaseState
) {
  // 현재 라운드의 경매 베팅 내역 조회
  const { data: actionRows, error: actionsError } = await supabase
    .from("mafia_actions")
    .select("player_id, round_number, phase, action_type, payload, created_at")
    .eq("round_number", current.round_number)
    .eq("phase", current.phase)
    .eq("action_type", "bet");

  if (actionsError) {
    throw new Error(actionsError.message ?? "경매 기록을 불러오지 못했습니다.");
  }

  const actions = (actionRows || []) as MafiaAction[];

  // 플레이어 목록 조회 (모든 참가자 대상)
  const { data: playerStateRows, error: playerStateError } = await supabase
    .from("mafia_player_state")
    .select("player_id, cash, is_mafia, job, updated_at");

  if (playerStateError) {
    throw new Error(
      playerStateError.message ?? "mafia_player_state 조회에 실패했습니다."
    );
  }

  const playerStates = (playerStateRows || []) as MafiaPlayerState[];
  const playerIds = playerStates.map((p) => p.player_id);

  // 직업별 입찰 내역: job -> amount -> player_id[]
  const bidsByJob = new Map<string, Map<number, string[]>>();
  const gaveUp = new Set<string>();

  for (const a of actions) {
    if (!a.player_id) continue;
    const payload = (a.payload ?? {}) as {
      job?: string | null;
      amount?: number;
      give_up?: boolean;
    };

    if (payload.give_up) {
      gaveUp.add(a.player_id);
      continue;
    }

    if (!payload.job || typeof payload.amount !== "number") continue;
    const job = payload.job;
    const amount = payload.amount;
    if (amount <= 0) continue;

    let byAmount = bidsByJob.get(job);
    if (!byAmount) {
      byAmount = new Map<number, string[]>();
      bidsByJob.set(job, byAmount);
    }
    const arr = byAmount.get(amount) ?? [];
    arr.push(a.player_id);
    byAmount.set(amount, arr);
  }

  // 플레이어별 최종 직업 결정
  const jobByPlayer = new Map<string, string | null>();

  // 낙찰자: 직업별로 금액 내림차순을 돌며 유일한 금액이 나오는 레벨을 찾는다.
  for (const [job, byAmount] of bidsByJob.entries()) {
    const amounts = Array.from(byAmount.keys()).sort((a, b) => b - a);
    let winner: string | null = null;
    for (const amt of amounts) {
      const bidders = byAmount.get(amt) ?? [];
      if (bidders.length === 1) {
        winner = bidders[0]!;
        break;
      }
      // 동점이면 다음(amount)로 내려감
    }
    if (winner) {
      jobByPlayer.set(winner, job);
    }
  }

  // 경매 실패자/미베팅자/포기자 → 월급쟁이
  for (const pid of playerIds) {
    if (jobByPlayer.has(pid)) continue;
    jobByPlayer.set(pid, "salaryman");
  }

  const updates: Partial<MafiaPlayerState>[] = [];
  for (const pid of playerIds) {
    const job = jobByPlayer.get(pid) ?? null;
    updates.push({
      player_id: pid,
      job,
    } as Partial<MafiaPlayerState>);
  }

  if (updates.length > 0) {
    const { error: updateError } = await supabase
      .from("mafia_player_state")
      .upsert(updates, { onConflict: "player_id" });

    if (updateError) {
      throw new Error(
        updateError.message ?? "직업 배정을 반영하지 못했습니다."
      );
    }
  }
}

async function handleTradeToApply(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  current: MafiaPhaseState
) {
  // 현재 주가 조회
  const { data: stockRows, error: stockError } = await supabase
    .from("mafia_stock_state")
    .select("stock_key, price, updated_at");

  if (stockError || !stockRows) {
    throw new Error(
      stockError?.message ?? "mafia_stock_state 조회에 실패했습니다."
    );
  }

  const stockMap = new Map<string, MafiaStockState>();
  for (const row of stockRows as MafiaStockState[]) {
    stockMap.set(row.stock_key, row);
  }

  // trade 단계 액션 조회 (buy/sell/ability)
  const { data: actionRows, error: actionsError } = await supabase
    .from("mafia_actions")
    .select("player_id, round_number, phase, action_type, payload, created_at")
    .eq("round_number", current.round_number)
    .eq("phase", current.phase);

  if (actionsError) {
    throw new Error(
      actionsError.message ?? "trade 액션을 불러오지 못했습니다."
    );
  }

  const actions = (actionRows || []) as MafiaAction[];

  // 플레이어 상태 조회 (cash, job, stocks, is_mafia)
  const { data: playerStateRows, error: playerStateError } = await supabase
    .from("mafia_player_state")
    .select("player_id, cash, is_mafia, job, stocks, updated_at");

  if (playerStateError) {
    throw new Error(
      playerStateError.message ?? "mafia_player_state 조회에 실패했습니다."
    );
  }

  const playerStates = (playerStateRows || []) as MafiaPlayerState[];
  const playerStateById = new Map<string, MafiaPlayerState>();
  for (const p of playerStates) {
    playerStateById.set(p.player_id, p);
  }

  // 플레이어 기본 정보 (닉네임 매핑용)
  const { data: playerRows, error: playersError } = await supabase
    .from("players")
    .select("id, nickname, is_finalist, created_at");

  if (playersError || !playerRows) {
    throw new Error(playersError?.message ?? "players 조회에 실패했습니다.");
  }

  const players = playerRows as Player[];
  const idByNickname = new Map<string, string>();
  for (const p of players) {
    idByNickname.set(p.nickname, p.id);
  }

  type TradeAgg = { buy: number; sell: number };
  const buyVolumeByStock = new Map<string, number>();
  const sellVolumeByStock = new Map<string, number>();
  const tradeByPlayerStock = new Map<string, Map<string, TradeAgg>>();
  const tradeValueByStock = new Map<string, number>();

  // 이번 라운드 수익(매도 수익 + 직업 능력 수익) - 강도 계산용
  const roundIncomeForRobber = new Map<string, number>();

  // 직업 능력 payload
  const abilitiesByPlayer = new Map<string, MafiaAbilityPayload[]>();

  const addIncome = (playerId: string, amount: number) => {
    if (!amount) return;
    const prev = roundIncomeForRobber.get(playerId) ?? 0;
    roundIncomeForRobber.set(playerId, prev + amount);
  };

  // trade 액션 순회
  for (const a of actions) {
    if (!a.player_id) continue;
    const playerId = a.player_id;

    if (a.action_type === "buy" || a.action_type === "sell") {
      const payload = (a.payload ?? {}) as {
        stock_key?: string;
        amount?: number;
      };
      const stockKey = payload.stock_key;
      const amount = typeof payload.amount === "number" ? payload.amount : 0;
      if (!stockKey || amount <= 0) continue;

      const stock = stockMap.get(stockKey);
      const priceBefore = stock?.price ?? 0;

      if (a.action_type === "buy") {
        const prev = buyVolumeByStock.get(stockKey) ?? 0;
        buyVolumeByStock.set(stockKey, prev + amount);
      } else if (a.action_type === "sell") {
        const prev = sellVolumeByStock.get(stockKey) ?? 0;
        sellVolumeByStock.set(stockKey, prev + amount);

        const revenue = amount * priceBefore;
        addIncome(playerId, revenue);
      }

      const perPlayer =
        tradeByPlayerStock.get(playerId) ?? new Map<string, TradeAgg>();
      if (!tradeByPlayerStock.has(playerId)) {
        tradeByPlayerStock.set(playerId, perPlayer);
      }
      const agg = perPlayer.get(stockKey) ?? { buy: 0, sell: 0 };
      if (a.action_type === "buy") {
        agg.buy += amount;
      } else {
        agg.sell += amount;
      }
      perPlayer.set(stockKey, agg);

      const tradeValue = amount * priceBefore;
      const prevValue = tradeValueByStock.get(stockKey) ?? 0;
      tradeValueByStock.set(stockKey, prevValue + tradeValue);
    } else if (a.action_type === "ability") {
      const payload = a.payload as MafiaAbilityPayload | null;
      if (!payload || typeof payload.job !== "string") continue;
      const list = abilitiesByPlayer.get(a.player_id) ?? [];
      if (!abilitiesByPlayer.has(a.player_id)) {
        abilitiesByPlayer.set(a.player_id, list);
      }
      list.push(payload);
    }
  }

  // 매수/매도량에 따른 기본 주가 변동
  const priceDeltaByStock = new Map<string, number>();

  const buyEntries = Array.from(buyVolumeByStock.entries()).filter(
    ([, vol]) => vol > 0
  );
  if (buyEntries.length > 0) {
    const distinctVolumes = Array.from(
      new Set(buyEntries.map(([, vol]) => vol))
    ).sort((a, b) => b - a);
    const top = distinctVolumes[0];
    const second = distinctVolumes[1];

    for (const [key, vol] of buyEntries) {
      if (vol === top) {
        priceDeltaByStock.set(key, (priceDeltaByStock.get(key) ?? 0) + 2);
      } else if (second != null && vol === second) {
        priceDeltaByStock.set(key, (priceDeltaByStock.get(key) ?? 0) + 1);
      }
    }
  }

  const sellEntries = Array.from(sellVolumeByStock.entries()).filter(
    ([, vol]) => vol > 0
  );
  if (sellEntries.length > 0) {
    const maxSell = Math.max(...sellEntries.map(([, vol]) => vol));
    for (const [key, vol] of sellEntries) {
      if (vol === maxSell) {
        priceDeltaByStock.set(key, (priceDeltaByStock.get(key) ?? 0) - 1);
      }
    }
  }

  // 마피아 주가조작 능력 반영 (국채 제외)
  const applyAbilityPriceChange = () => {
    for (const [playerId, abilities] of abilitiesByPlayer.entries()) {
      const pState = playerStateById.get(playerId);
      if (!pState) continue;
      for (const ability of abilities) {
        switch (ability.job) {
          case "up_manipulator": {
            const key = ability.stock_key;
            if (!key || !stockMap.has(key) || key === "국채") continue;
            priceDeltaByStock.set(key, (priceDeltaByStock.get(key) ?? 0) + 2);
            break;
          }
          case "down_manipulator": {
            const key = ability.stock_key;
            if (!key || !stockMap.has(key) || key === "국채") continue;
            priceDeltaByStock.set(key, (priceDeltaByStock.get(key) ?? 0) - 3);
            break;
          }
          default:
            break;
        }
      }
    }
  };

  applyAbilityPriceChange();

  // 새로운 주가 계산 및 최소 1원 보정
  const updatedStocks: MafiaStockState[] = [];
  for (const [key, stock] of stockMap.entries()) {
    const delta = priceDeltaByStock.get(key) ?? 0;
    let nextPrice = stock.price + delta;
    if (nextPrice < 1) nextPrice = 1;
    updatedStocks.push({
      ...stock,
      price: nextPrice,
    });
  }

  if (updatedStocks.length > 0) {
    const { error: updateStocksError } = await supabase
      .from("mafia_stock_state")
      .upsert(
        updatedStocks.map((s) => ({
          stock_key: s.stock_key,
          price: s.price,
        })),
        { onConflict: "stock_key" }
      );

    if (updateStocksError) {
      throw new Error(
        updateStocksError.message ?? "주가를 업데이트하지 못했습니다."
      );
    }
  }

  // 직업별 현금 수익 및 강도 정산
  const cashDelta = new Map<string, number>();

  const addCash = (
    playerId: string,
    amount: number,
    isAbilityIncome: boolean
  ) => {
    if (!amount) return;
    cashDelta.set(playerId, (cashDelta.get(playerId) ?? 0) + amount);
    if (isAbilityIncome) {
      addIncome(playerId, amount);
    }
  };

  // 증권사 직원용: 종목별 총 거래금액
  const getBrokerReward = (stockKey: string): number => {
    const total = tradeValueByStock.get(stockKey) ?? 0;
    if (total <= 0) return 0;
    return Math.floor(total * 0.1);
  };

  // CEO, 월급쟁이, 경찰, 세무조사원, 증권사 직원 보너스
  for (const p of playerStates) {
    const job = p.job;
    const pid = p.player_id;
    if (!job) continue;

    switch (job) {
      case "ceo":
        addCash(pid, 10, true);
        break;
      case "salaryman":
        addCash(pid, 3, true);
        break;
      case "police":
        addCash(pid, 5, true);
        break;
      case "tax_auditor":
        addCash(pid, 5, true);
        break;
      case "broker": {
        const abilities = abilitiesByPlayer.get(pid) ?? [];
        const broker = abilities.find(
          (a): a is Extract<MafiaAbilityPayload, { job: "broker" }> =>
            a.job === "broker"
        );
        if (broker?.stock_key) {
          const reward = getBrokerReward(broker.stock_key);
          if (reward > 0) {
            addCash(pid, reward, true);
          }
        }
        break;
      }
      default:
        break;
    }
  }

  // 강도 정산
  for (const p of playerStates) {
    if (p.job !== "robber") continue;
    const pid = p.player_id;
    const abilities = abilitiesByPlayer.get(pid) ?? [];
    const robberAbility = abilities.find(
      (a): a is Extract<MafiaAbilityPayload, { job: "robber" }> =>
        a.job === "robber"
    );
    if (!robberAbility) continue;

    const [t1Name, t2Name] = robberAbility.targets;
    const t1Id = idByNickname.get(t1Name) ?? null;
    const t2Id = idByNickname.get(t2Name) ?? null;

    const targets = [t1Id, t2Id].filter(
      (id): id is string => !!id && id !== pid
    );
    if (targets.length === 0) continue;

    let totalStolen = 0;
    for (const tid of targets) {
      const victimState = playerStateById.get(tid);
      if (!victimState) continue;
      if (victimState.job === "mayor") continue; // 시장은 강도 면역

      const income = roundIncomeForRobber.get(tid) ?? 0;
      if (income <= 0) continue;

      const stolen = Math.floor(income / 2);
      if (stolen <= 0) continue;

      cashDelta.set(tid, (cashDelta.get(tid) ?? 0) - stolen);
      totalStolen += stolen;
    }

    if (totalStolen > 0) {
      cashDelta.set(pid, (cashDelta.get(pid) ?? 0) + totalStolen);
    }
  }

  // 보유 주식(stocks) 반영
  const updatedPlayers: Partial<MafiaPlayerState>[] = [];

  for (const p of playerStates) {
    const pid = p.player_id;
    const perStock = tradeByPlayerStock.get(pid);
    const deltaCash = cashDelta.get(pid) ?? 0;

    if (!perStock && deltaCash === 0) continue;

    const rawStocks = (p as unknown as { stocks?: unknown }).stocks;
    const stocks: Record<string, { amount: number }> =
      rawStocks && typeof rawStocks === "object"
        ? { ...(rawStocks as Record<string, { amount: number }>) }
        : {};

    if (perStock) {
      for (const [stockKey, agg] of perStock.entries()) {
        const prevAmount =
          typeof stocks[stockKey]?.amount === "number"
            ? stocks[stockKey].amount
            : 0;
        const nextAmount = prevAmount + agg.buy - agg.sell;
        stocks[stockKey] = { amount: nextAmount };
      }
    }

    const nextCash = p.cash + deltaCash;

    updatedPlayers.push({
      player_id: pid,
      cash: nextCash,
      stocks,
    } as Partial<MafiaPlayerState>);
  }

  if (updatedPlayers.length > 0) {
    const { error: updatePlayersError } = await supabase
      .from("mafia_player_state")
      .upsert(updatedPlayers, { onConflict: "player_id" });

    if (updatePlayersError) {
      throw new Error(
        updatePlayersError.message ??
          "플레이어 자산 상태를 업데이트하지 못했습니다."
      );
    }
  }
}

async function handleVoteToEnd(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  current: MafiaPhaseState
) {
  // 현재 라운드 투표 집계
  const { data: voteRows, error: votesError } = await supabase
    .from("mafia_votes")
    .select("round_number, target_id, vote_count")
    .eq("round_number", current.round_number);

  if (votesError) {
    throw new Error(votesError.message ?? "투표 기록을 불러오지 못했습니다.");
  }

  const votes = voteRows ?? [];
  if (votes.length === 0) {
    return;
  }

  const tally = new Map<string, number>();
  for (const v of votes) {
    const target = v.target_id as string | null;
    const count = typeof v.vote_count === "number" ? v.vote_count : 0;
    if (!target || count <= 0) continue;
    tally.set(target, (tally.get(target) ?? 0) + count);
  }

  if (tally.size === 0) {
    return;
  }

  // 최다 득표자 계산
  let maxVotes = 0;
  for (const [, cnt] of tally.entries()) {
    if (cnt > maxVotes) maxVotes = cnt;
  }
  if (maxVotes <= 0) return;

  const topTargets = Array.from(tally.entries())
    .filter(([, cnt]) => cnt === maxVotes)
    .map(([target]) => target);

  // 공동 1위가 둘 이상이면 경제사범 없음
  if (topTargets.length !== 1) {
    return;
  }

  const econTargetNickname = topTargets[0]!;

  // 경제사범 플레이어 찾기
  const { data: econPlayerRow, error: econPlayerError } = await supabase
    .from("players")
    .select("id, nickname, is_finalist, created_at")
    .eq("nickname", econTargetNickname)
    .maybeSingle();

  if (econPlayerError) {
    throw new Error(econPlayerError.message ?? "경제사범 플레이어 조회 실패");
  }
  if (!econPlayerRow) {
    return;
  }

  const econPlayer = econPlayerRow as Player;

  // 경제사범의 직업/마피아 여부 조회
  const { data: econStateRow, error: econStateError } = await supabase
    .from("mafia_player_state")
    .select("player_id, cash, is_mafia, job, stocks, updated_at")
    .eq("player_id", econPlayer.id)
    .maybeSingle();

  if (econStateError) {
    throw new Error(
      econStateError.message ?? "경제사범 자산 상태 조회에 실패했습니다."
    );
  }

  if (!econStateRow) {
    return;
  }

  const econState = econStateRow as MafiaPlayerState;
  const isMayor = econState.job === "mayor";
  const isMafia = econState.is_mafia;

  // 벌금 5원 (시장 직업자는 면제)
  if (!isMayor) {
    const nextCash = econState.cash - 5;
    const { error: updateFineError } = await supabase
      .from("mafia_player_state")
      .update({ cash: nextCash })
      .eq("player_id", econPlayer.id);

    if (updateFineError) {
      throw new Error(updateFineError.message ?? "벌금을 적용하지 못했습니다.");
    }
  }

  // 경제사범이 마피아이면 시민에게 국채 1개씩 지급
  if (isMafia) {
    const { data: citizenRows, error: citizenError } = await supabase
      .from("mafia_player_state")
      .select("player_id, cash, is_mafia, job, stocks, updated_at")
      .eq("is_mafia", false);

    if (citizenError) {
      throw new Error(
        citizenError.message ?? "시민 플레이어 조회에 실패했습니다."
      );
    }

    const citizenUpdates: Partial<MafiaPlayerState>[] = [];
    for (const row of (citizenRows ?? []) as MafiaPlayerState[]) {
      const rawStocks = (row as unknown as { stocks?: unknown }).stocks;
      const stocks: Record<string, { amount: number }> =
        rawStocks && typeof rawStocks === "object"
          ? { ...(rawStocks as Record<string, { amount: number }>) }
          : {};

      const prevAmount =
        typeof stocks["국채"]?.amount === "number" ? stocks["국채"].amount : 0;
      stocks["국채"] = { amount: prevAmount + 1 };

      citizenUpdates.push({
        player_id: row.player_id,
        stocks,
      } as Partial<MafiaPlayerState>);
    }

    if (citizenUpdates.length > 0) {
      const { error: updateCitizensError } = await supabase
        .from("mafia_player_state")
        .upsert(citizenUpdates, { onConflict: "player_id" });

      if (updateCitizensError) {
        throw new Error(
          updateCitizensError.message ?? "시민 국채 지급을 반영하지 못했습니다."
        );
      }
    }
  }
}

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as AdvanceBody | null;

  if (!body || typeof body.to !== "string") {
    return NextResponse.json({ error: "to is required" } as AdvanceResponse, {
      status: 400,
    });
  }

  const to = body.to.trim();
  //  const from = body.from?.trim();

  // 현재 phase 조회
  const { data: phaseRow, error: phaseError } = await supabase
    .from("mafia_phase_state")
    .select("id, round_number, phase, updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (phaseError) {
    return NextResponse.json({ error: phaseError.message } as AdvanceResponse, {
      status: 500,
    });
  }

  const current = (phaseRow || null) as MafiaPhaseState | null;
  if (!current) {
    return NextResponse.json(
      {
        error: "mafia_phase_state가 초기화되지 않았습니다.",
      } as AdvanceResponse,
      { status: 500 }
    );
  }

  const allowedNextByPhase: Partial<Record<MafiaPhase, MafiaPhase>> = {
    prepare: "auction",
    auction: "trade",
    trade: "apply",
    apply: "vote",
    vote: "end",
  };

  const nextAllowed = current ? allowedNextByPhase[current.phase] : null;
  if (!nextAllowed || to !== nextAllowed) {
    return NextResponse.json(
      {
        error: `현재 페이즈(${current.phase})에서 ${to}로 전환할 수 없습니다.`,
      } as AdvanceResponse,
      { status: 400 }
    );
  }

  // 스냅샷 생성 (현재 phase 종료 시점)
  const { data: playerStates, error: playerStatesError } = await supabase
    .from("mafia_player_state")
    .select("player_id, cash, is_mafia, job, updated_at");

  if (playerStatesError) {
    return NextResponse.json(
      { error: playerStatesError.message } as AdvanceResponse,
      { status: 500 }
    );
  }

  const snapshots = (playerStates || []) as MafiaPlayerState[];

  if (snapshots.length > 0) {
    await supabase.from("mafia_player_snapshots").insert(
      snapshots.map((p) => ({
        player_id: p.player_id,
        round_number: current.round_number,
        phase: current.phase,
        cash: p.cash,
        stocks: {},
        job: p.job,
      })) as Partial<MafiaPlayerSnapshot>[]
    );
  }

  // 페이즈 전환별 비즈니스 로직
  try {
    if (current.phase === "prepare" && to === "auction") {
      await handlePrepareToAuction(supabase, current);
    } else if (current.phase === "auction" && to === "trade") {
      await handleAuctionToTrade(supabase, current);
    } else if (current.phase === "trade" && to === "apply") {
      await handleTradeToApply(supabase, current);
    } else if (current.phase === "vote" && to === "end") {
      await handleVoteToEnd(supabase, current);
    }
  } catch (e: unknown) {
    const message =
      e instanceof Error
        ? e.message
        : "페이즈 전환 비즈니스 로직 처리 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message } as AdvanceResponse, {
      status: 500,
    });
  }

  const { data: updatedPhase, error: updateError } = await supabase
    .from("mafia_phase_state")
    .update({ round_number: current.round_number, phase: to })
    .eq("id", 1)
    .select("id, round_number, phase, updated_at")
    .maybeSingle();

  if (updateError || !updatedPhase) {
    return NextResponse.json(
      {
        error:
          updateError?.message ??
          "mafia_phase_state를 업데이트하지 못했습니다.",
      } as AdvanceResponse,
      { status: 500 }
    );
  }

  return NextResponse.json(
    { ok: true, phase: updatedPhase as MafiaPhaseState } as AdvanceResponse,
    { status: 200 }
  );
}
