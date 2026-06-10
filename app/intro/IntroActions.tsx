type Props = {
  activeGame: string | null;
  onOpenRules: () => void;
  onMainAction: () => void;
  subwayDisabled?: boolean;
};

export function IntroActions({
  activeGame,
  onOpenRules,
  onMainAction,
  subwayDisabled = false,
}: Props) {
  return (
    <div className="w-full max-w-md rounded-2xl bg-zinc-950/85 p-8 shadow-lg shadow-black/40 ring-1 ring-zinc-800/60 backdrop-blur-sm">
      <div className="flex flex-col gap-3">
        <button
          className="h-12 rounded-full border border-zinc-700 text-base font-medium text-zinc-100 hover:bg-zinc-800"
          onClick={onOpenRules}
        >
          규칙 / 안내
        </button>
        <button
          className="h-12 rounded-full bg-amber-400 text-base font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
          onClick={onMainAction}
          disabled={activeGame !== "subway" || subwayDisabled}
        >
          {activeGame === "subway" ? "이상교통 8번출구" : "준비 중"}
        </button>
      </div>
    </div>
  );
}
