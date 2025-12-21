import type {
  MafiaAction,
  MafiaPhaseState,
  MafiaPlayerState,
} from "@/lib/types";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

export async function handleAuctionToTrade(
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
  const winningBids: { player_id: string; job: string; amount: number }[] = [];

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
    let winningAmount = 0;
    for (const amt of amounts) {
      const bidders = byAmount.get(amt) ?? [];
      if (bidders.length === 1) {
        winner = bidders[0]!;
        winningAmount = amt;
        break;
      }
      // 동점이면 다음(amount)로 내려감
    }
    if (winner) {
      jobByPlayer.set(winner, job);
      winningBids.push({ player_id: winner, job, amount: winningAmount });
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

    // 마피아 직업(상승/하락 주가조작범, 강도)은 is_mafia=true, 그 외는 false
    const isMafia =
      job === "up_manipulator" ||
      job === "down_manipulator" ||
      job === "robber";

    updates.push({
      player_id: pid,
      job,
      is_mafia: isMafia,
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

  // 경매 낙찰자의 베팅 금액만큼 현금 차감
  if (winningBids.length > 0) {
    const byPlayerAmount = new Map<string, number>();
    for (const wb of winningBids) {
      byPlayerAmount.set(
        wb.player_id,
        (byPlayerAmount.get(wb.player_id) ?? 0) + wb.amount
      );
    }

    const updatedPlayers: Partial<MafiaPlayerState>[] = [];
    for (const p of playerStates) {
      const pid = p.player_id;
      const betAmount = byPlayerAmount.get(pid) ?? 0;
      if (betAmount <= 0) continue;
      const baseCash = typeof p.cash === "number" ? p.cash : 0;
      const nextCash = baseCash - betAmount;
      updatedPlayers.push({
        player_id: pid,
        cash: nextCash,
      } as Partial<MafiaPlayerState>);
    }

    if (updatedPlayers.length > 0) {
      const { error: cashUpdateError } = await supabase
        .from("mafia_player_state")
        .upsert(updatedPlayers, { onConflict: "player_id" });

      if (cashUpdateError) {
        throw new Error(
          cashUpdateError.message ??
            "경매 베팅 금액을 현금에서 차감하지 못했습니다."
        );
      }
    }
  }
}
