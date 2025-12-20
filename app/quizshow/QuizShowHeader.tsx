type HeaderProps = {
  mode: "finalist" | "spectator";
  score?: number;
  chances?: { peek: boolean; bet: boolean; safe: boolean };
  liveScores?: {
    nickname: string;
    score: number;
    chances: { peek: boolean; bet: boolean; safe: boolean };
    streak: number;
  }[];
};

export function QuizShowHeader({
  mode,
  score = 0,
  chances = { peek: true, bet: true, safe: true },
  liveScores = [],
}: HeaderProps) {
  return (
    <header className="flex w-full max-w-md flex-col items-center gap-2 text-center">
      <h1 className="text-2xl font-semibold">부엉퀴즈쇼</h1>
      {mode === "finalist" ? (
        <div className="mt-1 flex flex-col items-center gap-1 text-sm text-zinc-300">
          <div className="rounded-full bg-zinc-900 px-4 py-2 text-xl font-mono text-amber-300">
            내 점수 : {score}
          </div>
          <div className="text-xs text-zinc-400">
            남은 찬스 (컨닝 / 베팅 / 무산):{" "}
            <span className="font-mono">
              {chances.peek ? "O" : "X"} / {chances.bet ? "O" : "X"} /{" "}
              {chances.safe ? "O" : "X"}
            </span>
          </div>
        </div>
      ) : null}

      <div className="mt-2 w-full max-w-md rounded-xl bg-zinc-900 p-3 text-xs text-zinc-200">
        <p className="mb-1 text-sm font-semibold text-zinc-100">
          결승 진출자 현재 점수 / 찬스 사용 / 연속 득점
        </p>
        {liveScores.length === 0 ? (
          <p className="text-[11px] text-zinc-400">
            아직 점수 정보가 없습니다.
          </p>
        ) : (
          <ul className="space-y-1">
            {liveScores.map((p, idx) => (
              <li
                key={`${p.nickname}-${idx}`}
                className="flex items-center justify-between rounded bg-zinc-950 px-3 py-1"
              >
                <div className="flex flex-col text-left">
                  <span className="text-sm">{p.nickname}</span>
                  <span className="mt-0.5 text-[11px] text-zinc-400">
                    컨닝: {p.chances.peek ? "미사용" : "사용"} / 베팅:{" "}
                    {p.chances.bet ? "미사용" : "사용"} / 무산:{" "}
                    {p.chances.safe ? "미사용" : "사용"} /{" "}
                    {p.streak > 0
                      ? `${p.streak}문제째 연속 득점 중!`
                      : "연속 득점 끊김.."}
                  </span>
                </div>
                <span className="font-mono text-base text-amber-300">
                  {p.score}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </header>
  );
}
