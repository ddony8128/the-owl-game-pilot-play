import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeRoomCode } from "@/lib/rooms";
import {
  isDefenseBoardView,
  type DefenseBoardControl,
  type DefenseBoardView,
} from "@/lib/defense/board";

type PhaseRow = {
  round: number | null;
  board_view?: string | null;
  board_round?: number | null;
  board_updated_at?: string | null;
};

function missingBoardColumns(message: string) {
  return /board_(view|round|updated_at)/i.test(message);
}

function fallback(row: PhaseRow): DefenseBoardControl {
  const round = typeof row.round === "number" ? row.round : 0;
  return {
    view: round > 0 && round <= 15 ? "monsters" : "ready",
    round,
    updatedAt: null,
  };
}

export async function GET(request: Request) {
  const supabase = createServerSupabaseClient();
  const room = normalizeRoomCode(new URL(request.url).searchParams.get("room") ?? "");
  if (!room) return NextResponse.json({ error: "room 필요" }, { status: 400 });

  const full = await supabase
    .from("defense_phase_state")
    .select("round, board_view, board_round, board_updated_at")
    .eq("room_code", room)
    .maybeSingle();

  if (full.error) {
    if (!missingBoardColumns(full.error.message)) {
      return NextResponse.json({ error: full.error.message }, { status: 500 });
    }
    const legacy = await supabase
      .from("defense_phase_state")
      .select("round")
      .eq("room_code", room)
      .maybeSingle();
    if (legacy.error || !legacy.data) {
      return NextResponse.json({ error: legacy.error?.message ?? "방 상태를 찾을 수 없습니다." }, { status: 500 });
    }
    return NextResponse.json({ ...fallback(legacy.data as PhaseRow), migrationRequired: true });
  }

  if (!full.data) return NextResponse.json({ error: "방 상태를 찾을 수 없습니다." }, { status: 404 });
  const row = full.data as PhaseRow;
  const currentRound = typeof row.round === "number" ? row.round : 0;
  // 전광판 제어 기능 도입 전에 시작된 방은 ready 기본값만 있고 변경 시각이 없다.
  // 이런 방은 현재 진행 중인 몬스터 화면으로 자연스럽게 복구한다.
  const isUninitializedActiveBoard =
    row.board_view === "ready" && !row.board_updated_at && currentRound > 0 && currentRound <= 15;
  return NextResponse.json({
    view: isUninitializedActiveBoard
      ? "monsters"
      : isDefenseBoardView(row.board_view)
        ? row.board_view
        : "ready",
    round: isUninitializedActiveBoard
      ? currentRound
      : typeof row.board_round === "number"
        ? row.board_round
        : currentRound,
    updatedAt: row.board_updated_at ?? null,
    currentRound,
  });
}

export async function PATCH(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as {
    room?: string;
    view?: DefenseBoardView;
    round?: number;
  } | null;
  const room = normalizeRoomCode(body?.room ?? "");
  if (!room) return NextResponse.json({ error: "room 필요" }, { status: 400 });
  if (!isDefenseBoardView(body?.view)) {
    return NextResponse.json({ error: "올바른 화면 모드가 아닙니다." }, { status: 400 });
  }
  const round = body?.round;
  if (!Number.isInteger(round) || (round as number) < 0 || (round as number) > 16) {
    return NextResponse.json({ error: "round는 0~16 사이의 정수여야 합니다." }, { status: 400 });
  }

  const updatedAt = new Date().toISOString();
  const result = await supabase
    .from("defense_phase_state")
    .update({ board_view: body.view, board_round: round, board_updated_at: updatedAt })
    .eq("room_code", room)
    .select("board_view, board_round, board_updated_at")
    .maybeSingle();

  if (result.error) {
    const message = missingBoardColumns(result.error.message)
      ? "공용 화면 DB 마이그레이션이 필요합니다. supabase/migrations/2026-10-10-defense-board-control.sql을 실행해주세요."
      : result.error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
  if (!result.data) return NextResponse.json({ error: "방 상태를 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ ok: true, view: body.view, round, updatedAt });
}

