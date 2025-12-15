"use client";

import { useEffect, useState } from "react";
import type {
  MafiaLog,
  MafiaPhaseState,
  MafiaPlayerState,
  MafiaStockState,
} from "@/lib/types";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ErrorMessage } from "@/components/ErrorMessage";

type MafiaAdminState =
  | {
      phase: MafiaPhaseState | null;
      stocks: MafiaStockState[];
      players: MafiaPlayerState[];
      logs: MafiaLog[];
      error?: undefined;
    }
  | { error: string };

export default function DashboardMafiaPage() {
  const [phase, setPhase] = useState<MafiaPhaseState | null>(null);
  const [stocks, setStocks] = useState<MafiaStockState[]>([]);
  const [players, setPlayers] = useState<MafiaPlayerState[]>([]);
  const [logs, setLogs] = useState<MafiaLog[]>([]);
  const [newLog, setNewLog] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/mafia/state?all=1");
        const json = (await res.json().catch(() => null)) as MafiaAdminState;
        if (!res.ok || !json || "error" in json) {
          throw new Error(
            (json as { error?: string })?.error ??
              "마피아 정보를 불러오지 못했습니다."
          );
        }
        if (cancelled) return;
        setPhase(json.phase);
        setStocks(json.stocks);
        setPlayers(json.players);
        setLogs(json.logs);
        setError(null);
      } catch (e: unknown) {
        if (!cancelled) {
          const message =
            e instanceof Error ? e.message : "마피아 정보를 불러오지 못했습니다.";
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const changePhase = async (to: string) => {
    setError(null);
    try {
      const res = await fetch("/api/gm/mafia/advance-phase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ to }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: true; phase?: MafiaPhaseState; error?: string }
        | null;
      if (!res.ok || !json?.ok || !json.phase) {
        throw new Error(
          json?.error ?? "페이즈 전환 중 오류가 발생했습니다."
        );
      }
      setPhase(json.phase);
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "페이즈 전환 중 오류가 발생했습니다.";
      setError(message);
    }
  };

  const addLog = async () => {
    if (!newLog.trim()) return;
    setError(null);
    try {
      const res = await fetch("/api/gm/logs/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: newLog.trim() }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: true; log?: MafiaLog; error?: string }
        | null;
      if (!res.ok || !json?.ok || !json.log) {
        throw new Error(
          json?.error ?? "로그 추가 중 오류가 발생했습니다."
        );
      }
      setLogs((prev) => [json.log as MafiaLog, ...prev]);
      setNewLog("");
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "로그 추가 중 오류가 발생했습니다.";
      setError(message);
    }
  };

  if (loading) return <LoadingScreen />;
  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <ErrorMessage message={error} />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 text-sm">
      <section className="space-y-2">
        <h2 className="text-base font-semibold">라운드 / 페이즈</h2>
        <p className="text-xs text-zinc-400">
          현재 라운드: {phase?.round_number ?? "-"} / 페이즈:{" "}
          {phase?.phase ?? "-"}
        </p>
        <div className="flex flex-wrap gap-2 text-xs">
          {["auction", "trade", "apply", "vote", "end"].map((ph) => (
            <button
              key={ph}
              className="rounded-full bg-zinc-900 px-3 py-1 text-zinc-200 hover:bg-zinc-800"
              onClick={() => changePhase(ph)}
            >
              페이즈 전환: {ph}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">자산 현황</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900 text-xs">
          <table className="min-w-full border-collapse">
            <thead className="bg-zinc-800">
              <tr>
                <th className="px-2 py-1 text-left">player_id</th>
                <th className="px-2 py-1 text-left">cash</th>
                <th className="px-2 py-1 text-left">job</th>
                <th className="px-2 py-1 text-left">is_mafia</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.player_id} className="border-t border-zinc-800">
                  <td className="px-2 py-1">{p.player_id}</td>
                  <td className="px-2 py-1">{p.cash}</td>
                  <td className="px-2 py-1">{p.job ?? "-"}</td>
                  <td className="px-2 py-1">{p.is_mafia ? "Y" : "N"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">주가</h2>
        <div className="flex flex-wrap gap-2 text-xs">
          {stocks.map((s) => (
            <div
              key={s.stock_key}
              className="rounded-full bg-zinc-900 px-3 py-1 text-zinc-200"
            >
              {s.stock_key}: {s.price}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">라운드별 로그</h2>
        <div className="flex gap-2 text-xs">
          <input
            className="h-8 flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 text-xs outline-none focus:border-zinc-400"
            placeholder="공개 로그를 입력하세요."
            value={newLog}
            onChange={(e) => setNewLog(e.target.value)}
          />
          <button
            className="h-8 rounded bg-amber-400 px-3 text-xs font-semibold text-zinc-950 hover:bg-amber-300"
            onClick={addLog}
          >
            추가
          </button>
        </div>
        <div className="max-h-40 space-y-1 overflow-y-auto text-xs">
          {logs.map((l) => (
            <div
              key={l.id}
              className="rounded bg-zinc-900 px-2 py-1 text-zinc-100"
            >
              {l.content}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
