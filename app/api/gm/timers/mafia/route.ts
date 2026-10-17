import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeRoomCode } from "@/lib/rooms";
import type { MafiaPhaseState } from "@/lib/types";
import { gmError, loadRoomForWrite } from "@/lib/admin/gmResponse";
import { addGmLog } from "@/lib/admin/gmLog";
import { getMafiaPhaseLabel } from "@/lib/labels/mafia";
import {
  applyTimerChange,
  computeNewTotal,
  formatSeconds,
  parseApplyWhen,
  pendingDuration,
  promotePending,
  resolveDuration,
  type TimerConfig,
} from "@/lib/admin/timerConfig";
import { TIMER_CONFIG_MIGRATION, readTimerRow, writeTimerConfig } from "@/lib/admin/timerStore";

import { MAFIA_PHASE_DEFAULTS, MAFIA_TIMED_PHASES } from "@/lib/admin/timerDefaults";

// 페이즈별 기본 시간은 lib/admin/timerDefaults. Iteration 5: GM이 페이즈별로 1~30분(±30초)으로 조정 가능(game_state.timer_config).

function totalFor(cfg: TimerConfig, phase: string): number {
  const base = MAFIA_PHASE_DEFAULTS[phase] ?? null;
  if (base == null) return 0;
  return resolveDuration(cfg, phase, base);
}

function durationsView(cfg: TimerConfig) {
  return Object.fromEntries(
    MAFIA_TIMED_PHASES.map((p) => [
      p,
      { totalSeconds: totalFor(cfg, p), defaultSeconds: MAFIA_PHASE_DEFAULTS[p] ?? 0, pendingTotalSeconds: pendingDuration(cfg, p) },
    ]),
  );
}

async function getPhase(supabase: ReturnType<typeof createServerSupabaseClient>, room: string) {
  const { data: phaseRow, error: phaseError } = await supabase
    .from("mafia_phase_state")
    .select("room_code, round_number, phase, updated_at")
    .eq("room_code", room)
    .maybeSingle();
  if (phaseError) throw new Error(phaseError.message);
  if (!phaseRow) throw new Error("mafia_phase_state가 초기화되지 않았습니다.");
  return phaseRow as MafiaPhaseState;
}

