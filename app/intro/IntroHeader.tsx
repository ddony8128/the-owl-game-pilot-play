import type { Player } from "@/lib/types";

type Props = {
  player: Player | null;
  onClearNickname: () => void;
};

export function IntroHeader({ player, onClearNickname }: Props) {
  return (
    <header className="w-full max-w-md">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">The Owl Game</h1>
          <p className="text-xs text-zinc-400">Pilot Program</p>
        </div>
        {player && (
          <div className="text-right text-xs text-zinc-300">
            <div>{player.nickname}</div>
            <button
              className="mt-1 text-[10px] text-zinc-500 underline"
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
