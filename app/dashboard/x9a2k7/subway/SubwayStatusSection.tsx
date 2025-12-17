import type { SubwayPlayerState } from "@/lib/types";

type Props = {
  players: SubwayPlayerState[];
};

export function SubwayStatusSection({ players }: Props) {
  return (
    <section className="flex flex-col gap-2 text-sm">
      <h2 className="text-base font-semibold">이상교통 현재 현황</h2>
      <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900 text-xs">
        <table className="min-w-full border-collapse">
          <thead className="bg-zinc-800">
            <tr>
              <th className="px-2 py-1 text-left">닉네임</th>
              <th className="px-2 py-1 text-left">exit</th>
              <th className="px-2 py-1 text-left">location</th>
              <th className="px-2 py-1 text-left">reset</th>
              <th className="px-2 py-1 text-left">finished</th>
              <th className="px-2 py-1 text-left">rank</th>
            </tr>
          </thead>
          <tbody>
            {players.map((r) => (
              <tr key={r.player_id} className="border-t border-zinc-800">
                <td className="px-2 py-1">{r.nickname ?? r.player_id}</td>
                <td className="px-2 py-1">{r.exit_number}</td>
                <td className="px-2 py-1">{r.current_location ?? "-"}</td>
                <td className="px-2 py-1">{r.reset_count}</td>
                <td className="px-2 py-1">{r.is_finished ? "Y" : "N"}</td>
                <td className="px-2 py-1">{r.finished_rank ?? "-"}</td>
              </tr>
            ))}
            {players.length === 0 && (
              <tr>
                <td colSpan={6} className="px-2 py-4 text-center text-zinc-400">
                  subway_player_state에 데이터가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
