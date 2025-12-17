type Props = {
  interactionDisabled: boolean;
  onMoveForward: () => void;
  onMoveBack: () => void;
};

export function SubwayControlsSection({
  interactionDisabled,
  onMoveForward,
  onMoveBack,
}: Props) {
  return (
    <section className="mt-4 flex flex-col gap-4">
      <button
        className="h-12 w-full rounded-full bg-amber-400 text-base font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
        disabled={interactionDisabled}
        onClick={onMoveForward}
      >
        앞으로 간다
      </button>
      <button
        className="h-12 w-full rounded-full border border-zinc-700 bg-zinc-900 text-base font-medium text-zinc-100 hover:bg-zinc-800 disabled:opacity-40"
        disabled={interactionDisabled}
        onClick={onMoveBack}
      >
        뒤로 돌아간다
      </button>
    </section>
  );
}
