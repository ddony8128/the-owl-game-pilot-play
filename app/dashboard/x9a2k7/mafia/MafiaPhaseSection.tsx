import type { MafiaPhase, MafiaPhaseState } from "@/lib/types";
import { getMafiaPhaseLabel } from "@/lib/labels/mafia";

type Props = {
  phase: MafiaPhaseState | null;
  onChangePhase: (to: string) => Promise<void>;
  onChangeRound: (round: number) => Promise<void>;
};

const ORDERED_PHASES: MafiaPhase[] = [
  "prepare",
  "auction",
  "trade",
  "vote",
  "end",
];

function getNextPhase(
  current: MafiaPhase | null | undefined
): MafiaPhase | null {
  if (!current) return "prepare";
  if (current === "apply") return "vote";
  const idx = ORDERED_PHASES.indexOf(current);
  if (idx === -1 || idx === ORDERED_PHASES.length - 1) return null;
  return ORDERED_PHASES[idx + 1] ?? null;
}

export function MafiaPhaseSection({
  phase,
  onChangePhase,
  onChangeRound,
}: Props) {
  const currentPhase = phase?.phase ?? null;
  const nextPhase = getNextPhase(currentPhase);
  const canChangeRound = currentPhase === "end";

  return (
    <section className="space-y-5 text-sm">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">라운드 · 단계</p>
        <p className="mt-1 text-3xl font-black text-white">
        {typeof phase?.round_number === "number"
          ? phase.round_number === 0
            ? "튜토리얼"
            : `${phase.round_number}라운드`
          : "-"}{" "}
        <span className="mx-2 text-zinc-600">·</span>{getMafiaPhaseLabel(currentPhase)}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {ORDERED_PHASES.map((ph) => {
          const currentIndex = currentPhase ? ORDERED_PHASES.indexOf(currentPhase) : -1;
          const phaseIndex = ORDERED_PHASES.indexOf(ph);
          return (
            <span key={ph} className={`flex min-h-11 items-center justify-center rounded-xl px-2 py-2 text-center text-xs ${ph === currentPhase ? "bg-amber-400 font-black text-zinc-950 shadow-lg shadow-amber-950/40" : phaseIndex < currentIndex ? "bg-emerald-500/15 font-bold text-emerald-300" : "bg-zinc-800/80 text-zinc-500"}`}>
              {phaseIndex < currentIndex ? "✓ " : ""}{getMafiaPhaseLabel(ph)}
            </span>
          );
        })}
      </div>
      {nextPhase ? (
        <button
          className="min-h-16 w-full rounded-2xl bg-amber-400 px-5 text-lg font-black text-zinc-950 shadow-xl shadow-amber-950/40 transition hover:bg-amber-300 active:scale-[0.99]"
          onClick={() => onChangePhase(nextPhase)}
        >
          다음 단계로 진행 <span className="mx-2 text-zinc-600">·</span> {getMafiaPhaseLabel(nextPhase)} →
        </button>
      ) : (
        <p className="rounded-lg bg-zinc-800 p-3 text-center text-zinc-400">현재 라운드가 종료되었습니다.</p>
      )}
      {canChangeRound && phase && phase.round_number < 5 && <div className="flex items-center gap-2 border-t border-zinc-800 pt-3 text-sm">
        <span className="text-sm text-zinc-400">다음 라운드:</span>
        {[phase.round_number + 1].map((round) => (
          <button
            key={round}
            className="rounded-full bg-zinc-900 px-3 py-1 text-zinc-200 hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-zinc-900"
            disabled={!canChangeRound}
            onClick={() => onChangeRound(round)}
          >
            {round === 0 ? "튜토리얼" : `${round}라운드`}
          </button>
        ))}
      </div>}
    </section>
  );
}
