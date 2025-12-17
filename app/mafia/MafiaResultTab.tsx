"use client";

import type { MafiaLog } from "@/lib/types";

type Props = {
  logs: MafiaLog[];
};

export function MafiaResultTab({ logs }: Props) {
  return (
    <div className="space-y-2 text-xs text-zinc-200">
      <p className="text-xs text-zinc-400">
        GM이 공개한 로그가 여기에 표시됩니다.
      </p>
      <div className="space-y-2">
        {logs.map((log) => (
          <div
            key={log.id}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-xs text-zinc-100"
          >
            {log.content}
          </div>
        ))}
        {logs.length === 0 && (
          <p className="text-xs text-zinc-400">아직 공개된 로그가 없습니다.</p>
        )}
      </div>
    </div>
  );
}
