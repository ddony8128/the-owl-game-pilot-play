import type { MafiaPhaseState } from "@/lib/types";

type Props = {
  phase: MafiaPhaseState | null;
  minutes: number | null;
  seconds: number | null;
};

export function MafiaHeader({ phase, minutes, seconds }: Props) {
  return (
    <header className="flex w-full max-w-md items-center justify-between">
      <div>
        <h1 className="text-lg font-semibold">자본주의 마피아</h1>
        <p className="text-xs text-zinc-400">
          라운드와 페이즈에 맞춰 행동해 주세요.
        </p>
      </div>
      <div className="text-right text-[10px] text-zinc-400">
        <div>
          라운드 {phase?.round_number ?? "-"} / 페이즈 {phase?.phase ?? "-"}
        </div>
        <div>
          남은 시간{" "}
          {minutes != null && seconds != null
            ? `${minutes}:${seconds.toString().padStart(2, "0")}`
            : "--:--"}
        </div>
      </div>
    </header>
  );
}
