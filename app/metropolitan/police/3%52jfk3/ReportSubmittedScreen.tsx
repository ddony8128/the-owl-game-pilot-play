type Props = {
  nickname: string | null;
};

export function ReportSubmittedScreen({ nickname }: Props) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-center text-zinc-50">
      <h1 className="mb-2 text-lg font-semibold">신고가 접수되었습니다</h1>
      <p className="max-w-xs text-sm text-zinc-400">
        GM이 내용을 확인할 때까지 이 화면을 유지해 주세요.
        <br />
        승인 또는 기각은 현장에서 GM이 안내합니다.
      </p>
    </div>
  );
}
