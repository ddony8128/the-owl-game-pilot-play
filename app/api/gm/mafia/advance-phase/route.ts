import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeRoomCode } from "@/lib/rooms";
import type {
  MafiaPhase,
  MafiaPhaseState,
  MafiaPlayerState,
  MafiaPlayerSnapshot,
} from "@/lib/types";
import { getMafiaPhaseLabel } from "@/lib/labels/mafia";
import { decideAdvance } from "@/lib/admin/advanceGuard";
import { gmError, loadRoomForWrite } from "@/lib/admin/gmResponse";
import { MAFIA_PHASE_ORDER } from "@/lib/admin/rewindRules";
import { handlePrepareToAuction } from "./prepareToAuction";
import { handleAuctionToTrade } from "./auctionToTrade";
import { handleTradeToApply } from "./tradeToApply";
import { handleVoteToEnd } from "./voteToEnd";

type AdvanceBody = {
  room?: string;
  /** 화면이 보고 있던 페이즈(Iteration 5 — 뒤처진 탭 보호). 없으면 옛 요청. */
  from?: string;
  to?: string;
};

type AdvanceResponse =
  | { ok: true; phase: MafiaPhaseState; idempotent?: true }
  | { error: string; reason?: string };

const phaseIndex = (p: string): number => MAFIA_PHASE_ORDER.indexOf(p as MafiaPhase);
const phaseLabelByIndex = (i: number) => getMafiaPhaseLabel(MAFIA_PHASE_ORDER[i] ?? null);

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as AdvanceBody | null;

  const room = normalizeRoomCode(typeof body?.room === "string" ? body.room : "");
  if (!room) {
    return gmError(400, "room 필요", "invalid_input");
  }

  if (!body || typeof body.to !== "string") {
    return gmError(400, "to is required", "invalid_input");
  }

  const to = body.to.trim();
  if (phaseIndex(to) < 0) {
    return gmError(400, `알 수 없는 페이즈: ${to}`, "invalid_input");
  }
  const from = typeof body.from === "string" && phaseIndex(body.from.trim()) >= 0 ? body.from.trim() : null;

  // 종료된 방은 읽기 전용(409 room_ended)
  const guard = await loadRoomForWrite(supabase, room);
  if (!guard.ok) return guard.response;

  // 현재 phase 조회
  const { data: phaseRow, error: phaseError } = await supabase
    .from("mafia_phase_state")
    .select("room_code, round_number, phase, updated_at")
    .eq("room_code", room)
    .maybeSingle();

  if (phaseError) {
    return gmError(500, phaseError.message);
  }

  const current = (phaseRow || null) as MafiaPhaseState | null;
  if (!current) {
    return gmError(500, "mafia_phase_state가 초기화되지 않았습니다.");
  }

  // 라운드 종료(end)에서는 전환이 없다 — 다음 라운드는 /api/gm/mafia/phase(라운드 선택)로만. 같은 단계 재요청만 멱등.
  if (current.phase === "end") {
    if (to === "end") {
      return NextResponse.json({ ok: true, idempotent: true, phase: current } as AdvanceResponse, { status: 200 });
    }
    return gmError(409, "라운드 종료 상태입니다. 다음 라운드는 [라운드 선택]으로 시작하세요.", "cannot_skip");
  }

  // 화면이 보고 있던 페이즈(from)와 서버를 대조: 이미 넘어갔으면 200(멱등), 뒤처진/건너뛰기면 409.
  const decision = decideAdvance({
    currentIndex: phaseIndex(current.phase),
    targetIndex: phaseIndex(to),
    fromIndex: from ? phaseIndex(from) : null,
    label: phaseLabelByIndex,
  });
  if (decision.kind === "idempotent") {
    return NextResponse.json({ ok: true, idempotent: true, phase: current } as AdvanceResponse, { status: 200 });
  }
  if (decision.kind === "reject") {
    return gmError(409, decision.error, decision.reason);
  }

  // 동시 더블클릭/중복요청 방지: 현재 phase일 때만 to로 전환되도록 compare-and-swap.
  // 이 전환을 단독으로 획득(정확히 1행 갱신)한 요청만 아래 비즈니스 로직을 실행한다.
  const { data: updatedPhase, error: updateError } = await supabase
    .from("mafia_phase_state")
    .update({ round_number: current.round_number, phase: to })
    .eq("room_code", room)
    .eq("phase", current.phase)
    .eq("round_number", current.round_number)
    .select("room_code, round_number, phase, updated_at")
    .maybeSingle();

  if (updateError) {
    return gmError(500, updateError.message);
  }
  if (!updatedPhase) {
    // 다른 요청이 이미 이 전환을 처리했거나 그 사이 phase가 바뀜 → 중복 적용 방지
    const { data: nowRow } = await supabase
      .from("mafia_phase_state")
      .select("room_code, round_number, phase, updated_at")
      .eq("room_code", room)
      .maybeSingle();
    const now = (nowRow || null) as MafiaPhaseState | null;
    if (now && now.round_number === current.round_number && phaseIndex(now.phase) >= phaseIndex(to)) {
      return NextResponse.json({ ok: true, idempotent: true, phase: now } as AdvanceResponse, { status: 200 });
    }
    return gmError(409, "이미 처리되었거나 페이즈가 변경되었습니다.", "already_advanced");
  }

  // 스냅샷 생성 (현재 phase 종료 시점)
  const { data: playerStates } = await supabase
    .from("mafia_player_state")
    .select("player_id, cash, is_mafia, job, stocks, updated_at")
    .eq("room_code", room);

  const snapshots = (playerStates || []) as MafiaPlayerState[];

  if (snapshots.length > 0) {
    await supabase.from("mafia_player_snapshots").insert(
      snapshots.map((p) => ({
        room_code: room,
        player_id: p.player_id,
        round_number: current.round_number,
        phase: current.phase,
        cash: p.cash,
        stocks:
          (p as unknown as { stocks?: Record<string, unknown> | null })
            .stocks ?? null,
        job: p.job,
      })) as Partial<MafiaPlayerSnapshot>[]
    );
  }

  // 페이즈 전환별 비즈니스 로직 (이 전환을 단독 획득한 요청에서만 1회 실행)
  try {
    if (current.phase === "prepare" && to === "auction") {
      await handlePrepareToAuction(supabase, current, room);
    } else if (current.phase === "auction" && to === "trade") {
      await handleAuctionToTrade(supabase, current, room);
    } else if (current.phase === "trade" && to === "apply") {
      await handleTradeToApply(supabase, current, room);
    } else if (current.phase === "vote" && to === "end") {
      await handleVoteToEnd(supabase, current, room);
    }
  } catch (e: unknown) {
    // 비즈니스 로직 실패 시 phase를 원복해 재시도 가능하게 한다.
    await supabase
      .from("mafia_phase_state")
      .update({ phase: current.phase })
      .eq("room_code", room)
      .eq("phase", to);
    const message =
      e instanceof Error
        ? e.message
        : "페이즈 전환 비즈니스 로직 처리 중 오류가 발생했습니다.";
    return gmError(500, `페이즈 전환 실패(${getMafiaPhaseLabel(current.phase)} 유지): ${message}`);
  }

  // 특정 페이즈 전환 시 타이머를 해당 페이즈 기본값으로 리셋한다.
  // - prepare -> auction (직업 경매 시작)
  // - auction -> trade (주식 거래 시작)
  // - apply -> vote (투표 시작)
  // (리셋 시 "다음 라운드부터" 예약된 시간이 있으면 그때 적용된다 — timers/mafia reset)
  if (to === "auction" || to === "trade" || to === "vote") {
    try {
      const origin = new URL(request.url).origin;
      await fetch(`${origin}/api/gm/timers/mafia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room,
          action: "reset",
          phase: to,
        }),
      });
    } catch {
      // 타이머 리셋 실패는 페이즈 전환 자체를 막지 않는다.
    }
  }

  return NextResponse.json(
    { ok: true, phase: updatedPhase as MafiaPhaseState } as AdvanceResponse,
    { status: 200 }
  );
}
