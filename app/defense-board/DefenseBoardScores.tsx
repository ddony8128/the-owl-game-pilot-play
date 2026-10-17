type Score = {
  playerId: string;
  nickname: string | null;
  points: number;
  damage: number;
};

type Props = {
  scores: Score[];
  showDamage?: boolean;
};

const rankTone = [
  "border-amber-300/60 bg-gradient-to-br from-amber-300/20 to-zinc-900",
  "border-zinc-300/45 bg-gradient-to-br from-zinc-300/15 to-zinc-900",
  "border-orange-500/45 bg-gradient-to-br from-orange-600/15 to-zinc-900",
];

export function DefenseBoardScores({ scores, showDamage }: Props) {
  // 기본 9자리를 유지하되 실제 참가자가 더 많다면 누구도 잘리지 않게 모두 표시한다.
  const slotCount = Math.max(9, scores.length);
  const slots = Array.from({ length: slotCount }, (_, index) => scores[index] ?? null);

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex shrink-0 items-end justify-between px-1">
        <div>
          <p className="text-xs font-black tracking-[0.2em] text-amber-400">
            {showDamage ? "FINAL RANKING" : "SCORE BOARD"}
          </p>
          <h2 className="mt-1 text-2xl font-black text-white">
            {showDamage ? "최종 전체 점수" : "전체 점수 현황"}
          </h2>
        </div>
        <p className="text-sm text-zinc-500">{scores.length}명</p>
      </div>

      <div
        className="grid min-h-0 flex-1 grid-cols-3 gap-2.5"
        style={{ gridTemplateRows: `repeat(${Math.ceil(slotCount / 3)}, minmax(0, 1fr))` }}
      >
        {slots.map((score, index) => {
          const rank = index + 1;
          if (!score) {
            return (
              <div
                key={`empty-${index}`}
                className="flex min-h-0 items-center justify-center rounded-2xl border border-dashed border-zinc-800/70 bg-zinc-950/25"
              >
                <span className="font-mono text-sm font-bold text-zinc-800">{rank.toString().padStart(2, "0")}</span>
              </div>
            );
          }

          return (
            <article
              key={score.playerId}
              className={`relative flex min-h-0 items-center gap-3 overflow-hidden rounded-2xl border px-4 py-3 shadow-lg shadow-black/15 ${
                rankTone[index] ?? "border-zinc-800 bg-zinc-900/90"
              }`}
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-mono text-lg font-black ${
                rank === 1
                  ? "bg-amber-300 text-zinc-950"
                  : rank === 2
                    ? "bg-zinc-300 text-zinc-950"
                    : rank === 3
                      ? "bg-orange-500 text-white"
                      : "bg-zinc-800 text-zinc-400"
              }`}>
                {rank}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-black text-white">
                  {score.nickname ?? score.playerId}
                </p>
                {showDamage ? (
                  <p className="mt-0.5 text-xs text-zinc-500">누적 피해 {score.damage}</p>
                ) : null}
              </div>
              <p className="shrink-0 font-mono text-2xl font-black tabular-nums text-amber-300">
                {score.points}<span className="ml-0.5 text-xs">점</span>
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
