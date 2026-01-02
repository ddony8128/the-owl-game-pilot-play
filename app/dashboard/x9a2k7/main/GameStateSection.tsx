import type { GameState } from "@/lib/types";

const GAME_OPTIONS: GameState["active_game"][] = [
  "ready",
  "subway",
  "mafia_tutorial",
  "mafia",
  "vote",
  "survey",
];

type Props = {
  activeGame: GameState["active_game"] | null;
  onChangeGame: (value: GameState["active_game"]) => void;
};

export function GameStateSection({ activeGame, onChangeGame }: Props) {
  return (
    <section>
      <h2 className="mb-2 text-base font-semibold">전역 게임 상태</h2>
      <div className="flex items-center gap-2 text-xs">
        <span className="text-zinc-400">active_game</span>
        <select
          className="h-8 rounded border border-zinc-700 bg-zinc-900 px-2 text-xs outline-none focus:border-zinc-400"
          value={activeGame ?? "ready"}
          onChange={(e) =>
            onChangeGame(e.target.value as GameState["active_game"])
          }
        >
          {GAME_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
