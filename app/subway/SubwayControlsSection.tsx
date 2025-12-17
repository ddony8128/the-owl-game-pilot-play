type Props = {
  interactionDisabled: boolean;
  lastResult: "correct" | "wrong" | "reset" | "noop" | null;
  onMoveForward: () => void;
  onMoveBack: () => void;
};

export function SubwayControlsSection({
  interactionDisabled,
  lastResult,
  onMoveForward,
  onMoveBack,
}: Props) {
  return (
    <section className="mt-4 flex flex-col gap-3">
      <button
        className="h-11 w-full rounded-full bg-amber-400 text-sm font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
        disabled={interactionDisabled}
        onClick={onMoveForward}
      >
        앞으로 간다
      </button>
      <button
        className="h-11 w-full rounded-full border border-zinc-700 bg-zinc-900 text-sm font-medium text-zinc-100 hover:bg-zinc-800 disabled:opacity-40"
        disabled={interactionDisabled}
        onClick={onMoveBack}
      >
        뒤로 돌아간다
      </button>
      {lastResult === "correct" && (
        <p className="text-[11px] text-emerald-300">
          올바른 방향입니다. 출구 번호가 증가했습니다.
        </p>
      )}
      {lastResult === "wrong" && (
        <p className="text-[11px] text-red-300">
          잘못된 방향입니다. 출구 번호가 0으로 돌아갔습니다.
        </p>
      )}
    </section>
  );
}
