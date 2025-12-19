"use client";

import { useRouter } from "next/navigation";
import { useGameState } from "@/lib/hooks/useGameState";
import { LoadingScreen } from "@/components/LoadingScreen";

const RULE_LABELS: Record<string, string> = {
  intro: "게임 전체 안내",
  subway: "이상교통 8번출구",
  hidden_piece: "히든 피스",
  mafia: "자본주의 마피아",
  quiz: "부엉퀴즈쇼",
  quiz_questions: "퀴즈 문제",
};

export default function RulesPage() {
  const router = useRouter();
  const { rulesMap, isLoading } = useGameState();

  if (isLoading) return <LoadingScreen />;

  const visibleRules = Object.entries(rulesMap).filter(([, isOpen]) => isOpen);

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-950 px-4 py-8 text-zinc-50">
      <header className="w-full max-w-md">
        <h1 className="text-xl font-semibold">규칙 / 안내</h1>
        <p className="text-sm text-zinc-400">
          헷갈릴 땐 꼼꼼히 보도록 해 부엉! 그래도 모르겠으면 물어봐 부엉!
        </p>
      </header>

      <main className="mt-6 flex w-full max-w-md flex-1 flex-col gap-3">
        {visibleRules.length === 0 && (
          <p className="mt-4 text-sm text-zinc-400">
            아직 공개된 규칙이 없습니다.
          </p>
        )}

        {visibleRules.map(([key]) => {
          const label = RULE_LABELS[key] ?? key;

          const handleClick = () => {
            if (key === "quiz_questions") {
              router.push("/rules/quiz-questions");
              return;
            }

            const pdfMap: Record<string, string> = {
              intro: "/rulebook/avsmvlkdmv_intro.pdf",
              hidden_piece: "/rulebook/1491j0rjflcelfe_hidden.pdf",
              subway: "/rulebook/13fsm4wg_subway.pdf",
              mafia: "/rulebook/1141rfwkvm_mafia.pdf",
              quiz: "/rulebook/1rqvskldm_quizshow.pdf",
            };

            const url = pdfMap[key];
            if (url) {
              window.open(url, "_blank");
            }
          };

          return (
            <button
              key={key}
              className="h-12 w-full rounded-full border border-zinc-700 bg-zinc-900 px-4 text-left text-base font-medium text-zinc-100 hover:bg-zinc-800"
              onClick={handleClick}
            >
              {label}
            </button>
          );
        })}

        <button
          className="mt-auto h-12 rounded-full border border-zinc-700 text-base text-zinc-200 hover:bg-zinc-900"
          onClick={() => router.push("/intro")}
        >
          메인 화면으로
        </button>
      </main>
    </div>
  );
}
