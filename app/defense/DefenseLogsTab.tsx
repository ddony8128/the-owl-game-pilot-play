type Props = {
  logs: {
    round: number;
    log: string;
    createdAt: string;
  }[];
};

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
        최근 라운드부터 순서대로 로그가 표시됩니다.
      </p>
      <div className="space-y-1">
        {logs.map((l, idx) => (
          <div
            key={`${l.round}-${idx}-${l.createdAt}`}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm"
          >
            <div className="mb-1 flex items-center justify-between text-sm text-zinc-500">
              <span>라운드 {l.round}</span>
              <span>{new Date(l.createdAt).toLocaleTimeString()}</span>
            </div>
            <p className="whitespace-pre-wrap">{l.log}</p>
          </div>
        ))}
      </div>
    </div>
  );
}


