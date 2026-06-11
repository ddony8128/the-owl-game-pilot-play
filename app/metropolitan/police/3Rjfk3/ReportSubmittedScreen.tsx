type Props = {
  status: "pending" | "approved" | "rejected";
  onBack?: () => void;
};

export function ReportSubmittedScreen({ status, onBack }: Props) {
  let title = "신고 내용 확인 중입니다.";
  let body = "잠시 기다려 주십시오.\n귀하의 신고 사항을 검토 중입니다.";

  if (status === "approved") {
    title = "신고가 성공적으로 접수되었습니다.";
    body = "";
  } else if (status === "rejected") {
    title = "비정상적인 신고 사항입니다.";
    body = "";
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-center text-zinc-50">
      <h1 className="mb-2 text-lg font-semibold">{title}</h1>
      {body && (
        <p className="max-w-xs whitespace-pre-line text-base text-zinc-400">
          {body}
        </p>
      )}
      {(status === "rejected" || status === "approved") && (
        <button
          type="button"
          className="mt-4 h-10 w-40 rounded-full bg-zinc-800 text-sm font-semibold text-zinc-100 hover:bg-zinc-700"
          onClick={() => {
            if (onBack) {
              onBack();
              return;
            }
            if (typeof window !== "undefined") {
              window.history.back();
            }
          }}
        >
          돌아가기
        </button>
      )}
    </div>
  );
}
