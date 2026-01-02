type Props = {
  others: { playerId: string; nickname: string | null }[];
};

export function SubwayFooter({ others }: Props) {
  return (
    <section className="rounded-2xl bg-zinc-900/80 px-3 py-2 text-xs text-zinc-100">
      <div className="mb-1 text-base font-semibold text-zinc-300">
        같은 장소에 있는 다른 플레이어
      </div>
      {others.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {others.map((p) => (
            <span
              key={p.playerId}
              className="rounded-full bg-zinc-800 px-2 py-0.5 text-base"
            >
              {p.nickname ?? "이름 없음"}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-base text-zinc-500">
          이 장소에 있는 다른 플레이어가 없습니다.
        </p>
      )}
    </section>
  );
}
