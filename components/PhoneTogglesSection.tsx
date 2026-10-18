"use client";

import { PHONE_TOGGLES_MIGRATION } from "@/lib/phoneToggles";

type Toggles = { phoneLogs: boolean; phoneRemainingCount: boolean; columnMissing: boolean };

/**
 * ITER6 B5·C5(2026-10-18 또니) — 참가자 폰 편의 기능 스위치(기본 켜짐, 확인창 없음).
 *  - 폰 로그 탭 보이기(마피아·디펜스): 초보 참가자면 켜고, 숙련자 판이면 끈다.
 *  - 도감 '남은 수' 보이기(디펜스만).
 * PATCH /api/gm/rooms { code, phone_logs | phone_remaining_count } — 서버가 GM 기록을 1줄 남긴다.
 */
export function PhoneTogglesSection({
  game,
  toggles,
  disabled = false,
  busy = false,
  onToggle,
}: {
  game: "mafia" | "defense";
  toggles: Toggles | null;
  disabled?: boolean;
  busy?: boolean;
  onToggle: (key: "phone_logs" | "phone_remaining_count", next: boolean) => Promise<void>;
}) {
  const rows: { key: "phone_logs" | "phone_remaining_count"; label: string; hint: string; on: boolean }[] = [
    {
      key: "phone_logs",
      label: "참가자 폰 로그 탭 보이기",
      hint: "초보 참가자면 켜고, 기억력으로 겨루는 숙련자 판이면 끕니다.",
      on: toggles?.phoneLogs ?? true,
    },
  ];
  if (game === "defense") {
    rows.push({
      key: "phone_remaining_count",
      label: "몬스터 도감 '남은 수' 보이기",
      hint: "끄면 참가자 도감에 종류별 남은 마릿수가 보이지 않습니다.",
      on: toggles?.phoneRemainingCount ?? true,
    });
  }
  const locked = disabled || busy || !toggles || toggles.columnMissing;
  return (
    <section className="space-y-3 text-sm" data-testid="phone-toggles">
      <div>
        <h2 className="text-base font-semibold text-white">참가자 폰 설정</h2>
        <p className="text-xs text-zinc-400">게임을 시작하기 전(준비 단계)에 정해 두세요. 기본은 모두 켜짐입니다.</p>
      </div>
      {toggles?.columnMissing ? (
        <p className="text-xs text-amber-300">DB에 phone_logs 컬럼이 없습니다 — {PHONE_TOGGLES_MIGRATION} 실행</p>
      ) : null}
      <div className="space-y-2">
        {rows.map((r) => (
          <label
            key={r.key}
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3"
          >
            <span className="flex-1">
              <span className="block font-semibold text-zinc-100">{r.label}</span>
              <span className="block text-xs text-zinc-500">{r.hint}</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={r.on}
              aria-label={r.label}
              data-testid={`toggle-${r.key}`}
              disabled={locked}
              onClick={() => void onToggle(r.key, !r.on)}
              className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-40 ${
                r.on ? "bg-emerald-500" : "bg-zinc-700"
              }`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${r.on ? "left-[1.4rem]" : "left-0.5"}`}
              />
            </button>
          </label>
        ))}
      </div>
    </section>
  );
}
