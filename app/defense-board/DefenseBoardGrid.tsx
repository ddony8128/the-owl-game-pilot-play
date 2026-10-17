import type { BoardMonster } from "./types";

type Props = {
  monsters: BoardMonster[];
  isResultView: boolean;
};

type Variant = "normal" | "damaged" | "dead" | "expired";

function buildImageVariant(image: string, variant: Variant) {
  if (!image.endsWith(".png")) return image;
  if (variant === "normal") return image;
  const base = image.replace(".png", "");
  return `${base}_${variant}.png`;
}

export function DefenseBoardGrid({ monsters, isResultView }: Props) {
  if (monsters.length === 0) {
    return (
      <p className="text-sm text-zinc-400">
        이 라운드는 대기열에 몬스터가 없습니다.
      </p>
    );
  }

  const cardWidth = monsters.length === 4
    ? "sm:w-[calc(50%_-_0.375rem)] xl:w-[calc(25%_-_0.5625rem)]"
    : monsters.length === 5
      ? "sm:w-[calc(50%_-_0.375rem)] lg:w-[calc(33.333%_-_0.5rem)] xl:w-[calc(20%_-_0.6rem)]"
      : "sm:w-72";

  return (
    <section className="h-full min-h-0">
      <div className="flex h-full w-full flex-wrap items-center justify-center gap-3">
        {monsters.map((m) => {
          const hpBefore = m.snapshotHp;
          const hpAfter =
            m.hpAfter != null && m.hpAfter >= 0 ? m.hpAfter : hpBefore;

          let variant: Variant = "normal";
          if (isResultView) {
            if (m.statusAfter === "defeated") {
              variant = "dead";
            } else if (m.statusAfter === "expired") {
              variant = "expired";
            } else if (m.statusAfter === "active" && hpAfter < hpBefore) {
              variant = "damaged";
            } else {
              variant = "normal";
            }
          }

          const imgSrc = buildImageVariant(m.image, variant);
          const hpDisplay = isResultView
            ? `${hpBefore} → ${Math.max(0, hpAfter)}`
            : `${hpBefore} / ${m.maxHp}`;

          const remainingDisplay = isResultView
            ? m.remainingTimeAfter ?? m.snapshotRemainingTime
            : m.snapshotRemainingTime;
          const hpValue = isResultView ? Math.max(0, hpAfter) : hpBefore;
          const hpPercent = Math.max(0, Math.min(100, (hpValue / Math.max(1, m.maxHp)) * 100));
          const status = !isResultView
            ? { label: "공격 가능", detail: "", tone: "border-sky-400/20 bg-sky-950/30 text-sky-200", dot: "bg-sky-400" }
            : m.statusAfter === "defeated"
              ? { label: "처치됨", detail: "HP가 모두 소진되었습니다", tone: "border-rose-400/25 bg-rose-950/25 text-rose-200", dot: "bg-rose-400" }
              : m.statusAfter === "expired"
                ? { label: "도망침", detail: "남은 시간이 만료되었습니다", tone: "border-amber-400/25 bg-amber-950/25 text-amber-200", dot: "bg-amber-300" }
                : m.statusAfter === "missing"
                  ? { label: "전장 이탈", detail: "상태를 확인해주세요", tone: "border-zinc-500/25 bg-zinc-800/40 text-zinc-200", dot: "bg-zinc-400" }
                : hpAfter < hpBefore
                  ? { label: "생존", detail: `${hpBefore - hpAfter} 피해를 입었습니다`, tone: "border-orange-400/25 bg-orange-950/25 text-orange-200", dot: "bg-orange-400" }
                  : { label: "생존", detail: "이번 라운드 피해 없음", tone: "border-emerald-400/25 bg-emerald-950/25 text-emerald-200", dot: "bg-emerald-400" };
          const cardTone = variant === "dead"
            ? "border-red-500/30"
            : variant === "expired"
              ? "border-amber-500/30"
              : variant === "damaged"
                ? "border-orange-500/30"
                : "border-zinc-800";

          return (
            <article
              key={m.instanceId}
              className={`flex w-full flex-col overflow-hidden rounded-2xl border bg-zinc-900/90 shadow-xl shadow-black/20 ${cardWidth} ${cardTone}`}
            >
              <div className="relative h-[clamp(8rem,30vh,16rem)] w-full overflow-hidden bg-gradient-to-b from-zinc-800 to-zinc-900 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imgSrc}
                  alt={m.name}
                  className="h-full w-full object-contain"
                />
                <span className="absolute left-2 top-2 rounded-md bg-black/55 px-2 py-1 font-mono text-[10px] font-bold tracking-wider text-zinc-400 backdrop-blur">SLOT {m.slotIndex + 1}</span>
              </div>
              <div className="space-y-3 p-3">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <h2 className="min-w-0 text-xl font-black leading-tight text-white">{m.name}</h2>
                  <span className="shrink-0 rounded-full bg-amber-400/10 px-2.5 py-1 text-sm font-bold text-amber-300 ring-1 ring-inset ring-amber-400/20">+{m.points}점</span>
                </div>
                {!isResultView ? (
                  <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-bold ${status.tone}`}>{status.label}</span>
                ) : null}

                {isResultView ? (
                  <div className={`overflow-hidden rounded-xl border ${status.tone}`}>
                    <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2.5">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${status.dot}`} />
                      <b className="text-sm font-black text-zinc-100">{status.label}</b>
                      <span className="ml-auto min-w-0 truncate text-right text-[11px] font-medium opacity-70">{status.detail}</span>
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-white/5 bg-black/10">
                      <div className="px-3 py-2.5">
                        <span className="block text-[10px] font-bold tracking-wider opacity-50">HP</span>
                        <span className="mt-0.5 block font-mono text-lg font-black tabular-nums text-white">{hpDisplay}</span>
                      </div>
                      <div className="px-3 py-2.5 text-right">
                        <span className="block text-[10px] font-bold tracking-wider opacity-50">남은 시간</span>
                        <span className="mt-0.5 block font-mono text-lg font-black tabular-nums text-white">
                          {m.statusAfter === "defeated"
                            ? "—"
                            : m.statusAfter === "expired"
                              ? `${m.snapshotRemainingTime} → 0`
                              : `${m.snapshotRemainingTime} → ${remainingDisplay}`}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">HP</span>
                      <span className="font-mono text-lg font-bold tabular-nums text-zinc-100">{hpDisplay}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${hpPercent <= 30 ? "bg-red-400" : hpPercent <= 60 ? "bg-amber-400" : "bg-emerald-400"}`}
                        style={{ width: `${hpPercent}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between border-t border-zinc-800 pt-3 text-sm">
                      <span className="text-zinc-500">남은 시간</span>
                      <span className="font-bold text-zinc-300">{remainingDisplay}라운드</span>
                    </div>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
