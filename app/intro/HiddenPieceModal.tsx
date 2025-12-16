"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type Props = {
  open: boolean;
  onClose: () => void;
  onResetIntro: () => void;
};

export function HiddenPieceModal({ open, onClose, onResetIntro }: Props) {
  const [step, setStep] = useState<"images" | "input" | "result">("images");
  const [index, setIndex] = useState(0);
  const [code, setCode] = useState("");
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let intervalId: ReturnType<typeof setInterval> | undefined;

    const timeoutId = setTimeout(() => {
      // 초기 상태 리셋 및 이미지 시퀀스 시작
      setStep("images");
      setIndex(0);
      setCode("");
      setIsCorrect(null);
      setResultMessage(null);

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

  const handleSubmit = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;

    try {
      const res = await fetch("/api/hidden-piece", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: trimmed }),
      });

      if (!res.ok) {
        setIsCorrect(false);
        setStep("result");
        onResetIntro();
        return;
      }

      const data = (await res.json().catch(() => null)) as {
        correct?: boolean;
        message?: string;
      } | null;

      if (data?.correct) {
        setIsCorrect(true);
        setResultMessage(data.message ?? null);
        setStep("result");
      } else {
        setIsCorrect(false);
        setStep("result");
        onResetIntro();
      }
    } catch {
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
            {/** 부엉이 5마리를 3개 / 2개 두 줄로 배치 */}
            <div className="flex flex-col items-center gap-3">
              <div className="flex gap-3">
                {Array.from({ length: 5 })
                  .slice(0, 3)
                  .map((_, i) => (
                    <Image
                      key={i}
                      src={`/hidden/vari_owl_${i + 1}.png`}
                      alt={`지나가는 부엉이 ${i + 1}`}
                      width={64}
                      height={64}
                      className={`h-22 w-22 rounded-full transition-opacity ${
                        i <= index ? "opacity-100" : "opacity-20"
                      }`}
                    />
                  ))}
              </div>
              <div className="flex gap-3">
                {Array.from({ length: 5 })
                  .slice(3)
                  .map((_, offset) => {
                    const i = offset + 3;
                    return (
                      <Image
                        key={i}
                        src={`/hidden/vari_owl_${i + 1}.png`}
                        alt={`지나가는 부엉이 ${i + 1}`}
                        width={64}
                        height={64}
                        className={`h-22 w-22 rounded-full transition-opacity ${
                          i <= index ? "opacity-100" : "opacity-20"
                        }`}
                      />
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {step === "input" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-zinc-200">번호를 입력해 주세요.</p>
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
                <p className="whitespace-pre-line text-sm text-zinc-200">
                  {resultMessage ??
                    "게임 마스터에게 가서 다음 주문을 외치세요.\n'빛나는 눈의 지혜를 찬미하부엉!\n그 편린의 깃털을 하사해주시부엉!'"}
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
                <p className="text-sm text-zinc-200">다시 도전해 보세요.</p>
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
