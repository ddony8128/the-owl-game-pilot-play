type Props = {
  score: number;
  chances: { peek: boolean; bet: boolean; safe: boolean };
};

export function QuizShowHeader({ score, chances }: Props) {
  return (
    <header className="flex w-full max-w-md flex-col items-center gap-2 text-center">
      <h1 className="text-2xl font-semibold">부엉퀴즈쇼</h1>
      <div className="mt-1 flex items-center gap-4 text-sm text-zinc-300">
        <div className="rounded-full bg-zinc-900 px-4 py-2 text-xl font-mono text-amber-300">
          내 점수 : {score}
        </div>
        <div className="text-base text-zinc-400">
          <div>남은 찬스 (컨닝 / 베팅 / 무산)</div>
          <div className="font-mono">
            {chances.peek ? "O" : "X"} / {chances.bet ? "O" : "X"} /{" "}
            {chances.safe ? "O" : "X"}
          </div>
        </div>
      </div>
    </header>
  );
}
