"use client";

import { useEffect, useMemo, useState } from "react";

type PlayerAsset = {
  player_id: string;
  nickname: string | null;
  job: string | null;
  is_mafia: boolean;
  cash: number;
  holdings_value: number;
  total_assets: number;
};

type Summary = {
  finished: boolean;
  currentRound: number;
  rounds: { round: number; players: PlayerAsset[] }[];
  final: PlayerAsset[];
};

const JOB_LABEL: Record<string, string> = {
  up_manipulator: "상승 조작범",
  down_manipulator: "하락 조작범",
  robber: "강도",
  police: "경찰",
  tax_auditor: "세무조사원",
  mayor: "시장",
  broker: "증권사 직원",
  ceo: "CEO",
  salaryman: "월급쟁이",
};

function jobLabel(job: string | null): string {
  if (!job) return "월급쟁이";
  return JOB_LABEL[job] ?? job;
}

const RANK_ACCENT = ["text-amber-300", "text-zinc-200", "text-orange-400"];

export function MafiaBoardClient() {
  const [room] = useState<string | null>(() =>
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("room")
      : null
  );
  const [roomInput, setRoomInput] = useState("");
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!room) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(
          `/api/mafia/board-summary?room=${encodeURIComponent(room)}`
        );
        const json = (await res.json().catch(() => null)) as
          | Summary
          | { error: string }
          | null;
        if (!res.ok || !json || "error" in json) {
          throw new Error(
            (json as { error?: string })?.error ??
              "결과를 불러오지 못했습니다."
          );
        }
        if (cancelled) return;
        setData(json);
        setError(null);
      } catch (e: unknown) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "결과를 불러오지 못했습니다.");
      }
    };
    void load();
    const interval = setInterval(() => void load(), 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [room]);

  // 라운드별 추이 테이블용: player_id → (round → asset)
  const { rowOrder, byPlayerRound, roundList } = useMemo(() => {
    const order = (data?.final ?? []).map((p) => p.player_id);
    const map = new Map<string, Map<number, PlayerAsset>>();
    const rounds: number[] = [];
    for (const rd of data?.rounds ?? []) {
      rounds.push(rd.round);
      for (const p of rd.players) {
        if (!map.has(p.player_id)) map.set(p.player_id, new Map());
        map.get(p.player_id)!.set(rd.round, p);
      }
    }
    return { rowOrder: order, byPlayerRound: map, roundList: rounds };
  }, [data]);

  if (!room) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 px-8 text-zinc-50">
        <p className="text-2xl">결과 페이지 — 방 코드가 필요합니다.</p>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const code = roomInput.trim().toUpperCase();
            if (code) window.location.search = `?room=${encodeURIComponent(code)}`;
          }}
        >
          <input
            className="h-10 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-base outline-none focus:border-zinc-400"
            placeholder="방 코드"
            value={roomInput}
            onChange={(e) => setRoomInput(e.target.value)}
          />
          <button
            type="submit"
            className="h-10 rounded-lg bg-amber-400 px-4 text-base font-semibold text-zinc-950 hover:bg-amber-300"
          >
            이동
          </button>
        </form>
      </div>
    );
  }

  // 게임 종료 전: 결과 비공개
  if (!data?.finished) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-950 px-8 text-center text-zinc-50">
        <p className="text-4xl font-bold">자본주의 마피아</p>
        <p className="mt-2 text-2xl text-zinc-300">게임이 끝나면 결과가 공개됩니다</p>
        <p className="text-lg text-zinc-500">
          각 라운드의 재산 변동과 직업(마피아 포함)은 게임 종료 후 이 화면에 표시됩니다.
        </p>
        {error && <p className="mt-4 text-base text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-8 py-8 text-zinc-50">
      <h1 className="mb-6 text-4xl font-bold tracking-tight">
        자본주의 마피아 — 최종 결과
      </h1>

      {/* 최종 순위 */}
      <section className="mb-10">
        <h2 className="mb-3 text-2xl font-semibold text-zinc-200">최종 순위</h2>
        <ol className="space-y-3">
          {data.final.map((r, i) => (
            <li
              key={r.player_id}
              className={`flex items-center justify-between rounded-2xl border px-6 py-4 ${
                r.is_mafia
                  ? "border-red-500/70 bg-red-950/40"
                  : "border-zinc-800 bg-zinc-900"
              }`}
            >
              <div className="flex items-center gap-6">
                <span
                  className={`w-14 text-center text-4xl font-black ${
                    RANK_ACCENT[i] ?? "text-zinc-500"
                  }`}
                >
                  {i + 1}
                </span>
                <div>
                  <p className="text-3xl font-bold">
                    {r.nickname ?? "(이름 없음)"}
                    {r.is_mafia && (
                      <span className="ml-3 rounded bg-red-600 px-2 py-0.5 text-lg font-semibold text-white">
                        마피아
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-lg text-zinc-400">
                    최종 직업: {jobLabel(r.job)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-4xl font-black text-amber-300">
                  {r.total_assets.toLocaleString()}원
                </p>
                <p className="mt-1 text-base text-zinc-400">
                  현금 {r.cash.toLocaleString()} · 주식{" "}
                  {r.holdings_value.toLocaleString()}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* 라운드별 재산/직업 추이 */}
      <section>
        <h2 className="mb-3 text-2xl font-semibold text-zinc-200">
          라운드별 재산 추이 · 직업
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-base">
            <thead>
              <tr>
                <th className="sticky left-0 bg-zinc-950 px-3 py-2 text-left text-zinc-400">
                  플레이어
                </th>
                {roundList.map((r) => (
                  <th
                    key={r}
                    className="px-3 py-2 text-center text-zinc-400"
                  >
                    {r}라운드
                  </th>
                ))}
                <th className="px-3 py-2 text-center text-amber-300">최종</th>
              </tr>
            </thead>
            <tbody>
              {rowOrder.map((pid) => {
                const fin = data.final.find((p) => p.player_id === pid);
                const perRound = byPlayerRound.get(pid);
                return (
                  <tr key={pid} className="border-t border-zinc-800">
                    <td className="sticky left-0 bg-zinc-950 px-3 py-2 font-semibold">
                      {fin?.nickname ?? "(이름 없음)"}
                    </td>
                    {roundList.map((r) => {
                      const cell = perRound?.get(r) ?? null;
                      return (
                        <td
                          key={r}
                          className={`px-3 py-2 text-center ${
                            cell?.is_mafia ? "bg-red-950/40 text-red-200" : ""
                          }`}
                        >
                          {cell ? (
                            <>
                              <div className="text-sm text-zinc-400">
                                {jobLabel(cell.job)}
                              </div>
                              <div className="font-semibold">
                                {cell.total_assets.toLocaleString()}원
                              </div>
                            </>
                          ) : (
                            <span className="text-zinc-600">-</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center font-bold text-amber-300">
                      {fin ? `${fin.total_assets.toLocaleString()}원` : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-zinc-500">
          빨간 칸은 그 라운드에 마피아(주가조작범·강도) 직업이었음을 뜻합니다. 자산 =
          현금 + 보유주식 평가액(해당 라운드 종료 시점 주가 기준).
        </p>
      </section>
    </div>
  );
}
