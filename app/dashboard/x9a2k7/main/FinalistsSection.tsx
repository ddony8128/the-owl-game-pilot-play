import type { Player } from "@/lib/types";

type Props = {
  players: Player[];
  onToggleFinalist: (playerId: string, isFinalist: boolean) => void;
};

export function FinalistsSection({ players, onToggleFinalist }: Props) {
  return (
    <section>
      <h2 className="mb-2 text-base font-semibold">결승 진출자 선정</h2>
      <div className="max-h-64 space-y-1 overflow-y-auto text-xs">
        {players.map((p) => (
          <label key={p.id} className="flex items-center justify-between gap-2">
            <span>{p.nickname}</span>
            <span className="flex items-center gap-2">
              <span className="text-zinc-400">finalist</span>
              <input
                type="checkbox"
                checked={!!p.is_finalist}
                onChange={() => onToggleFinalist(p.id, !!p.is_finalist)}
              />
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}
