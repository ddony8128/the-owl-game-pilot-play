"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

// 마피아 결과 공개 토글(Iteration 5 계약) — rooms.reveal_result.
//  보드 요약(/api/mafia/board-summary)·플레이어 결과는 5라운드 종료 + 이 토글 ON 일 때만 결과(순위·직업·마피아)를 보여 준다.
export function MafiaRevealSection({
  reveal,
  finished,
  disabled = false,
  busy = false,
  onToggle,
}: {
  reveal: boolean;
  /** 5라운드 end 에 도달했는지 */
  finished: boolean;
  disabled?: boolean;
  busy?: boolean;
  onToggle: (next: boolean) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const next = !reveal;
  return (
    <section className="space-y-2 text-sm" data-testid="reveal-section">
      <h2 className="text-base font-semibold">결과 공개</h2>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
        <span
          className={`rounded px-2 py-0.5 text-xs font-bold ${
            reveal ? "bg-emerald-500/20 text-emerald-200" : "bg-zinc-800 text-zinc-300"
          }`}
          data-testid="reveal-state"
        >
          {reveal ? "공개 ON" : "비공개"}
        </span>
        <span className="text-xs text-zinc-400">
          {finished
            ? "게임이 끝났습니다. 공개를 켜면 보드와 참가자 화면에 최종 순위·직업·마피아가 공개됩니다."
            : "5라운드가 끝난 뒤 공개를 켜세요. 그 전에는 켜도 보드에 결과가 나오지 않습니다."}
        </span>
        <button
          type="button"
          data-testid="reveal-toggle"
          disabled={disabled || busy}
          className={`ml-auto rounded px-3 py-1.5 text-sm font-semibold disabled:opacity-40 ${
            next ? "bg-amber-500 text-zinc-950 hover:bg-amber-400" : "bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
          }`}
          onClick={() => setOpen(true)}
        >
          {next ? "결과 공개 켜기" : "결과 공개 끄기"}
        </button>
      </div>
      <ConfirmDialog
        open={open}
        title={next ? "결과를 공개할까요?" : "결과 공개를 끌까요?"}
        confirmLabel={next ? "공개" : "비공개로"}
        danger={next}
        busy={busy}
        onClose={() => setOpen(false)}
        onConfirm={async () => {
          setOpen(false);
          await onToggle(next);
        }}
      >
        {next ? (
          <p className="text-zinc-300">
            보드(빔)와 참가자 화면에 <b>최종 순위와 각 라운드 직업(마피아 포함)</b>이 공개됩니다.
            {!finished && " 아직 5라운드가 끝나지 않아, 끝나는 순간 바로 공개됩니다."}
          </p>
        ) : (
          <p className="text-zinc-300">보드와 참가자 화면이 다시 &ldquo;게임이 끝나면 공개됩니다&rdquo;로 돌아갑니다.</p>
        )}
      </ConfirmDialog>
    </section>
  );
}
