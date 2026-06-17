import Link from "next/link";

export default function LockedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-center text-zinc-50">
      <div className="mb-6 flex h-32 w-32 items-center justify-center rounded-full bg-zinc-800 text-5xl">
        ⛔
      </div>
      <h1 className="mb-4 text-lg font-semibold">
        지금은 접근할 수 없는 페이지입니다.
      </h1>
      <Link
        href="/"
        className="mt-2 inline-flex h-10 items-center justify-center rounded-full border border-zinc-700 px-4 text-sm text-zinc-100 hover:bg-zinc-900"
      >
        메인 페이지로 돌아가기
      </Link>
    </div>
  );
}
