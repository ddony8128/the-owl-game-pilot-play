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

export function DefenseBoardScores({ scores, showDamage }: Props) {
  if (scores.length === 0) {
    return (
      <p className="text-base text-zinc-400">아직 점수 정보가 없습니다.</p>
    );
  }

  return (
    <section className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-base">
      <h2 className="text-3xl font-semibold text-zinc-100">
        플레이어 점수 현황
      </h2>
      <div className="space-y-1">
        {scores.map((s) => (
          <div
            key={s.playerId}
            className="flex items-center justify-between rounded-md bg-zinc-950 px-3 py-2"
          >
            <div className="flex flex-col">
              <span className="text-2xl font-semibold">
                {s.nickname ?? s.playerId}
              </span>
              {showDamage && (
                <span className="text-base text-zinc-400">
                  누적 피해: {s.damage}
                </span>
              )}
            </div>
            <span className="text-2xl font-bold text-amber-300">
              {s.points}점
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
