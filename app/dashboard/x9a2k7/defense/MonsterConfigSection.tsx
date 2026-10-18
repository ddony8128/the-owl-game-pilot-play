"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { recommendedMonsterCounts } from "@/lib/defense/composition";
import { computeQueueSize } from "@/lib/defense/queue";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { GmActionApi } from "@/lib/hooks/useGmAction";

type MonsterConfig = {
  id: number;
  name: string;
  maxHp: number;
  points: number;
  base_count: number;
  count: number;
};

// 방별 몬스터 수(비율) 조절. base_count 를 수정하면 본게임 시작 시 그 값으로 풀이 리셋된다.
// Iteration 5: [저장]은 확인창을 거치고, 실패는 페이지 배너(action)로 보여 준다.
export function MonsterConfigSection({
  room,
  playerCount = 0,
  action,
  disabled = false,
}: {
  room: string;
  playerCount?: number;
  action: GmActionApi;
  disabled?: boolean;
}) {
  const [monsters, setMonsters] = useState<MonsterConfig[]>([]);
  const [draft, setDraft] = useState<Record<number, number>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // 초기 로드 완료 전에는 편집 버튼을 막고, 로드가 사용자 편집(dirty)을 덮어쓰지 않게 한다.
  const [loaded, setLoaded] = useState(false);
  const dirtyRef = useRef(false);

  const edit = (updater: (d: Record<number, number>) => Record<number, number>) => {
    dirtyRef.current = true;
    setDraft(updater);
  };

  const load = useCallback(async () => {
    const res = await fetch(
      `/api/gm/defense/monster-config?room=${encodeURIComponent(room)}`,
    );
    const json = await res.json();
    if (json.monsters) {
      setMonsters(json.monsters);
      if (!dirtyRef.current) {
        setDraft(
          Object.fromEntries(
            (json.monsters as MonsterConfig[]).map((m) => [m.id, m.base_count]),
          ),
        );
      }
      setLoaded(true);
    }
  }, [room]);

  useEffect(() => {
    // 마운트 직후 한 번 읽는다(effect 안 동기 setState 를 피하기 위해 다음 틱으로).
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [load]);

  const total = Object.values(draft).reduce((s, v) => s + (Number(v) || 0), 0);

  // 등록 인원 기준 권장 조합을 draft 에 채운다(저장은 별도 [저장] 버튼).
  const applyPreset = () => {
    const rec = recommendedMonsterCounts(playerCount);
    edit(() => Object.fromEntries(Object.entries(rec).map(([k, v]) => [Number(k), v])));
    setStatus(
      `${playerCount}명 기준 권장 조합을 불러왔습니다. 확인 후 [저장]을 누르세요.`,
    );
  };

  const save = async () => {
    setStatus(null);
    const result = await action.run<{ ok?: true; applied?: string }>("/api/gm/defense/monster-config", {
      body: { room, counts: draft },
    });
    if (result?.ok) {
      setStatus(
        result.json.applied === "next_game"
          ? "저장됨 — 본게임이 진행 중이라 다음 본게임 시작부터 적용됩니다."
          : "저장됨 — 본게임 시작 시 이 비율이 적용됩니다.",
      );
      dirtyRef.current = false;
      await load();
    } else if (result) {
      setStatus(null);
    }
  };

  const changed = monsters.filter((m) => (draft[m.id] ?? 0) !== m.base_count);

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4" data-testid="monster-config">
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
          disabled={!loaded || playerCount <= 0 || disabled}
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
                className="h-7 w-7 rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700 disabled:opacity-40"
                disabled={disabled}
                aria-label={`${m.name} 1 줄이기`}
                onClick={() =>
                  edit((d) => ({
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
                disabled={disabled}
                className="h-7 w-14 rounded border border-zinc-700 bg-zinc-950 px-2 text-center text-zinc-100"
                value={draft[m.id] ?? 0}
                onChange={(e) =>
                  edit((d) => ({
                    ...d,
                    [m.id]: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                  }))
                }
              />
              <button
                className="h-7 w-7 rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700 disabled:opacity-40"
                disabled={disabled}
                aria-label={`${m.name} 1 늘리기`}
                onClick={() =>
                  edit((d) => ({
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
          onClick={() => setConfirmOpen(true)}
          disabled={action.busy || !loaded || disabled}
          data-testid="monster-config-save"
          className="ml-auto rounded bg-amber-500 px-3 py-1.5 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {action.busy ? "저장 중…" : "저장"}
        </button>
      </div>
      {status && <p className="mt-2 text-xs text-amber-300">{status}</p>}

      <ConfirmDialog
        open={confirmOpen}
        title="몬스터 비율 저장"
        confirmLabel="저장"
        busy={action.busy}
        onClose={() => setConfirmOpen(false)}
        onConfirm={async () => {
          setConfirmOpen(false);
          await save();
        }}
      >
        <p className="text-zinc-300">
          총 <b>{total}마리</b>로 저장합니다(등록 {playerCount}명 · 권장 {playerCount * 3}마리).
        </p>
        {changed.length > 0 ? (
          <ul className="list-disc pl-5 text-zinc-300">
            {changed.map((m) => (
              <li key={m.id}>
                {m.name}: {m.base_count} → <b>{draft[m.id] ?? 0}</b>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-zinc-500">바뀐 값이 없습니다.</p>
        )}
        <p className="text-xs text-zinc-500">본게임이 이미 시작됐으면 다음 본게임 시작부터 적용됩니다.</p>
      </ConfirmDialog>
    </section>
  );
}
