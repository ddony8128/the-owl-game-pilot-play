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
  "apply",
  "vote",
  "end",
];

function getNextPhase(
  current: MafiaPhase | null | undefined
): MafiaPhase | null {
  if (!current) return "prepare";
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
    <section className="space-y-2 text-sm">
      <h2 className="text-base font-semibold">라운드 / 페이즈</h2>
      <p className="text-sm text-zinc-400">
        현재 라운드:{" "}
        {typeof phase?.round_number === "number"
          ? phase.round_number === 0
            ? "튜토리얼"
            : `${phase.round_number}라운드`
          : "-"}{" "}
        / 페이즈: {getMafiaPhaseLabel(currentPhase)}
      </p>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-sm text-zinc-400">라운드 선택:</span>
        {[0, 1, 2, 3, 4, 5].map((round) => (
          <button
            key={round}
            className="rounded-full bg-zinc-900 px-3 py-1 text-zinc-200 hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-zinc-900"
            disabled={!canChangeRound || phase?.round_number === round}
            onClick={() => onChangeRound(round)}
          >
            {round === 0 ? "튜토리얼" : `${round}라운드`}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        {ORDERED_PHASES.map((ph) => (
          <button
            key={ph}
            className="rounded-full bg-zinc-900 px-3 py-1 text-zinc-200 hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-zinc-900"
            disabled={ph !== nextPhase}
            onClick={() => onChangePhase(ph)}
          >
            페이즈 전환: {getMafiaPhaseLabel(ph)}
          </button>
        ))}
      </div>
    </section>
  );
}
