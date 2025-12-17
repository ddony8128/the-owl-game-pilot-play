type Props = {
  finishedRank: number | null;
  onBackToIntro: () => void;
};

export function SubwayEndContent({ finishedRank, onBackToIntro }: Props) {
  const isSuccess = typeof finishedRank === "number";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-center text-zinc-50">
      {isSuccess ? (
        <>
          <h1 className="mb-2 text-2xl font-semibold">탈출 성공!</h1>
          <br />
          <p className="mb-1 text-base text-amber-300">
            당신은 {finishedRank}등으로 파일럿 역에서 탈출하셨습니다.
          </p>
          <p className="mb-4 max-w-xs text-base text-zinc-400">
            축하드립니다!
            <br />
            환호성을 지르며 기쁨을 마음껏 드러내도 좋고,
            <br />
            아무 일 없었다는 듯 모른 척해도 좋습니다.
            <br />
            <br />
            혹은, 두 번째 게임에서 함께하고 싶은 사람에게 은밀히 힌트를 주어도
            좋습니다.
          </p>
          <br />
        </>
      ) : (
        <>
          <h1 className="mb-2 text-2xl font-semibold">탈출 실패</h1>
          <br />
          <p className="mb-4 max-w-xs text-base text-zinc-400">
            아쉽게도 시간이 다 되었습니다.
            <br />
            당신은 탈출에 실패했습니다.
            <br />
            <br />
            괜찮습니다.
            <br />
            다음 게임이 있습니다.
          </p>
          <br />
        </>
      )}
      <button
        className="h-12 w-full max-w-xs rounded-full bg-amber-400 text-base font-semibold text-zinc-950 hover:bg-amber-300"
        onClick={onBackToIntro}
      >
        메인 페이지로 돌아가기
      </button>
    </div>
  );
}
