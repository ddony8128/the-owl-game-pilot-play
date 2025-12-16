import { useState } from "react";
import type { MafiaLog } from "@/lib/types";

type Props = {
  logs: MafiaLog[];
  onLogAdded: (log: MafiaLog) => void;
};

export function MafiaLogsSection({ logs, onLogAdded }: Props) {
  const [newLog, setNewLog] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const addLog = async () => {
    if (!newLog.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/gm/logs/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: newLog.trim() }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: true;
        log?: MafiaLog;
        error?: string;
      } | null;
      if (!res.ok || !json?.ok || !json.log) {
        // 실패 시에는 단순히 무시 (별도 에러 배너는 상위에서 처리 가능)
        return;
      }
      onLogAdded(json.log);
      setNewLog("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-2 text-sm">
      <h2 className="text-base font-semibold">라운드별 로그</h2>
      <div className="flex gap-2 text-xs">
        <input
          className="h-8 flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 text-xs outline-none focus:border-zinc-400"
          placeholder="공개 로그를 입력하세요."
          value={newLog}
          onChange={(e) => setNewLog(e.target.value)}
        />
        <button
          className="h-8 rounded bg-amber-400 px-3 text-xs font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-50"
          onClick={addLog}
          disabled={submitting}
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
        {logs.length === 0 && (
          <p className="text-zinc-400">아직 등록된 로그가 없습니다.</p>
        )}
      </div>
    </section>
  );
}
