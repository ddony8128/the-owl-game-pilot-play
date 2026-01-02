import type { Player } from "@/lib/types";

type Props = {
  players: (Player & { feather?: number | null })[];
  onChangeFeather: (playerId: string, delta: -1 | 1) => void;
};

export function FeatherSection({ players, onChangeFeather }: Props) {
  const sorted = [...players].sort((a, b) => {
    const fa = a.feather ?? 0;
    const fb = b.feather ?? 0;
    if (fb !== fa) return fb - fa;
    return a.nickname.localeCompare(b.nickname);
  });

  return (
    <section className="space-y-2 text-xs">
      <h2 className="text-base font-semibold">부엉깃털 현황</h2>
      <p className="text-[11px] text-zinc-400">
        각 플레이어의 부엉깃털 개수를 관리합니다. -/+ 버튼을 누르면 즉시 DB에
        반영됩니다.
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
                onClick={() => onChangeFeather(p.id, -1)}
              >
                -
              </button>
              <span className="w-10 text-center text-sm font-semibold text-amber-300">
                {(p.feather ?? 0).toString()}
              </span>
              <button
                className="h-7 w-7 rounded-full bg-amber-400 text-sm font-bold text-zinc-950 hover:bg-amber-300"
                type="button"
                onClick={() => onChangeFeather(p.id, 1)}
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
