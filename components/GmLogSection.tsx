"use client";

import { useState } from "react";

export type GmLogItem = {
  id: number;
  kind: string;
  content: string;
  created_at: string;
};

const KIND_LABEL: Record<string, string> = {
  rewind: "되돌리기",
  adjust: "보정",
  reveal: "공개",
  timer: "타이머",
  kick: "강퇴",
  headcount: "인원",
  other: "기타",
};

// GM 조작 기록(gm_logs) — 되돌리기·보정·공개 토글·타이머 조정. 참가자에게는 보이지 않는다.
export function GmLogSection({ logs, warning }: { logs: GmLogItem[]; warning?: string | null }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="space-y-2 text-sm" data-testid="gm-log-section">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold">GM 조작 기록</h2>
        <span className="text-xs text-zinc-500">{logs.length}건 · 참가자에게 보이지 않음</span>
        <button
          type="button"
          className="ml-auto rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300 hover:bg-zinc-700"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "접기" : "펼치기"}
        </button>
      </div>
      {warning && <p className="text-xs text-amber-300">{warning}</p>}
      {open && (
        <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900 p-2">
          {logs.length === 0 && <p className="text-xs text-zinc-500">아직 기록이 없습니다.</p>}
          {logs.map((l) => (
            <div key={l.id} className="flex gap-2 text-xs" data-testid="gm-log-item">
              <span className="w-12 shrink-0 font-mono text-zinc-500">
                {new Date(l.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="w-12 shrink-0 rounded bg-zinc-800 px-1 text-center text-zinc-300">
                {KIND_LABEL[l.kind] ?? l.kind}
              </span>
              <span className="text-zinc-200">{l.content}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
