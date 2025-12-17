type Props = {
  timeLabel: string;
  exitLabel: string;
  exitValue: string;
  hasNewRule: boolean;
  interactionDisabled: boolean;
  onOpenGuide: () => void;
};

export function SubwayHeader({
  timeLabel,
  exitLabel,
  exitValue,
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
        <div className="text-right">
          <div className="text-base text-zinc-400">{exitLabel}</div>
          <div className="text-lg font-semibold text-amber-300">
            {exitValue}
          </div>
        </div>
      </div>
    </header>
  );
}
