import type { QuizPlayer } from "@/lib/types";

type Props = {
  players: QuizPlayer[];
  playerNames: Record<string, string>;
  streaks: Record<string, number>;
  onChangeScore: (playerId: string, delta: number) => void;
};

export function ShowScoreSection({
  players,
  playerNames,
  streaks,
  onChangeScore,
}: Props) {
  return (
    <section>
      <h2 className="mb-2 text-base font-semibold">점수판</h2>
      <div className="space-y-1 text-xs">
        {players.map((p) => (
          <div
            key={p.player_id}
            className="flex items-center justify-between rounded bg-zinc-900 px-3 py-1"
          >
            <div className="flex flex-col">
              <span>{playerNames[p.player_id] ?? p.player_id}</span>
              <span className="mt-0.5 text-[10px] text-zinc-400">
                연속 득점: {streaks[p.player_id] ?? 0}회
              </span>
              <span className="mt-0.5 text-[10px] text-zinc-400">
                찬스 남음:{" "}
                {(() => {
                  const raw =
                    (p.chances as Record<string, unknown> | null) || {};
                  const peek = raw.peek !== false;
                  const bet = raw.bet !== false;
                  const safe = raw.safe !== false;
                  return [
                    `컨닝 ${peek ? "O" : "X"}`,
                    `베팅 ${bet ? "O" : "X"}`,
                    `무산 ${safe ? "O" : "X"}`,
                  ].join(" / ");
                })()}
              </span>
            </div>
            <span className="flex items-center gap-2">
              <button
                className="h-6 w-6 rounded-full bg-zinc-800 text-xs"
                onClick={() => onChangeScore(p.player_id, -50)}
              >
                -
              </button>
              <span className="w-10 text-center text-amber-300">
                {p.score ?? 0}
              </span>
              <button
                className="h-6 w-6 rounded-full bg-zinc-800 text-xs"
                onClick={() => onChangeScore(p.player_id, 50)}
              >
                +
              </button>
            </span>
          </div>
        ))}
        {players.length === 0 && (
          <p className="text-zinc-400">결승 진출자 데이터가 없습니다.</p>
        )}
      </div>
    </section>
  );
}
