import Image from "next/image";

type MonsterProps = {
  monsters: {
    instanceId: string;
    monsterId: number;
    slotIndex: number;
    currentHp: number;
    remainingTime: number;
    status: string;
    name: string;
    description: string;
    maxHp: number;
    baseTime: number;
    points: number;
    image: string;
  }[];
  cards: {
    cardSlot: number;
    cardValue: number;
    isActive: boolean;
  }[];
  score: number;
};

export function DefenseInfoTab({ monsters, cards, score }: MonsterProps) {
  const sortedMonsters = [...monsters].sort(
    (a, b) => a.slotIndex - b.slotIndex
  );

  const sortedCards = [...cards].sort(
    (a, b) => a.cardSlot - b.cardSlot
  );

  return (
    <div className="space-y-4 text-base text-zinc-200">
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">대기열 몬스터</h2>
        <p className="text-sm text-zinc-400">
          현재 대기열에 있는 몬스터와 체력 / 잔여 시간 / 포인트를 보여줍니다.
        </p>
        {sortedMonsters.length === 0 ? (
          <p className="text-sm text-zinc-500">
            모든 몬스터를 무찔렀습니다! 게임이 종료되었습니다.
          </p>
        ) : (
          <div className="grid gap-3">
            {sortedMonsters.map((m) => (
              <div
                key={m.instanceId}
                className="flex gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-2"
              >
                {m.image && (
                  <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded bg-zinc-800">
                    <Image
                      src={m.image}
                      alt={m.name}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="text-base font-semibold">{m.name}</div>
                    <div className="text-sm text-amber-300">
                      +{m.points}점
                    </div>
                  </div>
                  <p className="text-sm text-zinc-400">
                    {m.description}
                  </p>
                  <div className="flex items-center justify-between text-sm">
                    <span>
                      HP {m.currentHp}/{m.maxHp}
                    </span>
                    <span>잔여 시간: {m.remainingTime} 라운드</span>
                    <span>대기열: {m.slotIndex + 1}번 칸</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">내 점수 및 카드</h2>
        <div className="flex items-center justify-between rounded-lg bg-zinc-900 px-3 py-2">
          <span className="text-sm text-zinc-400">현재 포인트</span>
          <span className="text-lg font-semibold text-amber-300">
            {score.toString()}점
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {sortedCards.map((c) => (
            <div
              key={c.cardSlot}
              className={`rounded-lg border px-3 py-2 text-base ${
                c.isActive
                  ? "border-emerald-500/60 bg-zinc-900"
                  : "border-zinc-700 bg-zinc-950 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold">
                  슬롯 {c.cardSlot}
                </span>
                <span className="text-base font-bold text-amber-300">
                  {c.cardValue}
                </span>
              </div>
              <p className="mt-1 text-sm text-zinc-400">
                상태: {c.isActive ? "활성" : "비활성"}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}


