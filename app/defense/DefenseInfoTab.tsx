type MonsterProps = {
  cards: {
    cardSlot: number;
    cardValue: number;
    isActive: boolean;
  }[];
  score: number;
  isLoading: boolean;
};

export function DefenseInfoTab({
  cards,
  score,
  isLoading,
}: MonsterProps) {
  const sortedCards = [...cards].sort((a, b) => a.cardSlot - b.cardSlot);
  const activeCount = sortedCards.filter((card) => card.isActive).length;

  return (
    <div className="space-y-4 text-sm text-zinc-200">
      <section className="overflow-hidden rounded-2xl border border-amber-400/25 bg-gradient-to-br from-zinc-900 to-amber-950/20 p-4 shadow-lg shadow-black/20">
        <p className="text-[11px] font-black tracking-[0.2em] text-amber-400">MY STATUS</p>
        <h2 className="mt-1 text-xl font-black text-white">내 점수 및 카드</h2>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-zinc-500">현재 점수</p>
            <p className="mt-1 text-3xl font-black tabular-nums text-white">
              {score}
              <span className="ml-1 text-base text-amber-300">점</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-zinc-500">사용 가능한 카드</p>
            <p className="mt-1 text-3xl font-black tabular-nums text-white">
              {isLoading ? "–" : activeCount}
              <span className="ml-1 text-base text-amber-300">장</span>
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between px-1">
          <div>
            <p className="text-[11px] font-black tracking-[0.18em] text-amber-400">MY DECK</p>
            <h3 className="mt-1 text-xl font-black text-white">내 숫자 카드</h3>
          </div>
          <span className="text-xs text-zinc-600">{isLoading ? "불러오는 중" : `${activeCount}장 사용 가능`}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {sortedCards.map((c) => (
            <div
              key={c.cardSlot}
              className={`relative flex min-h-32 flex-col items-center justify-center overflow-hidden rounded-2xl border px-3 py-3 ${
                c.isActive
                  ? "border-amber-400/70 bg-gradient-to-br from-zinc-800 to-zinc-950 shadow-lg shadow-amber-950/20"
                  : "border-zinc-800 bg-zinc-950 opacity-55 grayscale"
              }`}
            >
              <span className="absolute left-3 top-2 text-[10px] font-bold tracking-widest text-zinc-600">CARD {c.cardSlot}</span>
              <div className="flex items-center justify-center">
                <span className={`text-5xl font-black ${c.isActive ? "text-amber-300" : "text-zinc-600"}`}>
                  {c.cardValue}
                </span>
              </div>
              <p className={`mt-3 rounded-full px-3 py-1 text-xs font-bold ${c.isActive ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-800 text-zinc-500"}`}>
                {c.isActive ? "● 활성" : "× 비활성"}
              </p>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
