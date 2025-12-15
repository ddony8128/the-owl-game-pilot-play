"use client";

import { useEffect, useState } from "react";
import type { SubwayPlayerState } from "@/lib/types";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ErrorMessage } from "@/components/ErrorMessage";

export default function DashboardSubwayPage() {
  const [rows, setRows] = useState<SubwayPlayerState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/subway/state?all=1");
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(
            data?.error ?? "subway_player_state를 불러오지 못했습니다."
          );
        }
        const json = (await res.json()) as {
          state: SubwayPlayerState[] | null;
        };
        if (cancelled) return;
        setRows(json.state ?? []);
        setError(null);
      } catch (e: unknown) {
        if (!cancelled) {
          const message =
            e instanceof Error
              ? e.message
              : "subway_player_state를 불러오지 못했습니다.";
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
      <h2 className="text-base font-semibold">이상교통 현재 현황</h2>
      <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900 text-xs">
        <table className="min-w-full border-collapse">
          <thead className="bg-zinc-800">
            <tr>
              <th className="px-2 py-1 text-left">player_id</th>
              <th className="px-2 py-1 text-left">exit</th>
              <th className="px-2 py-1 text-left">location</th>
              <th className="px-2 py-1 text-left">reset</th>
              <th className="px-2 py-1 text-left">finished</th>
              <th className="px-2 py-1 text-left">rank</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.player_id} className="border-t border-zinc-800">
                <td className="px-2 py-1">{r.player_id}</td>
                <td className="px-2 py-1">{r.exit_number}</td>
                <td className="px-2 py-1">{r.current_location ?? "-"}</td>
                <td className="px-2 py-1">{r.reset_count}</td>
                <td className="px-2 py-1">{r.is_finished ? "Y" : "N"}</td>
                <td className="px-2 py-1">{r.finished_rank ?? "-"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-2 py-4 text-center text-zinc-400">
                  subway_player_state에 데이터가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
