import type { MafiaPhaseState } from "@/lib/types";

type Props = {
  phase: MafiaPhaseState | null;
  onChangePhase: (to: string) => Promise<void>;
};

export function MafiaPhaseSection({ phase, onChangePhase }: Props) {
  return (
    <section className="space-y-2 text-sm">
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
            onClick={() => onChangePhase(ph)}
          >
            페이즈 전환: {ph}
          </button>
        ))}
      </div>
    </section>
  );
}
