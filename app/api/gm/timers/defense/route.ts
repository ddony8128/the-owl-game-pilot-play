import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeRoomCode } from "@/lib/rooms";
import { gmError, loadRoomForWrite } from "@/lib/admin/gmResponse";
import { addGmLog } from "@/lib/admin/gmLog";
import {
  applyTimerChange,
  computeNewTotal,
  formatSeconds,
  parseApplyWhen,
  pendingDuration,
  promotePending,
  resolveDuration,
} from "@/lib/admin/timerConfig";
import {
  DEFENSE_TIMER_KEY,
  TIMER_CONFIG_MIGRATION,
  readTimerRow,
  writeTimerConfig,
} from "@/lib/admin/timerStore";

import { DEFENSE_TIMER_DEFAULT_SECONDS } from "@/lib/admin/timerDefaults";

// 디펜스 딜레마 전역 카운트다운 기본 시간은 lib/admin/timerDefaults(5분).
// Iteration 5: GM이 1~30분(±30초, 프리셋)으로 조정 가능. 설정은 game_state.timer_config 에 저장.

export async function GET(request: Request) {
  const room = normalizeRoomCode(
    new URL(request.url).searchParams.get("room") ?? ""
  );
  if (!room) {
    return NextResponse.json({ error: "room 필요" }, { status: 400 });
  }
  try {
    const supabase = createServerSupabaseClient();
    const { row, config, columnMissing } = await readTimerRow(supabase, room);
    const total = resolveDuration(config, DEFENSE_TIMER_KEY, DEFENSE_TIMER_DEFAULT_SECONDS);

    return NextResponse.json({
      timerStart: !!row?.timer_start,
      timerStartAt: row?.timer_start_at ?? null,
      pauseAt: row?.pause_at ?? null,
      totalSeconds: total,
      defaultSeconds: DEFENSE_TIMER_DEFAULT_SECONDS,
      pendingTotalSeconds: pendingDuration(config, DEFENSE_TIMER_KEY),
      configurable: !columnMissing,
      serverNow: new Date().toISOString(),
    });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "디펜스 타이머 상태를 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type PostBody = {
  action?: unknown;
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
    // 종료된 방은 읽기 전용(409 room_ended)
    const guard = await loadRoomForWrite(supabase, room);
    if (!guard.ok) return guard.response;

    const { row: gameRow, config, columnMissing } = await readTimerRow(supabase, room);
    let cfg = config;
    const now = Date.now();

    if (action === "set") {
      // 시간 조정: 1~30분 정수 / ±30초 / 즉시 또는 다음 라운드부터
      if (columnMissing) {
        return gmError(
          503,
          `DB에 game_state.timer_config 컬럼이 없습니다 — ${TIMER_CONFIG_MIGRATION} 실행`,
          "schema_missing",
        );
      }
      const when = parseApplyWhen(body?.applyTo);
      if (!when) return gmError(400, "applyTo 는 now | next", "invalid_input");
      const currentTotal = resolveDuration(cfg, DEFENSE_TIMER_KEY, DEFENSE_TIMER_DEFAULT_SECONDS);
      // ±30초를 "다음 라운드부터"에 적용할 땐 예약된 값이 있으면 그 값을 기준으로 더한다.
      const base = when === "next" ? pendingDuration(cfg, DEFENSE_TIMER_KEY) ?? currentTotal : currentTotal;
      const computed = computeNewTotal(base, {
        minutes: body?.minutes,
        seconds: body?.seconds,
        delta: body?.delta,
      });
      if (!computed.ok) return gmError(400, computed.error, "invalid_input");
      cfg = applyTimerChange(cfg, DEFENSE_TIMER_KEY, computed.total, when);
      await writeTimerConfig(supabase, room, cfg);
      await addGmLog(supabase, {
        room,
        game: "defense",
        kind: "timer",
        content: `타이머 ${when === "now" ? "즉시" : "다음 라운드부터"} ${formatSeconds(computed.total)}${
          when === "now" ? ` (이전 ${formatSeconds(currentTotal)})` : ""
        }`,
        meta: { key: DEFENSE_TIMER_KEY, total: computed.total, when, before: currentTotal },
      });
    } else if (action === "reset") {
      // 리셋: 타이머를 끄고, 예약된 "다음 라운드부터" 시간을 적용한다.
      const promoted = promotePending(cfg, DEFENSE_TIMER_KEY);
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
          // 새 시작: 예약된 시간이 있으면 이때 적용
          const promoted = promotePending(cfg, DEFENSE_TIMER_KEY);
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

    const { row: after } = await readTimerRow(supabase, room);
    return NextResponse.json({
      timerStart: !!after?.timer_start,
      timerStartAt: after?.timer_start_at ?? null,
      pauseAt: after?.pause_at ?? null,
      totalSeconds: resolveDuration(cfg, DEFENSE_TIMER_KEY, DEFENSE_TIMER_DEFAULT_SECONDS),
      defaultSeconds: DEFENSE_TIMER_DEFAULT_SECONDS,
      pendingTotalSeconds: pendingDuration(cfg, DEFENSE_TIMER_KEY),
      configurable: !columnMissing,
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
