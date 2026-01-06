type Props = {
  logs: {
    round: number;
    log: string;
    createdAt: string;
  }[];
};

function getRoundLabelForLog(round: number): string {
  if (round === 0) return "준비";
  if (round === 1) return "튜토리얼 1라운드";
  if (round === 2) return "튜토리얼 2라운드";
  if (round === 3) return "튜토리얼 결과";
  if (round >= 4 && round <= 15) {
    const gameRound = round - 3; // 4~15 -> 1~12라운드
    return `${gameRound}라운드`;
  }
  if (round === 16) return "게임 종료";
  return `알 수 없음 (DB round ${round})`;
}

export function DefenseLogsTab({ logs }: Props) {
  if (logs.length === 0) {
    return (
      <div className="text-base text-zinc-400">
        아직 기록된 로그가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-2 text-base text-zinc-200">
      <p className="text-sm text-zinc-400">
        최근 로그부터 순서대로 표시됩니다.
      </p>
      <div className="space-y-1">
        {logs.map((l, idx) => (
          <div
            key={`${l.round}-${idx}-${l.createdAt}`}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm"
          >
            <div className="mb-1 flex items-center justify-between text-sm text-zinc-500">
              <span>{getRoundLabelForLog(l.round)}</span>
            </div>
            <p className="whitespace-pre-wrap">{l.log}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
