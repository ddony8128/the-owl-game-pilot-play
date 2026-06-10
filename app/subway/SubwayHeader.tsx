type Props = {
  timeLabel: string;
  exitLabel: string;
  exitValue: string;
  resetCount: number;
  hasNewRule: boolean;
  interactionDisabled: boolean;
  onOpenGuide: () => void;
};

export function SubwayHeader({
  timeLabel,
  exitLabel,
  exitValue,
  resetCount,
  hasNewRule,
  interactionDisabled,
  onOpenGuide,
}: Props) {
  return (
    <header className="w-full max-w-md space-y-3">
      <div className="flex items-center justify-center">
        <span className="rounded-full bg-zinc-900 px-4 py-2 font-mono text-xl">
          {timeLabel}
        </span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <button
          className={`h-12 rounded-full border border-zinc-700 px-12 text-lg text-zinc-100 hover:bg-zinc-900 disabled:opacity-40 ${
            hasNewRule ? "animate-alert-pulse border-red-500" : ""
          }`}
          disabled={interactionDisabled}
          onClick={onOpenGuide}
        >
          안내문
        </button>
        <div className="text-right space-y-1">
          <div>
            <div className="text-base text-zinc-400">{exitLabel}</div>
            <div className="text-lg font-semibold text-amber-300">
              {exitValue}
            </div>
          </div>
          <div className="text-base text-zinc-400">
            <span>0번 출구로 돌아간 횟수: </span>
            <span
              className={
                resetCount > 15
                  ? "text-lg font-bold text-red-500"
                  : "font-semibold text-zinc-200"
              }
            >
              {resetCount.toString()}회
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
