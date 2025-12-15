"use client";

import { useRouter } from "next/navigation";
import { useGameState } from "@/lib/hooks/useGameState";
import { LoadingScreen } from "@/components/LoadingScreen";

const RULE_LABELS: Record<string, string> = {
  intro: "인트로 안내",
  subway: "이상교통 8번출구 규칙",
  hidden_piece: "히든 피스 힌트",
  mafia: "자본주의 마피아 규칙",
  quiz: "부엉퀴즈쇼 규칙",
  quiz_questions: "퀴즈 문제 안내",
};

export default function RulesPage() {
  const router = useRouter();
  const { rulesMap, isLoading } = useGameState();

  if (isLoading) return <LoadingScreen />;

  const visibleRules = Object.entries(rulesMap).filter(([, isOpen]) => isOpen);

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-950 px-4 py-8 text-zinc-50">
      <header className="w-full max-w-md">
        <h1 className="text-lg font-semibold">게임 규칙</h1>
        <p className="text-xs text-zinc-400">
          현재 공개된 규칙만 볼 수 있습니다.
        </p>
      </header>

      <main className="mt-6 flex w-full max-w-md flex-1 flex-col gap-3">
        {visibleRules.length === 0 && (
          <p className="mt-4 text-sm text-zinc-400">
            아직 공개된 규칙이 없습니다.
          </p>
        )}

        {visibleRules.map(([key]) => (
          <button
            key={key}
            className="h-11 w-full rounded-full border border-zinc-700 bg-zinc-900 text-left text-sm font-medium text-zinc-100 px-4 hover:bg-zinc-800"
            onClick={() => router.push(`/rules/${key}`)}
          >
            {RULE_LABELS[key] ?? key}
          </button>
        ))}

        <button
          className="mt-auto h-10 rounded-full border border-zinc-700 text-sm text-zinc-200 hover:bg-zinc-900"
          onClick={() => router.back()}
        >
          이전으로
        </button>
      </main>
    </div>
  );
}
