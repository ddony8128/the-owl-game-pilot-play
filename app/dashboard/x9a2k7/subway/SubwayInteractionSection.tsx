import type { SubwayPlayerState } from "@/lib/types";

type Props = {
  players: SubwayPlayerState[];
  onReload: () => void;
};

export function SubwayInteractionSection({ players, onReload }: Props) {
  const triggerRule = async (
    playerId: string,
    trigger: "meeting" | "food"
  ) => {
    try {
      const res = await fetch("/api/gm/subway/rule-trigger", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ player_id: playerId, trigger }),
      });
      if (!res.ok) {
        return;
      }
      onReload();
    } catch {
      // noop
    }
  };

  // 상호작용 버튼을 눌러 새로고침해도 순서가 흔들리지 않도록 player_id 기준 고정 정렬
  const sortedPlayers = [...players].sort((a, b) =>
    a.player_id.localeCompare(b.player_id)
  );

  return (
    <section className="flex flex-col gap-2 text-sm">
      <h2 className="text-base font-semibold">플레이어 상호작용</h2>
      <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg bg-zinc-900 p-2 text-xs">
        {sortedPlayers.map((p) => (
          <div
            key={p.player_id}
            className="flex items-center justify-between rounded bg-zinc-950 px-2 py-1"
          >
            <div className="flex flex-col">
              <span className="font-medium">{p.nickname ?? p.player_id}</span>
              <span className="text-[10px] text-zinc-500">
                exit {p.exit_number} / {p.current_location ?? "-"}
              </span>
            </div>
            <div className="flex gap-1">
              <button
                className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-100 hover:bg-zinc-700"
                onClick={() => triggerRule(p.player_id, "meeting")}
              >
                밀담실
              </button>
              <button
                className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-100 hover:bg-zinc-700"
                onClick={() => triggerRule(p.player_id, "food")}
              >
                음식
              </button>
            </div>
          </div>
        ))}
        {players.length === 0 && (
          <p className="text-zinc-400">플레이어 데이터가 없습니다.</p>
        )}
      </div>
    </section>
  );
}
