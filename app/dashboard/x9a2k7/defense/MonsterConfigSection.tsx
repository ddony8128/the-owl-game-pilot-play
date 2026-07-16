"use client";

import { useCallback, useEffect, useState } from "react";
import { recommendedMonsterCounts } from "@/lib/defense/composition";
import { computeQueueSize } from "@/lib/defense/queue";

type MonsterConfig = {
  id: number;
  name: string;
  maxHp: number;
  points: number;
  base_count: number;
  count: number;
};

// 방별 몬스터 수(비율) 조절. base_count 를 수정하면 본게임 시작 시 그 값으로 풀이 리셋된다.
export function MonsterConfigSection({
  room,
  playerCount = 0,
}: {
  room: string;
  playerCount?: number;
}) {
  const [monsters, setMonsters] = useState<MonsterConfig[]>([]);
  const [draft, setDraft] = useState<Record<number, number>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(
      `/api/gm/defense/monster-config?room=${encodeURIComponent(room)}`,
    );
    const json = await res.json();
    if (json.monsters) {
      setMonsters(json.monsters);
      setDraft(
        Object.fromEntries(
          (json.monsters as MonsterConfig[]).map((m) => [m.id, m.base_count]),
        ),
      );
    }
  }, [room]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = Object.values(draft).reduce((s, v) => s + (Number(v) || 0), 0);

  // 등록 인원 기준 권장 조합을 draft 에 채운다(저장은 별도 [저장] 버튼).
  const applyPreset = () => {
    const rec = recommendedMonsterCounts(playerCount);
    setDraft(Object.fromEntries(Object.entries(rec).map(([k, v]) => [Number(k), v])));
    setStatus(
      `${playerCount}명 기준 권장 조합을 불러왔습니다. 확인 후 [저장]을 누르세요.`,
    );
  };

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/gm/defense/monster-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room, counts: draft }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "저장 실패");
      setStatus("저장됨 — 본게임 시작 시 이 비율이 적용됩니다.");
      await load();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <h3 className="text-sm font-semibold text-zinc-100">몬스터 수 조절</h3>
      <p className="mt-1 text-xs text-zinc-400">
        인원에 맞춰 몬스터 종류별 마릿수를 정합니다. <b>본게임 시작(라운드 진입) 전에</b> 조절하세요.
        저장하면 본게임 시작 시 이 값으로 몬스터 풀이 채워집니다. (이 방에만 적용)
      </p>

      <div className="mt-2 flex items-center gap-2 rounded bg-zinc-950/60 px-2 py-1.5 text-xs text-zinc-400">
        <span>
          등록 인원 <b className="text-zinc-200">{playerCount}명</b> · 대기열{" "}
          <b className="text-amber-300">{computeQueueSize(playerCount)}칸</b>
        </span>
        <button
          onClick={applyPreset}
          disabled={playerCount <= 0}
          className="ml-auto rounded bg-zinc-800 px-2.5 py-1 font-semibold text-amber-300 hover:bg-zinc-700 disabled:opacity-40"
        >
          인원 기준 자동 세팅
        </button>
      </div>

      <div className="mt-3 space-y-1.5">
        {monsters.map((m) => (
          <div key={m.id} className="flex items-center gap-2 text-sm">
            <span className="w-28 text-zinc-200">{m.name}</span>
            <span className="w-24 text-xs text-zinc-500">
              HP {m.maxHp} · {m.points}점
            </span>
            <div className="ml-auto flex items-center gap-1">
              <button
                className="h-7 w-7 rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    [m.id]: Math.max(0, (Number(d[m.id]) || 0) - 1),
                  }))
                }
              >
                −
              </button>
              <input
                type="number"
                min={0}
                className="h-7 w-14 rounded border border-zinc-700 bg-zinc-950 px-2 text-center text-zinc-100"
                value={draft[m.id] ?? 0}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    [m.id]: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                  }))
                }
              />
              <button
                className="h-7 w-7 rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    [m.id]: (Number(d[m.id]) || 0) + 1,
                  }))
                }
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <span className="text-xs text-zinc-400">합계: <b className="text-zinc-200">{total}</b>마리</span>
        <button
          onClick={() => void save()}
          disabled={saving}
          className="ml-auto rounded bg-amber-500 px-3 py-1.5 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {saving ? "저장 중…" : "저장"}
        </button>
      </div>
      {status && <p className="mt-2 text-xs text-amber-300">{status}</p>}
    </section>
  );
}
