"use client";

import { useEffect, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onResetIntro: () => void;
};

const ANSWER_CODE = "OWL-SECRET"; // 임시 정답 코드

export function HiddenPieceModal({ open, onClose, onResetIntro }: Props) {
  const [step, setStep] = useState<"images" | "input" | "result">("images");
  const [index, setIndex] = useState(0);
  const [code, setCode] = useState("");
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  useEffect(() => {
    if (!open) return;

    let intervalId: ReturnType<typeof setInterval> | undefined;

    const timeoutId = setTimeout(() => {
      // 초기 상태 리셋 및 이미지 시퀀스 시작
      setStep("images");
      setIndex(0);
      setCode("");
      setIsCorrect(null);

      intervalId = setInterval(() => {
        setIndex((prev) => {
          if (prev >= 4) {
            if (intervalId) {
              clearInterval(intervalId);
            }
            setStep("input");
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [open]);

  if (!open) return null;

  const handleSubmit = () => {
    if (code.trim() === ANSWER_CODE) {
      setIsCorrect(true);
      setStep("result");
    } else {
      setIsCorrect(false);
      setStep("result");
      onResetIntro();
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-sm rounded-2xl bg-zinc-950 p-6 text-zinc-50 shadow-xl">
        {step === "images" && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-zinc-300">
              부엉이를 잘 지켜봐 주세요...
            </p>
            <div className="flex gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-12 w-12 rounded-full bg-zinc-800 transition-opacity ${
                    i <= index ? "opacity-100" : "opacity-20"
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {step === "input" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-zinc-200">
              힌트를 모두 보았습니다. 번호를 입력해 주세요.
            </p>
            <textarea
              className="h-24 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-sm outline-none focus:border-zinc-400"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button
              className="h-10 rounded-lg bg-amber-400 text-sm font-semibold text-zinc-950 hover:bg-amber-300"
              onClick={handleSubmit}
            >
              제출하기
            </button>
          </div>
        )}

        {step === "result" && (
          <div className="flex flex-col gap-4">
            {isCorrect ? (
              <>
                <p className="text-base font-semibold text-emerald-300">
                  정답입니다!
                </p>
                <p className="text-sm text-zinc-200">
                  지금 바로 GM에게 이렇게 외쳐 주세요: <br />
                  <span className="mt-2 inline-block rounded bg-zinc-800 px-2 py-1 text-xs font-bold text-amber-300">
                    &quot;부엉이는 모든 것을 보고 있다!&quot;
                  </span>
                </p>
                <button
                  className="h-10 rounded-lg bg-zinc-100 text-sm font-semibold text-zinc-900 hover:bg-white"
                  onClick={handleClose}
                >
                  닫기
                </button>
              </>
            ) : (
              <>
                <p className="text-base font-semibold text-red-300">
                  틀렸습니다.
                </p>
                <p className="text-sm text-zinc-200">
                  인트로 화면이 리셋되었습니다. 다시 도전해 보세요.
                </p>
                <button
                  className="h-10 rounded-lg bg-zinc-100 text-sm font-semibold text-zinc-900 hover:bg-white"
                  onClick={handleClose}
                >
                  돌아가기
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
