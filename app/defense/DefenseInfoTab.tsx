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
  showQueue: boolean;
};

export function DefenseInfoTab({
  monsters,
  cards,
  score,
  isLoading,
  showQueue,
}: MonsterProps) {
  const sortedMonsters = [...monsters].sort(
    (a, b) => a.slotIndex - b.slotIndex
  );
  const sortedCards = [...cards].sort((a, b) => a.cardSlot - b.cardSlot);
  const activeCount = sortedCards.filter((card) => card.isActive).length;

  return (
    <div className="space-y-4 text-sm text-zinc-200">
      <section className="overflow-hidden rounded-2xl border border-amber-400/25 bg-gradient-to-br from-zinc-900 to-amber-950/20 p-4 shadow-lg shadow-black/20">
        <p className="text-[11px] font-black tracking-[0.2em] text-amber-400">MY STATUS</p>
        <h2 className="mt-1 text-xl font-black text-white">내 점수 및 카드</h2>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-zinc-500">현재 점수</p>
            <p className="mt-1 text-3xl font-black tabular-nums text-white">
              {score}
              <span className="ml-1 text-base text-amber-300">점</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-zinc-500">사용 가능한 카드</p>
            <p className="mt-1 text-3xl font-black tabular-nums text-white">
              {isLoading ? "–" : activeCount}
              <span className="ml-1 text-base text-amber-300">장</span>
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between px-1">
          <div>
            <p className="text-[11px] font-black tracking-[0.18em] text-amber-400">MY DECK</p>
            <h3 className="mt-1 text-xl font-black text-white">내 숫자 카드</h3>
          </div>
          <span className="text-xs text-zinc-600">{isLoading ? "불러오는 중" : `${activeCount}장 사용 가능`}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {sortedCards.map((c) => (
            <div
              key={c.cardSlot}
              className={`relative flex min-h-32 flex-col items-center justify-center overflow-hidden rounded-2xl border px-3 py-3 ${
                c.isActive
                  ? "border-amber-400/70 bg-gradient-to-br from-zinc-800 to-zinc-950 shadow-lg shadow-amber-950/20"
                  : "border-zinc-800 bg-zinc-950 opacity-55 grayscale"
              }`}
            >
              <span className="absolute left-3 top-2 text-[10px] font-bold tracking-widest text-zinc-600">CARD {c.cardSlot}</span>
              <div className="flex items-center justify-center">
                <span className={`text-5xl font-black ${c.isActive ? "text-amber-300" : "text-zinc-600"}`}>
                  {c.cardValue}
                </span>
              </div>
              <p className={`mt-3 rounded-full px-3 py-1 text-xs font-bold ${c.isActive ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-800 text-zinc-500"}`}>
                {c.isActive ? "● 활성" : "× 비활성"}
              </p>
            </div>
          ))}
        </div>
      </section>

      {showQueue && (
        <section className="space-y-3">
          <div className="flex items-end justify-between px-1">
            <div>
              <p className="text-[11px] font-black tracking-[0.18em] text-rose-400">QUEUE</p>
              <h3 className="mt-1 text-xl font-black text-white">대기열 몬스터</h3>
            </div>
            <span className="text-xs text-zinc-600">
              {isLoading ? "불러오는 중" : `${sortedMonsters.length}마리`}
            </span>
          </div>
          {isLoading ? (
            <p className="px-1 text-sm text-zinc-400">몬스터들이 습격 중입니다!</p>
          ) : sortedMonsters.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-zinc-800 p-4 text-center text-sm text-zinc-500">
              대기열에 몬스터가 없습니다.
            </p>
          ) : (
            <div className="grid gap-3">
              {sortedMonsters.map((m) => (
                <div
                  key={m.instanceId}
                  className="flex items-center gap-3 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 p-3"
                >
                  <span className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-zinc-800">
                    {m.image ? (
                      <Image src={m.image} alt={m.name} fill sizes="80px" className="object-cover" />
                    ) : (
                      <span className="flex h-full items-center justify-center text-3xl">👾</span>
                    )}
                    <b className="absolute left-1 top-1 rounded-md bg-zinc-950/90 px-1.5 py-0.5 text-xs text-amber-300">
                      #{m.slotIndex + 1}
                    </b>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <b className="truncate text-lg text-white">{m.name}</b>
                      <b className="shrink-0 text-amber-300">+{m.points}점</b>
                    </div>
                    {m.description && (
                      <p className="mt-0.5 truncate text-xs text-zinc-500">{m.description}</p>
                    )}
                    <span className="mt-2 block h-2 overflow-hidden rounded-full bg-zinc-800">
                      <span
                        className="block h-full rounded-full bg-rose-500"
                        style={{ width: `${Math.max(0, Math.min(100, (m.currentHp / Math.max(1, m.maxHp)) * 100))}%` }}
                      />
                    </span>
                    <div className="mt-1 flex justify-between text-xs text-zinc-400">
                      <span>HP {m.currentHp}/{m.maxHp}</span>
                      <span>잔여 시간 {m.remainingTime}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
