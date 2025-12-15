export default function LockedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-center text-zinc-50">
      <div className="mb-6 h-32 w-32 rounded-full bg-zinc-800" />
      <h1 className="mb-2 text-lg font-semibold">접근할 수 없습니다</h1>
      <p className="max-w-xs text-sm text-zinc-400">
        아직 열리지 않은 페이지입니다. GM의 안내를 받은 뒤 다시 시도해 주세요.
      </p>
    </div>
  );
}
