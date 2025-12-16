"use client";

import { useEffect, useState } from "react";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ErrorMessage } from "@/components/ErrorMessage";

type GmMemo = {
  id: number;
  content: string;
  created_at: string;
};

export default function DashboardMemoPage() {
  const [memos, setMemos] = useState<GmMemo[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/gm/memos");
        const json = (await res.json().catch(() => null)) as
          | { memos: GmMemo[]; error?: undefined }
          | { error: string }
          | null;
        if (!res.ok || !json || "error" in json) {
          throw new Error(
            (json as { error?: string })?.error ?? "메모를 불러오지 못했습니다."
          );
        }
        if (cancelled) return;
        setMemos(json.memos ?? []);
        setError(null);
      } catch (e: unknown) {
        if (!cancelled) {
          const message =
            e instanceof Error ? e.message : "메모를 불러오지 못했습니다.";
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

  const saveMemo = async () => {
    if (!content.trim()) return;
    setError(null);
    try {
      const res = await fetch("/api/gm/memos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: true;
        memo?: GmMemo;
        error?: string;
      } | null;
      if (!res.ok || !json?.ok || !json.memo) {
        throw new Error(json?.error ?? "메모를 저장하지 못했습니다.");
      }
      setMemos((prev) => [json.memo as GmMemo, ...prev]);
      setContent("");
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "메모를 저장하지 못했습니다.";
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
      <h2 className="text-base font-semibold">GM 메모</h2>
      <div className="space-y-2 text-xs">
        <textarea
          className="h-24 w-full rounded border border-zinc-700 bg-zinc-900 p-2 text-xs outline-none focus:border-zinc-400"
          placeholder="GM용 메모를 입력하세요."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <button
          className="h-9 rounded bg-amber-400 px-4 text-xs font-semibold text-zinc-950 hover:bg-amber-300"
          onClick={saveMemo}
        >
          저장
        </button>
      </div>

      <div className="mt-4 flex-1 space-y-2 overflow-y-auto rounded-lg bg-zinc-900 p-3 text-xs">
        {memos.map((m) => (
          <div key={m.id} className="rounded bg-zinc-950 p-2">
            <p className="whitespace-pre-wrap text-zinc-100">{m.content}</p>
            <p className="mt-1 text-[10px] text-zinc-500">
              {new Date(m.created_at).toLocaleString()}
            </p>
          </div>
        ))}
        {memos.length === 0 && (
          <p className="text-zinc-400">아직 작성된 메모가 없습니다.</p>
        )}
      </div>
    </div>
  );
}
