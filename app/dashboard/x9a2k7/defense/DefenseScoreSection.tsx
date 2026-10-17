type Props = {
  players: {
    id: string;
    nickname: string;
    defensePoints?: number | null;
  }[];
  onChangeScore: (playerId: string, delta: -1 | 1) => Promise<void>;
  disabled?: boolean;
};

export function DefenseScoreSection({ players, onChangeScore, disabled = false }: Props) {
  const sorted = [...players].sort((a, b) =>
    a.nickname.localeCompare(b.nickname)
  );

  return (
    <section className="space-y-2 text-base" data-testid="defense-score-section">
      <h2 className="text-lg font-semibold">점수 관리</h2>
      <p className="text-sm text-zinc-400">
        각 플레이어의 점수를 수동으로 보정합니다(예외 처리용). + / − 1점씩, 보정 내용은 GM 조작 기록에 남습니다.
      </p>
      <div className="space-y-1 rounded-lg bg-zinc-900 p-2">
        {sorted.length === 0 && (
          <p className="text-zinc-400">등록된 플레이어가 없습니다.</p>
        )}
        {sorted.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between rounded bg-zinc-950 px-2 py-1"
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                {p.nickname || "(이름 없음)"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="h-7 w-7 rounded-full bg-zinc-800 text-sm font-bold text-zinc-100 hover:bg-zinc-700 disabled:opacity-40"
                type="button"
                aria-label={`${p.nickname} 점수 -1`}
                disabled={disabled}
                onClick={() => {
                  void onChangeScore(p.id, -1);
                }}
              >
                -
              </button>
              <span className="w-12 text-center text-sm font-semibold text-amber-300">
                {(p.defensePoints ?? 0).toString()}점
              </span>
              <button
                className="h-7 w-7 rounded-full bg-amber-400 text-sm font-bold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
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
