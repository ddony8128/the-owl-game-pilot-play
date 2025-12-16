import type { MafiaPlayerState } from "@/lib/types";

type Props = {
  players: MafiaPlayerState[];
};

export function MafiaAssetsSection({ players }: Props) {
  return (
    <section className="space-y-2 text-sm">
      <h2 className="text-base font-semibold">자산 현황</h2>
      <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900 text-xs">
        <table className="min-w-full border-collapse">
          <thead className="bg-zinc-800">
            <tr>
              <th className="px-2 py-1 text-left">player_id</th>
              <th className="px-2 py-1 text-left">cash</th>
              <th className="px-2 py-1 text-left">job</th>
              <th className="px-2 py-1 text-left">is_mafia</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.player_id} className="border-t border-zinc-800">
                <td className="px-2 py-1">{p.player_id}</td>
                <td className="px-2 py-1">{p.cash}</td>
                <td className="px-2 py-1">{p.job ?? "-"}</td>
                <td className="px-2 py-1">{p.is_mafia ? "Y" : "N"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
