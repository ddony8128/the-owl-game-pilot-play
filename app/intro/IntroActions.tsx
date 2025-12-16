type Props = {
  activeGame: string | null;
  onOpenRules: () => void;
  onMainAction: () => void;
};

export function IntroActions({ activeGame, onOpenRules, onMainAction }: Props) {
  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <button
        className="h-11 rounded-full border border-zinc-700 text-sm font-medium text-zinc-100 hover:bg-zinc-800"
        onClick={onOpenRules}
      >
        규칙 보기
      </button>
      <button
        className="h-11 rounded-full bg-amber-400 text-sm font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
        onClick={onMainAction}
        disabled={!activeGame}
      >
        {activeGame === "subway" && "이상교통 8번출구 시작"}
        {activeGame === "mafia_tutorial" && "자본주의 마피아 튜토리얼"}
        {activeGame === "mafia" && "자본주의 마피아 입장"}
        {activeGame === "vote" && "투표하러 가기"}
        {activeGame === "quiz" && "부엉퀴즈쇼 입장"}
        {!activeGame && "곧 시작됩니다"}
      </button>
    </div>
  );
}
