"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect } from "react";
import { useGameState } from "@/lib/hooks/useGameState";
import { LoadingScreen } from "@/components/LoadingScreen";

const CONTENT: Record<string, { title: string; body: string }> = {
  intro: {
    title: "인트로 안내",
    body: "The Owl Game 파일럿 프로그램의 전체 흐름과 기본 분위기를 설명하는 규칙입니다.",
  },
  subway: {
    title: "이상교통 8번출구",
    body: "실제 지하철역을 모티브로 한 탈출 퍼즐 게임입니다. 출구 번호와 장소를 잘 관찰해 주세요.",
  },
  hidden_piece: {
    title: "히든 피스",
    body: "인트로 화면 속 태양과 부엉이 날개에 숨겨진 비밀 규칙입니다.",
  },
  mafia: {
    title: "자본주의 마피아",
    body: "플레이어들이 자산과 주식을 두고 경쟁하는 마피아 보드게임 형식의 규칙입니다.",
  },
  quiz: {
    title: "부엉퀴즈쇼",
    body: "결승 진출자만 참여하는 퀴즈쇼의 기본 흐름과 찬스 사용 규칙입니다.",
  },
  quiz_questions: {
    title: "퀴즈 문제 안내",
    body: "실제 퀴즈 문항은 현장에서 공개되며, 이 규칙은 문제 형식과 진행 방식을 설명합니다.",
  },
};

export default function RuleDetailPage() {
  const router = useRouter();
  const params = useParams<{ ruleKey: string }>();
  const { ruleKey } = params;
  const { rulesMap, isLoading } = useGameState();

  useEffect(() => {
    if (!isLoading) {
      const isOpen = rulesMap[ruleKey];
      if (!isOpen) {
        router.replace("/locked");
      }
    }
  }, [isLoading, rulesMap, ruleKey, router]);

  if (isLoading) return <LoadingScreen />;

  const content = CONTENT[ruleKey] ?? {
    title: ruleKey,
    body: "이 규칙의 상세 설명은 아직 준비 중입니다.",
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-950 px-4 py-8 text-zinc-50">
      <header className="w-full max-w-md">
        <h1 className="text-lg font-semibold">{content.title}</h1>
        <p className="text-xs text-zinc-400">
          GM이 허용한 규칙만 열람할 수 있습니다.
        </p>
      </header>

      <main className="mt-6 flex w-full max-w-md flex-1 flex-col gap-4 text-sm leading-relaxed text-zinc-100">
        <p>{content.body}</p>
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
