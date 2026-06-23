import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeRoomCode } from "@/lib/rooms";

// 1게임 – 이상교통 전역 카운트다운은 항상 40분(2400초)을 기준으로 한다.
const TOTAL_SECONDS = 40 * 60;

async function markAllPlayersFinishedOnTimeout(room: string) {
  const supabase = createServerSupabaseClient();
  await supabase
    .from("subway_player_state")
    .update({ is_finished: true })
    .eq("room_code", room)
    .eq("is_finished", false);
}

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
    const { supabase, gameRow, remainingSeconds } = await getGameStateTimer(
      room
    );

    // 실행 중인데 남은 시간이 0이 된 경우: 이 시점에서 종료 처리
    if (remainingSeconds === 0 && gameRow?.timer_start) {
      await markAllPlayersFinishedOnTimeout(room);
      await supabase
        .from("game_state")
        .update({ timer_start: false, pause_at: null })
        .eq("room_code", room);
    }

    // 서버는 "기준점"만 내려주고, 남은 시간 계산과 표시 책임은 클라이언트가 진다.
    return NextResponse.json({
      timerStart: !!gameRow?.timer_start,
      timerStartAt: gameRow?.timer_start_at,
      pauseAt: gameRow?.pause_at,
      totalSeconds: TOTAL_SECONDS,
      serverNow: new Date().toISOString(),
    });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "타이머 상태를 불러오지 못했습니다.";
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

    // 실행 중인데 이미 0초가 된 상태에서의 조작은 종료 처리 후 무시
    if (remainingSeconds === 0 && gameRow?.timer_start) {
      await markAllPlayersFinishedOnTimeout(room);
      await supabase
        .from("game_state")
        .update({ timer_start: false, pause_at: null })
        .eq("room_code", room);
      isRunning = false;
    }

    if (action === "reset") {
      // 완전 초기화: DB 상에서 타이머를 끄고, 다시 50분 대기로 만든다.
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
      // 실행 중일 때만 일시정지
      if (gameRow?.timer_start && gameRow.timer_start_at && isRunning) {
        await supabase
          .from("game_state")
          .update({
            timer_start: false,
            // 시작 시각은 유지하고, 일시정지 시각만 기록
            timer_start_at: gameRow.timer_start_at,
            pause_at: new Date(now).toISOString(),
          })
          .eq("room_code", room);
        isRunning = false;
        // remainingSeconds는 getGameStateTimer 로직에 의해 일시정지 기준으로 유지
      }
    } else if (action === "start") {
      // 이미 실행 중이면 무시
      if (!gameRow?.timer_start) {
        // 1) pause_at이 없는 경우: 50분 전체를 새로 시작
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
          // 2) 일시정지 상태에서 재시작:
          //    pause 시점까지의 경과 시간을 유지하고, 그 이후 경과 시간은 무시해야 한다.
          const startedAtMs = new Date(gameRow.timer_start_at).getTime();
          const pausedAtMs = new Date(gameRow.pause_at).getTime();
          if (!Number.isNaN(startedAtMs) && !Number.isNaN(pausedAtMs)) {
            const elapsedBeforePause = Math.max(
              0,
              Math.floor((pausedAtMs - startedAtMs) / 1000)
            );
            remainingSeconds = Math.max(0, TOTAL_SECONDS - elapsedBeforePause);

            // now 시점에서 elapsed가 elapsedBeforePause가 되도록
            // timer_start_at을 앞으로 당겨서(pausedDuration 만큼) 보정한다.
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

    // POST 응답도 기준점 정보만 내려준다.
    return NextResponse.json({
      timerStart: !!gameRow?.timer_start || isRunning,
      timerStartAt: gameRow?.timer_start_at ?? null,
      pauseAt: gameRow?.pause_at ?? null,
      totalSeconds: TOTAL_SECONDS,
      serverNow: new Date().toISOString(),
    });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "타이머 상태를 업데이트하지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
