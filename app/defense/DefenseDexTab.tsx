import Image from "next/image";

type Props = {
  dex: {
    monsterId: number;
    name: string;
    description: string;
    maxHp: number;
    baseTime: number;
    points: number;
    remainingCount: number;
    totalCount: number;
    image: string;
  }[];
};

export function DefenseDexTab({ dex }: Props) {
  const sorted = [...dex].sort((a, b) => a.monsterId - b.monsterId);

  return (
    <div className="space-y-3 text-base text-zinc-200">
      <div className="space-y-2">
        {sorted.map((m) => (
          <div
            key={m.monsterId}
            className="flex gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-2"
          >
            {m.image && (
              <div className="relative h-30 w-30  overflow-hidden rounded bg-zinc-800">
                <Image
                  src={m.image}
                  alt={m.name}
                  fill
                  sizes="120px"
                  className="object-cover"
                />
              </div>
            )}
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <div className="text-base font-semibold">{m.name}</div>
                <div className="text-base text-amber-300">
                  남은 수: {m.remainingCount}마리
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-zinc-400">
                <span className="whitespace-nowrap">HP {m.maxHp}</span>
                <span className="whitespace-nowrap">잔여 시간 {m.baseTime}</span>
                <span className="whitespace-nowrap">포인트 +{m.points}</span>
                <span className="whitespace-nowrap">전체 {m.totalCount}마리</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
