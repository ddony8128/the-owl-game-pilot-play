import Image from "next/image";
import Link from "next/link";

export default function LockedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-center text-zinc-50">
      <div className="mb-6 h-32 w-32 overflow-hidden rounded-full bg-zinc-800">
        <Image
          src="/else/angry_owl.png"
          alt="angry owl"
          width={128}
          height={128}
          className="h-full w-full object-cover"
        />
      </div>
      <h1 className="mb-4 text-lg font-semibold">
        정상적이지 않은 접근이부엉!
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
