import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type TimerState = {
  remainingSeconds: number;
  isRunning: boolean;
  targetEpochMs: number | null;
};

let subwayTimer: TimerState = {
  remainingSeconds: 50 * 60,
  isRunning: false,
  targetEpochMs: null,
};

function recomputeRemaining(state: TimerState): boolean {
  if (!state.isRunning || state.targetEpochMs == null) return false;
  const now = Date.now();
  const diff = Math.max(0, Math.floor((state.targetEpochMs - now) / 1000));
  state.remainingSeconds = diff;
  if (diff === 0) {
    state.isRunning = false;
    state.targetEpochMs = null;
    return true;
  }
  return false;
}

async function markAllPlayersFinishedOnTimeout() {
  const supabase = createServerSupabaseClient();
  await supabase
    .from("subway_player_state")
    .update({ is_finished: true })
    .eq("is_finished", false);
}

export async function GET() {
  const timedOut = recomputeRemaining(subwayTimer);
  if (timedOut) {
    await markAllPlayersFinishedOnTimeout();
  }

  return NextResponse.json({
    remainingSeconds: subwayTimer.remainingSeconds,
    isRunning: subwayTimer.isRunning,
    serverNow: new Date().toISOString(),
    targetEpochMs: subwayTimer.targetEpochMs,
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    action?: "start" | "pause" | "reset";
  } | null;
  const action = body?.action;

  if (!action || !["start", "pause", "reset"].includes(action)) {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }

  const timedOutBefore = recomputeRemaining(subwayTimer);
  if (timedOutBefore) {
    await markAllPlayersFinishedOnTimeout();
  }

  if (action === "reset") {
    subwayTimer = {
      remainingSeconds: 50 * 60,
      isRunning: false,
      targetEpochMs: null,
    };
  } else if (action === "start") {
    if (!subwayTimer.isRunning && subwayTimer.remainingSeconds > 0) {
      const now = Date.now();
      subwayTimer.isRunning = true;
      subwayTimer.targetEpochMs = now + subwayTimer.remainingSeconds * 1000;
    }
  } else if (action === "pause") {
    if (subwayTimer.isRunning && subwayTimer.targetEpochMs != null) {
      const timedOut = recomputeRemaining(subwayTimer);
      subwayTimer.isRunning = false;
      subwayTimer.targetEpochMs = null;
      if (timedOut && !timedOutBefore) {
        await markAllPlayersFinishedOnTimeout();
      }
    }
  }

  return NextResponse.json({
    remainingSeconds: subwayTimer.remainingSeconds,
    isRunning: subwayTimer.isRunning,
    serverNow: new Date().toISOString(),
    targetEpochMs: subwayTimer.targetEpochMs,
  });
}
