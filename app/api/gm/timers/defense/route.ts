import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeRoomCode } from "@/lib/rooms";

// 디펜스 딜레마 전역 카운트다운 기본 시간 (초)
// 라운드당 5분
const TOTAL_SECONDS = 5 * 60;

async function getGameStateTimer(room: string) {
  const supabase = createServerSupabaseClient();
  const { data: gameRow, error } = await supabase
    .from("game_state")
    .select("room_code, timer_start, timer_start_at, pause_at")
    .eq("room_code", room)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  let remainingSeconds = TOTAL_SECONDS;
  let isRunning = false;

  if (gameRow?.timer_start && gameRow.timer_start_at) {
    const startedAt = new Date(gameRow.timer_start_at).getTime();
    if (!Number.isNaN(startedAt)) {
      const now = Date.now();
      const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
      remainingSeconds = Math.max(0, TOTAL_SECONDS - elapsed);
      isRunning = remainingSeconds > 0;
    }
  } else if (
    !gameRow?.timer_start &&
    gameRow?.pause_at &&
    gameRow.timer_start_at
  ) {
    const startedAt = new Date(gameRow.timer_start_at).getTime();
    const pausedAt = new Date(gameRow.pause_at).getTime();
    if (!Number.isNaN(startedAt) && !Number.isNaN(pausedAt)) {
      const elapsed = Math.max(0, Math.floor((pausedAt - startedAt) / 1000));
      remainingSeconds = Math.max(0, TOTAL_SECONDS - elapsed);
      isRunning = false;
    }
  } else {
    // 아직 시작 전이거나 reset된 상태
    remainingSeconds = TOTAL_SECONDS;
    isRunning = false;
  }

  return { supabase, gameRow, remainingSeconds, isRunning };
}

export async function GET(request: Request) {
  const room = normalizeRoomCode(
    new URL(request.url).searchParams.get("room") ?? ""
  );
  if (!room) {
    return NextResponse.json({ error: "room 필요" }, { status: 400 });
  }
  try {
    const { gameRow } = await getGameStateTimer(room);

    return NextResponse.json({
      timerStart: !!gameRow?.timer_start,
      timerStartAt: gameRow?.timer_start_at,
      pauseAt: gameRow?.pause_at,
      totalSeconds: TOTAL_SECONDS,
      serverNow: new Date().toISOString(),
    });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "디펜스 타이머 상태를 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    action?: "start" | "pause" | "reset";
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
      gameRow,
      remainingSeconds: currentRemaining,
      isRunning: currentRunning,
    } = await getGameStateTimer(room);

    let remainingSeconds = currentRemaining;
    let isRunning = currentRunning;

    const now = Date.now();

    if (action === "reset") {
      await supabase
        .from("game_state")
        .update({
          timer_start: false,
          timer_start_at: null,
          pause_at: null,
        })
        .eq("room_code", room);
      remainingSeconds = TOTAL_SECONDS;
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
          remainingSeconds = TOTAL_SECONDS;
          isRunning = true;
        } else if (gameRow.pause_at && gameRow.timer_start_at) {
          const startedAtMs = new Date(gameRow.timer_start_at).getTime();
          const pausedAtMs = new Date(gameRow.pause_at).getTime();
          if (!Number.isNaN(startedAtMs) && !Number.isNaN(pausedAtMs)) {
            const elapsedBeforePause = Math.max(
              0,
              Math.floor((pausedAtMs - startedAtMs) / 1000)
            );
            remainingSeconds = Math.max(0, TOTAL_SECONDS - elapsedBeforePause);

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
      timerStart: !!gameRow?.timer_start || isRunning,
      timerStartAt: gameRow?.timer_start_at ?? null,
      pauseAt: gameRow?.pause_at ?? null,
      totalSeconds: TOTAL_SECONDS,
      serverNow: new Date().toISOString(),
    });
  } catch (e: unknown) {
    const message =
      e instanceof Error
        ? e.message
        : "디펜스 타이머 상태를 업데이트하지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


