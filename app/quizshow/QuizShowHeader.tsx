type Props = {
  score: number;
  chances: { peek: boolean; bet: boolean; safe: boolean };
};

export function QuizShowHeader({ score, chances }: Props) {
  return (
    <header className="flex w-full max-w-md items-center justify-between">
      <div>
        <h1 className="text-lg font-semibold">부엉퀴즈쇼</h1>
        <p className="text-xs text-zinc-400">결승 진출자 전용 퀴즈입니다.</p>
      </div>
      <div className="text-right text-[10px] text-zinc-400">
        <div>점수 {score}</div>
        <div>
          찬스 P/B/S: {chances.peek ? "O" : "X"}/{chances.bet ? "O" : "X"}/
          {chances.safe ? "O" : "X"}
        </div>
      </div>
    </header>
  );
}
