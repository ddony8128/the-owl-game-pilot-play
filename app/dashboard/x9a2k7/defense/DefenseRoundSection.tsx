type Props = {
  round: number | null;
  onAdvanceRound: (nextRound: number) => Promise<void>;
};

export function DefenseRoundSection({ round, onAdvanceRound }: Props) {
  const currentRound = typeof round === "number" ? round : 0;
  const nextRound = currentRound < 16 ? currentRound + 1 : null;

  const getRoundLabel = (r: number) => {
    if (r === 0) return "준비";
    if (r === 1) return "튜토리얼 1라운드";
    if (r === 2) return "튜토리얼 2라운드";
    if (r === 3) return "튜토리얼 결과";
    if (r >= 4 && r <= 15) {
      const gameRound = r - 3; // 4~15 -> 1~12라운드
      return `${gameRound}라운드`;
    }
    if (r === 16) return "게임 종료";
    return `알 수 없음 (DB round ${r})`;
  };

  return (
    <section className="space-y-3 text-base">
      <h2 className="text-lg font-semibold">라운드 관리</h2>
      <p className="text-sm text-zinc-400">
        현재 라운드: {getRoundLabel(currentRound)} (DB round {currentRound})
      </p>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-sm text-zinc-400">다음 라운드 선택:</span>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map(
          (r) => {
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
        <p className="text-sm text-zinc-500">
          마지막 라운드(12라운드)까지 진행되었습니다.
        </p>
      )}
    </section>
  );
}


