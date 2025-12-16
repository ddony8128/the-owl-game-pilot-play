import { NextResponse } from "next/server";

type TimerState = {
  remainingSeconds: number;
  isRunning: boolean;
  targetEpochMs: number | null;
};

// 페이즈별 기본 시간 (초)
const PHASE_DEFAULTS: Record<string, number> = {
  auction: 3 * 60,
  trade: 10 * 60,
  apply: 2 * 60,
  vote: 5 * 60,
  end: 0,
};

let mafiaTimer: TimerState = {
  remainingSeconds: 0,
  isRunning: false,
  targetEpochMs: null,
};

let currentPhaseKey: string | null = null;

function recomputeRemaining(state: TimerState) {
  if (!state.isRunning || state.targetEpochMs == null) return;
  const now = Date.now();
  const diff = Math.max(0, Math.floor((state.targetEpochMs - now) / 1000));
  state.remainingSeconds = diff;
  if (diff === 0) {
    state.isRunning = false;
    state.targetEpochMs = null;
  }
}

export async function GET() {
  recomputeRemaining(mafiaTimer);
  return NextResponse.json({
    remainingSeconds: mafiaTimer.remainingSeconds,
    isRunning: mafiaTimer.isRunning,
    serverNow: new Date().toISOString(),
    targetEpochMs: mafiaTimer.targetEpochMs,
    phase: currentPhaseKey,
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    action?: "start" | "pause" | "reset";
    phase?: string;
  } | null;
  const action = body?.action;

  if (!action || !["start", "pause", "reset"].includes(action)) {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }

  const phase = body?.phase ?? currentPhaseKey ?? "auction";
  currentPhaseKey = phase;

  recomputeRemaining(mafiaTimer);

  if (action === "reset") {
    const base = PHASE_DEFAULTS[phase] ?? 0;
    mafiaTimer = {
      remainingSeconds: base,
      isRunning: false,
      targetEpochMs: null,
    };
  } else if (action === "start") {
    if (!mafiaTimer.isRunning && mafiaTimer.remainingSeconds > 0) {
      const now = Date.now();
      mafiaTimer.isRunning = true;
      mafiaTimer.targetEpochMs = now + mafiaTimer.remainingSeconds * 1000;
    }
  } else if (action === "pause") {
    if (mafiaTimer.isRunning && mafiaTimer.targetEpochMs != null) {
      recomputeRemaining(mafiaTimer);
      mafiaTimer.isRunning = false;
      mafiaTimer.targetEpochMs = null;
    }
  }

  return NextResponse.json({
    remainingSeconds: mafiaTimer.remainingSeconds,
    isRunning: mafiaTimer.isRunning,
    serverNow: new Date().toISOString(),
    targetEpochMs: mafiaTimer.targetEpochMs,
    phase: currentPhaseKey,
  });
}
