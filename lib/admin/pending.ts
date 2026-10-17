import type { createServerSupabaseClient } from "@/lib/supabase/server";
import type { MafiaPhase, Player } from "@/lib/types";

type SupabaseClient = ReturnType<typeof createServerSupabaseClient>;

// 미제출 참가자 집계 — 확인창 본문("미제출 N명: 이름…")용. Iteration 5 WS-A 2.
export type PendingSummary = {
  /** 이 단계에서 제출이 의미 있는지(준비·결과 단계면 false → 경고 생략) */
  applicable: boolean;
  /** 집계 대상 단계 설명(예: "4라운드 행동", "직업 경매 입찰") */
  label: string;
  total: number;
  submitted: number;
  pending: { id: string; nickname: string }[];
};

export function isDefensePlayableRound(round: number): boolean {
  return round === 1 || round === 2 || (round >= 4 && round <= 15);
}

async function loadPlayers(supabase: SupabaseClient, room: string): Promise<Player[]> {
  const { data, error } = await supabase
    .from("players")
    .select("id, room_code, nickname, created_at")
    .eq("room_code", room)
    .order("nickname", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Player[];
}

function build(players: Player[], submittedIds: Set<string>, label: string, applicable: boolean): PendingSummary {
  const pending = players.filter((p) => !submittedIds.has(p.id)).map((p) => ({ id: p.id, nickname: p.nickname }));
  return { applicable, label, total: players.length, submitted: players.length - pending.length, pending };
}

export async function defensePending(
  supabase: SupabaseClient,
  room: string,
  round: number,
): Promise<PendingSummary> {
  const players = await loadPlayers(supabase, room);
  if (!isDefensePlayableRound(round)) {
    return build(players, new Set(players.map((p) => p.id)), "행동 없음", false);
  }
  const { data, error } = await supabase
    .from("defense_action")
    .select("player_id")
    .eq("room_code", room)
    .eq("round", round);
  if (error) throw new Error(error.message);
  const ids = new Set(((data ?? []) as { player_id: string }[]).map((a) => a.player_id));
  return build(players, ids, "이번 라운드 행동", true);
}

export async function mafiaPending(
  supabase: SupabaseClient,
  room: string,
  round: number,
  phase: MafiaPhase,
): Promise<PendingSummary> {
  const players = await loadPlayers(supabase, room);
  if (phase === "auction" || phase === "trade") {
    let q = supabase
      .from("mafia_actions")
      .select("player_id")
      .eq("room_code", room)
      .eq("round_number", round)
      .eq("phase", phase);
    if (phase === "auction") q = q.eq("action_type", "bet");
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const ids = new Set(
      ((data ?? []) as { player_id: string | null }[]).map((a) => a.player_id).filter((x): x is string => !!x),
    );
    return build(players, ids, phase === "auction" ? "직업 경매 입찰" : "주식 거래·능력 제출", true);
  }
  if (phase === "vote") {
    const { data, error } = await supabase
      .from("mafia_votes")
      .select("voter_id")
      .eq("room_code", room)
      .eq("round_number", round);
    if (error) throw new Error(error.message);
    const ids = new Set(
      ((data ?? []) as { voter_id: string | null }[]).map((v) => v.voter_id).filter((x): x is string => !!x),
    );
    return build(players, ids, "투표", true);
  }
  return build(players, new Set(players.map((p) => p.id)), "제출 없음", false);
}
