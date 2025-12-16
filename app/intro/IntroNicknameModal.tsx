import type { Dispatch, SetStateAction } from "react";

type Props = {
  open: boolean;
  inputNickname: string;
  setInputNickname: Dispatch<SetStateAction<string>>;
  nicknameError: string | null;
  checkingNickname: boolean;
  onSubmit: () => void;
};

export function IntroNicknameModal({
  open,
  inputNickname,
  setInputNickname,
  nicknameError,
  checkingNickname,
  onSubmit,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-sm rounded-2xl bg-zinc-950 p-6 text-zinc-50 shadow-xl">
        <h2 className="mb-2 text-lg font-semibold">닉네임 확인</h2>
        <p className="mb-4 text-xs text-zinc-300">
          미리 등록된 닉네임만 입장할 수 있습니다.
        </p>
        <input
          className="mb-2 h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm outline-none focus:border-zinc-400"
          placeholder="닉네임을 입력하세요"
          value={inputNickname}
          onChange={(e) => setInputNickname(e.target.value)}
        />
        {nicknameError && (
          <p className="mb-2 text-xs text-red-400">{nicknameError}</p>
        )}
        <button
          className="mt-2 h-10 w-full rounded-lg bg-amber-400 text-sm font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
          onClick={onSubmit}
          disabled={checkingNickname}
        >
          {checkingNickname ? "확인 중..." : "입장하기"}
        </button>
      </div>
    </div>
  );
}
