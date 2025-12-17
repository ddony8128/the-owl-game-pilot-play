import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  MafiaPhase,
  MafiaPhaseState,
  MafiaPlayerState,
  MafiaPlayerSnapshot,
} from "@/lib/types";
import { handlePrepareToAuction } from "./prepareToAuction";
import { handleAuctionToTrade } from "./auctionToTrade";
import { handleTradeToApply } from "./tradeToApply";
import { handleVoteToEnd } from "./voteToEnd";

type AdvanceBody = {
  from?: string;
  to?: string;
};

type AdvanceResponse = { ok: true; phase: MafiaPhaseState } | { error: string };

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
