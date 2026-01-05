type Props = {
  round: number | null;
  onAdvanceRound: (nextRound: number) => Promise<void>;
};

export function DefenseRoundSection({ round, onAdvanceRound }: Props) {
  const currentRound = typeof round === "number" ? round : 0;
  const nextRound = currentRound < 12 ? currentRound + 1 : null;

  const getRoundLabel = (r: number) => {
    if (r === 0) return "준비";
    if (r === 1) return "튜토리얼 1라운드";
    if (r === 2) return "튜토리얼 2라운드";
    // 3~12 -> 1~10라운드
    const gameRound = r - 2;
    return `${gameRound}라운드`;
  };

  return (
    <section className="space-y-3 text-base">
      <h2 className="text-lg font-semibold">라운드 관리</h2>
      <p className="text-sm text-zinc-400">
        현재 라운드: {getRoundLabel(currentRound)} (DB round {currentRound})
      </p>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-sm text-zinc-400">다음 라운드 선택:</span>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((r) => {
          const isNext = nextRound === r;
          const label = getRoundLabel(r);
          return (
            <button
              key={r}
              type="button"
              className="rounded-full bg-zinc-900 px-3 py-1 text-zinc-200 hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-zinc-900"
              disabled={!isNext}
              onClick={() => {
                if (!isNext) return;
                void onAdvanceRound(r);
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
      {nextRound == null && (
        <p className="text-[11px] text-zinc-500">
          마지막 라운드(10라운드)까지 진행되었습니다.
        </p>
      )}
    </section>
  );
}


