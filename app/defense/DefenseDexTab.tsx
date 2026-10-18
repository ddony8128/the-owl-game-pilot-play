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
  /** ITER6 C5 — GM 토글 '도감 남은 수'(기본 켜짐) */
  showRemaining?: boolean;
};

// ITER6 C4 — '전체 n마리'는 표시하지 않는다. 그 값(totalCount)은 lib/defense/monsters.ts 의 기본 구성(8명 24마리)
// baseCount 를 읽어, 인원 자동 구성·GM 저장으로 바뀐 이 방의 수와 달랐다(구성 4마리인데 '전체 6마리').
export function DefenseDexTab({ dex, showRemaining = true }: Props) {
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
                {showRemaining && (
                  <div className="text-base text-amber-300" data-testid="dex-remaining">
                    남은 수: {m.remainingCount}마리
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-zinc-400">
                <span className="whitespace-nowrap">HP {m.maxHp}</span>
                <span className="whitespace-nowrap">잔여 시간 {m.baseTime}</span>
                <span className="whitespace-nowrap">포인트 +{m.points}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
