"use client";

import { useEffect, useState } from "react";
import type { SubwayReport } from "@/lib/types";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ErrorMessage } from "@/components/ErrorMessage";

type ReportWithId = SubwayReport;

export default function DashboardPolicePage() {
  const [reports, setReports] = useState<ReportWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/gm/subway/reports");
        const json = (await res.json().catch(() => null)) as
          | { reports: ReportWithId[]; error?: undefined }
          | { error: string }
          | null;
        if (!res.ok || !json || "error" in json) {
          throw new Error(
            (json as { error?: string })?.error ??
              "신고 목록을 불러오지 못했습니다."
          );
        }
        if (cancelled) return;
        setReports(json.reports ?? []);
        setError(null);
      } catch (e: unknown) {
        if (!cancelled) {
          const message =
            e instanceof Error ? e.message : "신고 목록을 불러오지 못했습니다.";
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

  const updateStatus = async (id: string, status: "approved" | "rejected") => {
    setError(null);
    try {
      const res = await fetch("/api/gm/subway/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, status }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: true;
        error?: string;
        report?: ReportWithId;
      } | null;
      if (!res.ok || !json?.ok || !json.report) {
        throw new Error(json?.error ?? "신고 상태를 변경하지 못했습니다.");
      }
      setReports((prev) =>
        prev.map((r) => (r.id === id ? (json.report as ReportWithId) : r))
      );
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "신고 상태를 변경하지 못했습니다.";
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
      <h2 className="text-base font-semibold">수배범 신고 관리</h2>
      <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg bg-zinc-900 p-3 text-xs">
        {reports.map((r) => (
          <div
            key={r.id}
            className="flex flex-col gap-1 rounded bg-zinc-950 px-3 py-2"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">
                신고자: {r.reporter_name} ({r.player_id ?? "익명"})
              </span>
              <span className="text-[10px] text-zinc-400">{r.status}</span>
            </div>
            <p className="whitespace-pre-wrap text-zinc-100">{r.content}</p>
            <div className="mt-1 flex gap-2 text-[11px]">
              <button
                className="h-7 rounded bg-emerald-500 px-3 text-xs font-semibold text-zinc-950 hover:bg-emerald-400"
                onClick={() => updateStatus(r.id, "approved")}
              >
                승인
              </button>
              <button
                className="h-7 rounded bg-zinc-700 px-3 text-xs text-zinc-100 hover:bg-zinc-600"
                onClick={() => updateStatus(r.id, "rejected")}
              >
                기각
              </button>
            </div>
          </div>
        ))}
        {reports.length === 0 && (
          <p className="text-zinc-400">아직 접수된 신고가 없습니다.</p>
        )}
      </div>
    </div>
  );
}
