import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeRoomCode } from "@/lib/rooms";
import type { MafiaPhaseState } from "@/lib/types";

// 페이즈별 기본 시간 (초)
const PHASE_DEFAULTS: Record<string, number | null> = {
  prepare: null,
  auction: 3 * 60,
  trade: 10 * 60,
  apply: null,
  vote: 5 * 60,
  end: null,
};

async function getPhaseAndTimer(room: string) {
  const supabase = createServerSupabaseClient();

  const [
    { data: phaseRow, error: phaseError },
    { data: gameRow, error: gameError },
  ] = await Promise.all([
    supabase
      .from("mafia_phase_state")
      .select("room_code, round_number, phase, updated_at")
      .eq("room_code", room)
      .maybeSingle(),
    supabase
      .from("game_state")
      .select("room_code, timer_start, timer_start_at, pause_at")
      .eq("room_code", room)
      .maybeSingle(),
  ]);

  if (phaseError) {
    throw new Error(phaseError.message);
  }
  if (!phaseRow) {
    throw new Error("mafia_phase_state가 초기화되지 않았습니다.");
  }
  if (gameError) {
    throw new Error(gameError.message);
  }

  const phaseState = phaseRow as MafiaPhaseState;
  const phaseKey = phaseState.phase;

  const base = PHASE_DEFAULTS[phaseKey] ?? 0;
  let remainingSeconds = base;
  let isRunning = false;

  if (base == null || base <= 0) {
    // 타이머가 없는 페이즈
    remainingSeconds = 0;
    isRunning = false;
  } else if (gameRow?.timer_start && gameRow.timer_start_at) {
    // 실행 중: timer_start_at 기준 now까지 경과 시간 사용
    const startedAt = new Date(gameRow.timer_start_at).getTime();
    if (!Number.isNaN(startedAt)) {
      const now = Date.now();
      const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
      remainingSeconds = Math.max(0, base - elapsed);
      isRunning = remainingSeconds > 0;
    }
  } else if (
    !gameRow?.timer_start &&
    gameRow?.pause_at &&
    gameRow.timer_start_at
  ) {
    // 일시정지 상태: timer_start_at ~ pause_at 구간만 경과 시간으로 사용
    const startedAt = new Date(gameRow.timer_start_at).getTime();
    const pausedAt = new Date(gameRow.pause_at).getTime();
    if (!Number.isNaN(startedAt) && !Number.isNaN(pausedAt)) {
      const elapsed = Math.max(0, Math.floor((pausedAt - startedAt) / 1000));
      remainingSeconds = Math.max(0, base - elapsed);
      isRunning = false;
    }
  } else {
    // 아직 시작 전이거나 reset된 상태
    remainingSeconds = base;
    isRunning = false;
  }

  return {
    supabase,
    phaseState,
    phaseKey,
    base,
    remainingSeconds,
    isRunning,
    gameRow,
  };
}

export async function GET(request: Request) {
  const room = normalizeRoomCode(
    new URL(request.url).searchParams.get("room") ?? ""
  );
  if (!room) {
    return NextResponse.json({ error: "room 필요" }, { status: 400 });
  }
  try {
    const { phaseKey, base, gameRow } = await getPhaseAndTimer(room);

    return NextResponse.json({
      phase: phaseKey,
      timerStart: !!gameRow?.timer_start,
      timerStartAt: gameRow?.timer_start_at,
      pauseAt: gameRow?.pause_at,
      totalSeconds: base ?? 0,
      serverNow: new Date().toISOString(),
    });
  } catch (e: unknown) {
    const message =
      e instanceof Error
        ? e.message
        : "마피아 타이머 상태를 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    action?: "start" | "pause" | "reset";
    phase?: string;
    room?: string;
  } | null;
  const action = body?.action;

  const room = normalizeRoomCode(body?.room ?? "");
  if (!room) {
    return NextResponse.json({ error: "room 필요" }, { status: 400 });
  }

  if (!action || !["start", "pause", "reset"].includes(action)) {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }

  try {
    const {
      supabase,
      phaseState,
      phaseKey,
      base,
      remainingSeconds: currentRemaining,
      isRunning: currentRunning,
      gameRow,
    } = await getPhaseAndTimer(room);

    let remainingSeconds = currentRemaining;
    let isRunning = currentRunning;

    // 타이머가 의미 없는 페이즈(prepare/apply/end)에서는 항상 정지 상태로 취급
    if (base == null || base <= 0) {
      await supabase
        .from("game_state")
        .update({
          timer_start: false,
          timer_start_at: null,
          pause_at: null,
        })
        .eq("room_code", room);

      return NextResponse.json({
        phase: phaseKey,
        timerStart: false,
        timerStartAt: null,
        pauseAt: null,
        totalSeconds: 0,
        serverNow: new Date().toISOString(),
      });
    }

    const now = Date.now();

    if (action === "reset") {
      // 현재 phase의 기본 시간으로 되돌리되, DB 상에서는 타이머를 끈다.
      await supabase
        .from("game_state")
        .update({
          timer_start: false,
          timer_start_at: null,
          pause_at: null,
        })
        .eq("room_code", room);
      remainingSeconds = base;
      isRunning = false;
    } else if (action === "pause") {
      if (gameRow?.timer_start && gameRow.timer_start_at && isRunning) {
        await supabase
          .from("game_state")
          .update({
            timer_start: false,
            timer_start_at: gameRow.timer_start_at,
            pause_at: new Date(now).toISOString(),
          })
          .eq("room_code", room);
        isRunning = false;
      }
    } else if (action === "start") {
      if (!gameRow?.timer_start) {
        // 1) pause_at이 없는 경우: 현재 phase의 기본 시간 전체를 새로 시작
        if (!gameRow?.pause_at) {
          const startIso = new Date(now).toISOString();
          await supabase
            .from("game_state")
            .update({
              timer_start: true,
              timer_start_at: startIso,
              pause_at: null,
            })
            .eq("room_code", room);
          remainingSeconds = base;
          isRunning = true;
        } else if (gameRow.pause_at && gameRow.timer_start_at) {
          // 2) 일시정지 상태에서 재시작:
          const startedAtMs = new Date(gameRow.timer_start_at).getTime();
          const pausedAtMs = new Date(gameRow.pause_at).getTime();
          if (!Number.isNaN(startedAtMs) && !Number.isNaN(pausedAtMs)) {
            const elapsedBeforePause = Math.max(
              0,
              Math.floor((pausedAtMs - startedAtMs) / 1000)
            );
            remainingSeconds = Math.max(0, base - elapsedBeforePause);

            const newStartMs = now - elapsedBeforePause * 1000;

            await supabase
              .from("game_state")
              .update({
                timer_start: true,
                timer_start_at: new Date(newStartMs).toISOString(),
                pause_at: null,
              })
              .eq("room_code", room);
            isRunning = remainingSeconds > 0;
          }
        }
      }
    }

    return NextResponse.json({
      phase: phaseState.phase,
      timerStart: !!gameRow?.timer_start || isRunning,
      timerStartAt: gameRow?.timer_start_at ?? null,
      pauseAt: gameRow?.pause_at ?? null,
      totalSeconds: base,
      serverNow: new Date().toISOString(),
    });
  } catch (e: unknown) {
    const message =
      e instanceof Error
        ? e.message
        : "마피아 타이머 상태를 업데이트하지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
