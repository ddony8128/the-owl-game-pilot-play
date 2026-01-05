type Props = {
  minutes: number | null;
  seconds: number | null;
  roundLabel: string;
};

export function DefenseHeader({ minutes, seconds, roundLabel }: Props) {
  const timeLabel =
    minutes != null && seconds != null
      ? `${minutes.toString().padStart(2, "0")}:${seconds
          .toString()
          .padStart(2, "0")}`
      : "--:--";

  return (
    <header className="w-full max-w-md space-y-3 text-center">
      <div className="flex items-center justify-center">
        <span className="rounded-full bg-zinc-900 px-4 py-2 font-mono text-xl">
          {timeLabel}
        </span>
      </div>
      <div className="space-y-1">
        <p className="text-base font-semibold text-zinc-100">디펜스 딜레마</p>
        <p className="text-sm text-zinc-400">현재 라운드: {roundLabel}</p>
      </div>
    </header>
  );
}


