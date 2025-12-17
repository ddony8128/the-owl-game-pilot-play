type Props = {
  onBackToIntro: () => void;
};

export function SubwayEndContent({ onBackToIntro }: Props) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-center text-zinc-50">
      <h1 className="mb-2 text-xl font-semibold">시간 종료입니다.</h1>
      <p className="mb-4 max-w-xs text-sm text-zinc-400">
        제한 시간 50분 안에 8번 출구에 도달하지 못했습니다.
        <br />
        이번 라운드에서는 모든 플레이어가 공동 꼴찌로 기록됩니다.
      </p>
      <button
        className="h-11 w-full max-w-xs rounded-full bg-amber-400 text-sm font-semibold text-zinc-950 hover:bg-amber-300"
        onClick={onBackToIntro}
      >
        인트로로 돌아가기
      </button>
    </div>
  );
}