export async function GET(request: Request) {
  const room = normalizeRoomCode(
    new URL(request.url).searchParams.get("room") ?? ""
  );
  if (!room) {
    return NextResponse.json({ error: "room 필요" }, { status: 400 });
  }
  try {
    const supabase = createServerSupabaseClient();
    const phaseState = await getPhase(supabase, room);
    const { row, config, columnMissing } = await readTimerRow(supabase, room);
    const phaseKey = phaseState.phase;

    return NextResponse.json({
      phase: phaseKey,
      timerStart: !!row?.timer_start,
      timerStartAt: row?.timer_start_at ?? null,
      pauseAt: row?.pause_at ?? null,
      totalSeconds: totalFor(config, phaseKey),
      defaultSeconds: MAFIA_PHASE_DEFAULTS[phaseKey] ?? 0,
      pendingTotalSeconds: pendingDuration(config, phaseKey),
      durations: durationsView(config),
      configurable: !columnMissing,
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

type PostBody = {
  action?: unknown;
  phase?: unknown;
  room?: unknown;
  minutes?: unknown;
  seconds?: unknown;
  delta?: unknown;
  applyTo?: unknown;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as PostBody | null;
  const action = body?.action;

  const room = normalizeRoomCode(typeof body?.room === "string" ? body.room : "");
  if (!room) {
    return gmError(400, "room 필요", "invalid_input");
  }

  if (action !== "start" && action !== "pause" && action !== "reset" && action !== "set") {
    return gmError(400, "invalid action", "invalid_input");
  }

  try {
    const supabase = createServerSupabaseClient();
    const guard = await loadRoomForWrite(supabase, room);
    if (!guard.ok) return guard.response;

    const phaseState = await getPhase(supabase, room);
    const { row: gameRow, config, columnMissing } = await readTimerRow(supabase, room);
    let cfg = config;
    const phaseKey = phaseState.phase;
    const now = Date.now();

    if (action === "set") {
      if (columnMissing) {
        return gmError(
          503,
          `DB에 game_state.timer_config 컬럼이 없습니다 — ${TIMER_CONFIG_MIGRATION} 실행`,
          "schema_missing",
        );
      }
      // 조정 대상 페이즈: 지정하지 않으면 현재 페이즈. 타이머가 있는 페이즈(경매·거래·투표)만.
      const target = typeof body?.phase === "string" ? body.phase.trim() : phaseKey;
      if (!(MAFIA_TIMED_PHASES as readonly string[]).includes(target)) {
        return gmError(
          400,
          `타이머를 조정할 수 있는 단계는 ${MAFIA_TIMED_PHASES.map((p) => getMafiaPhaseLabel(p)).join(" · ")}입니다.`,
          "invalid_input",
        );
      }
      const when = parseApplyWhen(body?.applyTo);
      if (!when) return gmError(400, "applyTo 는 now | next", "invalid_input");
      const currentTotal = totalFor(cfg, target);
      const base = when === "next" ? pendingDuration(cfg, target) ?? currentTotal : currentTotal;
      const computed = computeNewTotal(base, {
        minutes: body?.minutes,
        seconds: body?.seconds,
        delta: body?.delta,
      });
      if (!computed.ok) return gmError(400, computed.error, "invalid_input");
      // 지금 진행 중이 아닌 단계를 "즉시"로 바꾸면 그 단계가 시작될 때 적용된다 — durations 에 바로 둔다.
      cfg = applyTimerChange(cfg, target, computed.total, when);
      await writeTimerConfig(supabase, room, cfg);
      await addGmLog(supabase, {
        room,
        game: "mafia",
        kind: "timer",
        content: `타이머(${getMafiaPhaseLabel(target as MafiaPhaseState["phase"])}) ${
          when === "now" ? "즉시" : "다음 라운드부터"
        } ${formatSeconds(computed.total)}${when === "now" ? ` (이전 ${formatSeconds(currentTotal)})` : ""}`,
        meta: { key: target, total: computed.total, when, before: currentTotal },
      });
    } else {
      const base = totalFor(cfg, phaseKey);

      // 타이머가 의미 없는 페이즈(prepare/apply/end)에서는 항상 정지 상태로 취급
      if (base <= 0) {
        await supabase
          .from("game_state")
          .update({
            timer_start: false,
            timer_start_at: null,
            pause_at: null,
          })
          .eq("room_code", room);
      } else if (action === "reset") {
        // 현재 phase의 기본 시간으로 되돌리되, DB 상에서는 타이머를 끈다. 예약된 시간은 이때 적용.
        const promoted = promotePending(cfg, phaseKey);
        if (promoted.promoted != null && !columnMissing) {
          cfg = promoted.cfg;
          await writeTimerConfig(supabase, room, cfg);
        }
        await supabase
          .from("game_state")
          .update({
            timer_start: false,
            timer_start_at: null,
            pause_at: null,
          })
          .eq("room_code", room);
      } else if (action === "pause") {
        if (gameRow?.timer_start && gameRow.timer_start_at) {
          await supabase
            .from("game_state")
            .update({
              timer_start: false,
              timer_start_at: gameRow.timer_start_at,
              pause_at: new Date(now).toISOString(),
            })
            .eq("room_code", room);
        }
      } else if (action === "start") {
        if (!gameRow?.timer_start) {
          if (!gameRow?.pause_at) {
            // 1) pause_at이 없는 경우: 현재 phase의 전체 시간을 새로 시작(예약된 시간 적용)
            const promoted = promotePending(cfg, phaseKey);
            if (promoted.promoted != null && !columnMissing) {
              cfg = promoted.cfg;
              await writeTimerConfig(supabase, room, cfg);
            }
            const startIso = new Date(now).toISOString();
            await supabase
              .from("game_state")
              .update({
                timer_start: true,
                timer_start_at: startIso,
                pause_at: null,
              })
              .eq("room_code", room);
          } else if (gameRow.pause_at && gameRow.timer_start_at) {
            // 2) 일시정지 상태에서 재시작
            const startedAtMs = new Date(gameRow.timer_start_at).getTime();
            const pausedAtMs = new Date(gameRow.pause_at).getTime();
            if (!Number.isNaN(startedAtMs) && !Number.isNaN(pausedAtMs)) {
              const elapsedBeforePause = Math.max(
                0,
                Math.floor((pausedAtMs - startedAtMs) / 1000)
              );
              const newStartMs = now - elapsedBeforePause * 1000;
              await supabase
                .from("game_state")
                .update({
                  timer_start: true,
                  timer_start_at: new Date(newStartMs).toISOString(),
                  pause_at: null,
                })
                .eq("room_code", room);
            }
          }
        }
      }
    }

    const { row: after } = await readTimerRow(supabase, room);
    return NextResponse.json({
      phase: phaseKey,
      timerStart: !!after?.timer_start,
      timerStartAt: after?.timer_start_at ?? null,
      pauseAt: after?.pause_at ?? null,
      totalSeconds: totalFor(cfg, phaseKey),
      defaultSeconds: MAFIA_PHASE_DEFAULTS[phaseKey] ?? 0,
      pendingTotalSeconds: pendingDuration(cfg, phaseKey),
      durations: durationsView(cfg),
      configurable: !columnMissing,
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
