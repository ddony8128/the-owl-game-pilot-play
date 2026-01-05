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
  isLoading: boolean;
};

export function DefenseInfoTab({
  monsters,
  cards,
  score,
  isLoading,
}: MonsterProps) {
  const sortedMonsters = [...monsters].sort(
    (a, b) => a.slotIndex - b.slotIndex
  );

  const sortedCards = [...cards].sort((a, b) => a.cardSlot - b.cardSlot);

  return (
    <div className="space-y-4 text-base text-zinc-200">
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">대기열 몬스터</h2>
        {isLoading ? (
          // 1) 서버 응답 전: 로딩 상태
          <p className="text-sm text-zinc-400">몬스터들이 습격 중입니다!</p>
        ) : sortedMonsters.length === 0 ? (
          // 3) 서버 응답 후, 대기열이 비어 있음 = 게임 종료
          <p className="text-sm text-zinc-500">
            모든 몬스터를 무찔렀습니다! 게임이 종료되었습니다.
          </p>
        ) : (
          // 2) 서버 응답 후, 대기열에 몬스터가 있음
          <>
            <div className="grid gap-3">
              {sortedMonsters.map((m) => (
                <div
                  key={m.instanceId}
                  className="flex gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-2"
                >
                  {m.image && (
                    <div className="relative h-30 w-30 shrink-0 overflow-hidden rounded bg-zinc-800">
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
                      <div className="text-2xl font-semibold">{m.name}</div>
                      <div className="text-2xl text-amber-300">
                        +{m.points}점
                      </div>
                    </div>
                    <p className="text-sm text-zinc-400">{m.description}</p>
                    <div className="flex items-center justify-between text-base">
                      HP {m.currentHp}/{m.maxHp}
                      <br />
                      잔여 시간: {m.remainingTime}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
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
                <span className="text-2xl font-bold text-amber-300">
                  {c.cardValue}
                </span>
              </div>
              <p className="mt-1 text-base text-zinc-400">
                {c.isActive ? "활성" : "비활성"}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
