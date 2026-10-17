"use client";

import type { BoardMonster } from "./types";
import { useRevealSteps } from "@/components/board/useRevealSteps";

type Props = {
  monsters: BoardMonster[];
  /** 전투 결과 화면이면 몬스터별 순차 공개(1.4초 간격) + 처치/피해/도망 연출 */
  isResultView: boolean;
  /** 결과 공개가 끝나면 호출(대기열 화면에서는 즉시) */
  onDone?: () => void;
};

type Variant = "normal" | "damaged" | "dead" | "expired";

function buildImageVariant(image: string, variant: Variant) {
  if (!image.endsWith(".png")) return image;
  if (variant === "normal") return image;
  const base = image.replace(".png", "");
  return `${base}_${variant}.png`;
}

type Outcome = {
  variant: Variant;
  cue: "defeated" | "expired" | "damaged" | "untouched";
  label: string;
  dealt: number;
};

function outcomeOf(m: BoardMonster): Outcome {
  const hpBefore = m.snapshotHp;
  const hpAfter = m.hpAfter != null && m.hpAfter >= 0 ? m.hpAfter : hpBefore;
  const dealt = Math.max(0, hpBefore - hpAfter);
  if (m.statusAfter === "defeated") return { variant: "dead", cue: "defeated", label: "처치!", dealt: hpBefore };
  if (m.statusAfter === "expired") return { variant: "expired", cue: "expired", label: "도망쳤습니다!", dealt };
  if (m.statusAfter === "active" && hpAfter < hpBefore)
    return { variant: "damaged", cue: "damaged", label: `${dealt} 피해`, dealt };
  return { variant: "normal", cue: "untouched", label: "가만히 있습니다", dealt: 0 };
}

const CUE_STYLE: Record<Outcome["cue"], { badge: string; card: string; img: string }> = {
  defeated: { badge: "bg-amber-400 text-zinc-950", card: "border-amber-300/80 board-flash", img: "" },
  expired: { badge: "bg-red-600 text-white", card: "border-red-500/70", img: "board-flee" },
  damaged: { badge: "bg-orange-500 text-white", card: "border-orange-400/70", img: "board-shake" },
  untouched: { badge: "bg-zinc-700 text-zinc-200", card: "border-white/10", img: "" },
};

/**
 * 대기열/전투 결과 카드. 카드 너비·이미지는 뷰포트 비율(5장이 1280×720 에서도 한 줄).
 * 결과 화면은 카드가 먼저 "이전 상태"로 전부 깔리고, 1.4초 간격으로 한 장씩 결과로 뒤집힌다.
 */
export function DefenseBoardGrid({ monsters, isResultView, onDone }: Props) {
  const total = isResultView ? monsters.length : 0;
  const { shown } = useRevealSteps(total, onDone);

  if (monsters.length === 0) {
    return (
      <p className="text-[clamp(1rem,2.6vh,1.6rem)] text-zinc-400" data-testid="board-monster-empty">
        이 라운드는 대기열에 몬스터가 없습니다.
      </p>
    );
  }

  return (
    <section
      className="flex min-h-0 flex-1 flex-wrap content-center items-center justify-center gap-[1vw]"
      data-testid="board-monster-grid"
      data-shown={isResultView ? shown : monsters.length}
      data-total={monsters.length}
    >
      {monsters.map((m, i) => {
        const revealed = !isResultView || shown > i;
        const outcome = isResultView ? outcomeOf(m) : null;
        const showResult = isResultView && revealed && outcome;
        const variant: Variant = showResult ? outcome.variant : "normal";
        const imgSrc = buildImageVariant(m.image, variant);
        const hpAfter = m.hpAfter != null && m.hpAfter >= 0 ? m.hpAfter : m.snapshotHp;
        const hpDisplay = showResult ? `${Math.max(0, hpAfter)} / ${m.maxHp}` : `${m.snapshotHp} / ${m.maxHp}`;
        const remainingDisplay = showResult ? (m.remainingTimeAfter ?? m.snapshotRemainingTime) : m.snapshotRemainingTime;
        const style = showResult ? CUE_STYLE[outcome.cue] : null;

        return (
          <div
            key={m.instanceId}
            className={`flex w-[17vw] min-w-[150px] max-w-[320px] flex-col items-center gap-[0.8vh] rounded-2xl border bg-zinc-900/80 p-[0.8vw] backdrop-blur-sm ${
              style ? `${style.card} board-reveal` : "border-white/10"
            } ${isResultView && !revealed ? "opacity-60" : ""}`}
            data-testid="board-monster-card"
            data-shown={revealed ? "true" : "false"}
            data-cue={showResult ? outcome.cue : undefined}
          >
            <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-zinc-800/80" style={{ maxHeight: "36vh" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgSrc}
                alt={m.name}
                className={`h-full w-full object-contain ${style?.img ?? ""} ${isResultView && !revealed ? "grayscale" : ""}`}
              />
              {isResultView && !revealed ? (
                <span className="board-drum absolute inset-x-0 bottom-[6%] text-center text-[clamp(1.5rem,5vh,3.5rem)] font-black text-zinc-100">
                  ···
                </span>
              ) : null}
            </div>
            <div className="w-full text-center">
              <div className="flex items-center justify-between text-[clamp(1rem,2.4vh,1.6rem)] font-bold leading-tight">
                <span className="truncate">{m.name}</span>
                <span className="flex-none text-amber-300">+{m.points}점</span>
              </div>
              {showResult ? (
                <p className={`mx-auto mt-[0.5vh] inline-block rounded-full px-[0.8em] py-[0.15em] text-[clamp(0.95rem,2.4vh,1.6rem)] font-black ${style?.badge}`}>
                  {outcome.label}
                </p>
              ) : (
                <p className="mt-[0.5vh] text-[clamp(0.9rem,2.1vh,1.4rem)] text-zinc-400">
                  {isResultView ? "결과 확인 중…" : "공격하세요!"}
                </p>
              )}
              <p className="mt-[0.4vh] text-[clamp(0.9rem,2.1vh,1.4rem)] leading-snug text-zinc-300 tabular-nums">
                HP {hpDisplay}
                <br />
                잔여 시간 {remainingDisplay}
              </p>
            </div>
          </div>
        );
      })}
    </section>
  );
}
