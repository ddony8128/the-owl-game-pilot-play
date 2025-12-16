import type { SubwayPlayerState } from "@/lib/types";

type Props = {
  players: SubwayPlayerState[];
  onReload: () => void;
};

export function SubwayInteractionSection({ players, onReload }: Props) {
  const scare = async (playerId: string) => {
    try {
      const res = await fetch("/api/gm/subway/scare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ player_id: playerId }),
      });
      if (!res.ok) {
        // 단순 실패는 알림 없이 무시 (대시보드 보조 기능)
        return;
      }
      onReload();
    } catch {
      // noop
    }
  };

  return (
    <section className="flex flex-col gap-2 text-sm">
      <h2 className="text-base font-semibold">상호작용</h2>
      <p className="text-xs text-zinc-400">
        플레이어별로 놀래키기/기타 상호작용을 수행합니다. (밀담실/음식/신고는
        추후 규칙 공개 연동 예정)
      </p>
      <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg bg-zinc-900 p-2 text-xs">
        {players.map((p) => (
          <div
            key={p.player_id}
            className="flex items-center justify-between rounded bg-zinc-950 px-2 py-1"
          >
            <div className="flex flex-col">
              <span className="font-medium">{p.player_id}</span>
              <span className="text-[10px] text-zinc-500">
                exit {p.exit_number} / {p.current_location ?? "-"}
              </span>
            </div>
            <div className="flex gap-1">
              <button
                className="rounded bg-red-500 px-2 py-0.5 text-[10px] font-semibold text-zinc-950 hover:bg-red-400"
                onClick={() => scare(p.player_id)}
              >
                놀래키기
              </button>
              <button className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-100 opacity-60">
                밀담실
              </button>
              <button className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-100 opacity-60">
                음식
              </button>
              <button className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-100 opacity-60">
                신고
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
