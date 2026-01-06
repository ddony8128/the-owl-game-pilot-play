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

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap justify-center gap-4">
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
            ? `${Math.max(0, hpAfter)} / ${m.maxHp}`
            : `${hpBefore} / ${m.maxHp}`;

          const remainingDisplay = isResultView
            ? m.remainingTimeAfter ?? m.snapshotRemainingTime
            : m.snapshotRemainingTime;

          return (
            <div
              key={m.instanceId}
              className="flex w-56 flex-col items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-sm"
            >
              <div className="h-50 w-50 overflow-hidden rounded bg-zinc-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imgSrc}
                  alt={m.name}
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="w-full space-y-1 text-center">
                <div className="flex items-center justify-between text-2xl font-semibold">
                  <span>{m.name}</span>
                  <span className="text-amber-300">+{m.points}점</span>
                </div>
                <p className="text-2xl text-zinc-400">
                  {isResultView
                    ? m.statusAfter === "defeated"
                      ? "처치했습니다."
                      : m.statusAfter === "expired"
                      ? "도망쳤습니다!"
                      : m.statusAfter === "active" && hpAfter < hpBefore
                      ? "아파합니다."
                      : "가만히 있습니다."
                    : "공격하세요!"}
                </p>
                <p className="text-2xl text-zinc-300">
                  HP {hpDisplay}
                  <br />
                  잔여 시간: {remainingDisplay}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
