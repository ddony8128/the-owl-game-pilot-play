import Image from "next/image";
import Link from "next/link";

/**
 * ITER6 C1 — 없는 주소(404)·접근할 수 없는 화면의 공통 안내. 막힌 느낌 대신 "주소 확인 → 입장 화면" 길을 준다.
 * (예전 /locked "정상적이지 않은 접근이부엉!"은 첫 접속 참가자가 다른 방 세션 때문에 자주 보던 화면이었다)
 */
export function AddressNotice({ testId = "address-notice" }: { testId?: string }) {
  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center bg-zinc-950 px-6 text-center text-zinc-50"
      data-testid={testId}
    >
      <div className="mb-6 h-28 w-28 overflow-hidden rounded-full bg-zinc-800">
        <Image src="/else/angry_owl.png" alt="" width={112} height={112} className="h-full w-full object-cover" />
      </div>
      <h1 className="mb-2 text-xl font-bold">주소를 확인해 주세요부엉</h1>
      <p className="mb-6 text-sm text-zinc-400">찾는 화면이 없습니다. 입장 화면에서 방 코드와 닉네임으로 다시 들어오세요.</p>
      <Link
        href="/"
        data-testid="address-notice-home"
        className="inline-flex min-h-12 items-center justify-center rounded-full bg-amber-400 px-6 text-base font-bold text-zinc-950 hover:bg-amber-300"
      >
        입장 화면으로
      </Link>
    </div>
  );
}
