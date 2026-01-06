type Props = {
  title: string;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
};

export function DefenseBoardControls({
  title,
  canPrev,
  canNext,
  onPrev,
  onNext,
}: Props) {
  return (
    <section className="flex items-center justify-between rounded-lg bg-zinc-900 px-4 py-3 text-base">
      <div>
        <h2 className="text-3xl font-semibold">{title}</h2>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="h-9 rounded-full bg-zinc-800 px-3 text-base font-semibold text-zinc-100 hover:bg-zinc-700 disabled:opacity-50"
          disabled={!canPrev}
          onClick={onPrev}
        >
          이전
        </button>
        <button
          type="button"
          className="h-9 rounded-full bg-amber-400 px-3 text-base font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-50"
          disabled={!canNext}
          onClick={onNext}
        >
          다음
        </button>
      </div>
    </section>
  );
}
