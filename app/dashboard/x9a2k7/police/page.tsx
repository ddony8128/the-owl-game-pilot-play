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

    const load = async (isInitial = false) => {
      if (isInitial) {
        setLoading(true);
      }
      try {
        const res = await fetch("/api/gm/subway/reports");
        const json = (await res.json().catch(() => null)) as
          | { reports: ReportWithId[]; error?: undefined }
          | { error: string }
          | null;
        if (!res.ok || !json || "error" in json) {
          const message =
            json && "error" in json && typeof json.error === "string"
              ? json.error
              : "신고 목록을 불러오지 못했습니다.";
          throw new Error(message);
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
        if (!cancelled && isInitial) setLoading(false);
      }
    };

    // 최초 1회 로딩
    void load(true);

    // 이후에는 주기적으로 신고 목록을 폴링
    const id = setInterval(() => {
      void load(false);
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(id);
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
      <h2 className="text-base font-semibold">수배범 신고 관리</h2>
      <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg bg-zinc-900 p-3 text-xs">
        {reports.map((r) => (
          <div
            key={r.id}
            className="flex flex-col gap-1 rounded bg-zinc-950 px-3 py-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-base font-medium">
                신고자: {r.reporter_name} ({r.player_id ?? "익명"})
              </span>
              <span className="text-base text-zinc-400">{r.status}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm text-zinc-100">
              {r.content}
            </p>
          </div>
        ))}
        {reports.length === 0 && (
          <p className="text-zinc-400">아직 접수된 신고가 없습니다.</p>
        )}
      </div>
    </div>
  );
}
