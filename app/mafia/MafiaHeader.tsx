type Props = {
  minutes: number | null;
  seconds: number | null;
  roundLabel: string;
  phaseLabel: string;
};

export function MafiaHeader({
  minutes,
  seconds,
  roundLabel,
  phaseLabel,
}: Props) {
  return (
    <header className="flex w-full max-w-md flex-col items-center gap-2 text-center">
      <h1 className="text-2xl font-semibold">자본주의 마피아</h1>
      <div className="text-base text-zinc-300">
        <span className="font-medium">{roundLabel}</span>{" "}
        <span className="mx-1">/</span>
        <span>{phaseLabel}</span>
      </div>
      <div className="mt-1 rounded-full bg-zinc-900 px-4 py-1 text-lg font-mono text-zinc-50">
        {minutes != null && seconds != null
          ? `${minutes.toString().padStart(2, "0")}:${seconds
              .toString()
              .padStart(2, "0")}`
          : "--:--"}
      </div>
    </header>
  );
}
