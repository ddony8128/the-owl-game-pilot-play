import type { Player } from "@/lib/types";

type Props = {
  player: Player | null;
  onClearNickname: () => void;
};

export function IntroHeader({ player, onClearNickname }: Props) {
  return (
    <header className="w-full max-w-md rounded-2xl bg-zinc-950/85 p-8 shadow-lg shadow-black/40 ring-1 ring-zinc-800/60 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">The Owl Game</h1>
          <p className="text-sm text-zinc-400">Pilot Program</p>
        </div>
        {player && (
          <div className="text-right text-sm text-zinc-300">
            <div>{player.nickname}</div>
            <button
              className="mt-1 text-sm text-zinc-500 underline"
              onClick={onClearNickname}
            >
              닉네임 변경
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
