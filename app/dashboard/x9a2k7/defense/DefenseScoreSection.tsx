type Props = {
  players: {
    id: string;
    nickname: string;
    defensePoints?: number | null;
  }[];
  onChangeScore: (playerId: string, delta: -1 | 1) => Promise<void>;
  disabled?: boolean;
};

// 점수 관리 — 순위표 모양(포크)에 ±1 수동 보정(멱등 API, GM 조작 기록). 종료된 방·요청 중에는 버튼이 막힌다.
export function DefenseScoreSection({ players, onChangeScore, disabled = false }: Props) {
  const sorted = [...players].sort(
    (a, b) => (b.defensePoints ?? 0) - (a.defensePoints ?? 0) || a.nickname.localeCompare(b.nickname),
  );

  return (
    <section className="space-y-3 text-base" data-testid="defense-score-section">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-bold tracking-[0.16em] text-amber-400">SCORE</p>
          <h2 className="mt-1 text-lg font-black text-white">현재 점수 순위</h2>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950">
        <div className="grid grid-cols-[64px_minmax(140px,1fr)_100px_130px] items-center gap-3 border-b border-zinc-700 bg-zinc-900 px-4 py-3 text-xs font-bold text-zinc-400">
          <span className="text-center">순위</span>
          <span>플레이어</span>
          <span className="text-right">점수</span>
          <span className="text-center">점수 보정</span>
        </div>
        {sorted.length === 0 && <p className="p-4 text-zinc-400">등록된 플레이어가 없습니다.</p>}
        {sorted.map((p, index) => (
          <div
            key={p.id}
            className="grid grid-cols-[64px_minmax(140px,1fr)_100px_130px] items-center gap-3 border-b border-zinc-800 px-4 py-3 last:border-b-0 hover:bg-zinc-900/70"
          >
            <span
              className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${
                index < 3 ? "bg-amber-400 text-zinc-950" : "bg-zinc-800 text-zinc-300"
              }`}
            >
              {index + 1}
            </span>
            <span className="truncate font-bold text-white">{p.nickname || "(이름 없음)"}</span>
            <span className="text-right text-lg font-black tabular-nums text-amber-300">{(p.defensePoints ?? 0).toString()}점</span>
            <div className="flex items-center justify-center gap-2">
              <button
                className="h-9 w-9 rounded-lg bg-zinc-800 text-lg font-bold text-zinc-100 hover:bg-zinc-700 disabled:opacity-40"
                type="button"
                aria-label={`${p.nickname} 점수 -1`}
                disabled={disabled}
                onClick={() => {
                  void onChangeScore(p.id, -1);
                }}
              >
                -
              </button>
              <button
                className="h-9 w-9 rounded-lg bg-amber-400 text-lg font-bold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
                type="button"
                aria-label={`${p.nickname} 점수 +1`}
                disabled={disabled}
                onClick={() => {
                  void onChangeScore(p.id, 1);
                }}
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
