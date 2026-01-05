type Props = {
  players: {
    id: string;
    nickname: string;
    defensePoints?: number | null;
  }[];
  onChangeScore: (playerId: string, delta: -1 | 1) => Promise<void>;
};

export function DefenseScoreSection({ players, onChangeScore }: Props) {
  const sorted = [...players].sort((a, b) =>
    a.nickname.localeCompare(b.nickname)
  );

  return (
    <section className="space-y-2 text-base">
      <h2 className="text-lg font-semibold">점수 관리</h2>
      <p className="text-sm text-zinc-400">
        각 플레이어의 점수를 관리하는 영역입니다. + / - 버튼을 눌러
        defense_score 테이블의 포인트를 조정할 수 있습니다.
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
                {p.nickname || p.id.slice(0, 8)}
              </span>
              <span className="text-[10px] text-zinc-500">{p.id}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="h-7 w-7 rounded-full bg-zinc-800 text-sm font-bold text-zinc-100 hover:bg-zinc-700"
                type="button"
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
                className="h-7 w-7 rounded-full bg-amber-400 text-sm font-bold text-zinc-950 hover:bg-amber-300"
                type="button"
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


