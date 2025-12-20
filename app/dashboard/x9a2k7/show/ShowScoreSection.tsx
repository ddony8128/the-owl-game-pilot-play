import type { QuizPlayer } from "@/lib/types";

type Props = {
  players: QuizPlayer[];
  playerNames: Record<string, string>;
  onChangeScore: (playerId: string, delta: number) => void;
  onHiddenBonus: (playerId: string) => void;
};

export function ShowScoreSection({
  players,
  playerNames,
  onChangeScore,
  onHiddenBonus,
}: Props) {
  return (
    <section>
      <h2 className="mb-2 text-base font-semibold">
        점수판 / 히든 피스 보너스
      </h2>
      <div className="space-y-1 text-xs">
        {players.map((p) => (
          <div
            key={p.player_id}
            className="flex items-center justify-between rounded bg-zinc-900 px-3 py-1"
          >
            <span>{playerNames[p.player_id] ?? p.player_id}</span>
            <span className="flex items-center gap-2">
              <button
                className="h-6 rounded-full bg-zinc-800 px-2 text-[10px]"
                onClick={() => onHiddenBonus(p.player_id)}
              >
                +100
              </button>
              <button
                className="h-6 w-6 rounded-full bg-zinc-800 text-xs"
                onClick={() => onChangeScore(p.player_id, -1)}
              >
                -
              </button>
              <span className="w-10 text-center text-amber-300">
                {p.score ?? 0}
              </span>
              <button
                className="h-6 w-6 rounded-full bg-zinc-800 text-xs"
                onClick={() => onChangeScore(p.player_id, 1)}
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
