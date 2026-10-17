"use client";

import { useRouter } from "next/navigation";
import { RULESHEET_PDF } from "@/components/PhoneNotices";

// /rules — 두 게임 룰지(PDF)를 항상 보여 준다. 예전의 rules_state 공개 토글은 GM UI 가 없어 영원히
// "공개된 규칙 없음"으로 남았으므로(gap-analysis 10) 토글 없이 단순화했다(Iteration 5 WS-B 3).
const RULESHEETS: { key: keyof typeof RULESHEET_PDF; label: string; note: string }[] = [
  { key: "defense", label: "디펜스 딜레마 룰지", note: "2026-10-16 v8 · 코드와 대조 완료" },
  { key: "mafia", label: "자본주의 마피아 룰지", note: "2026-10-14 v8 · 코드와 대조 완료" },
];

export default function RulesPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-950 px-4 py-8 text-zinc-50">
      <header className="w-full max-w-md">
        <h1 className="text-xl font-semibold">규칙 / 안내</h1>
        <p className="text-sm text-zinc-400">
          헷갈릴 땐 꼼꼼히 보도록 해 부엉! 그래도 모르겠으면 물어봐 부엉!
        </p>
      </header>

      <main className="mt-6 flex w-full max-w-md flex-1 flex-col gap-3">
        {RULESHEETS.map((r) => (
          <a
            key={r.key}
            href={RULESHEET_PDF[r.key]}
            target="_blank"
            rel="noopener noreferrer"
            data-testid={`rules-${r.key}`}
            aria-label={`${r.label} PDF 열기(새 탭)`}
            className="flex min-h-12 w-full flex-col justify-center rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-left hover:bg-zinc-800"
          >
            <span className="text-base font-medium text-zinc-100">{r.label} ↗</span>
            <span className="text-xs text-zinc-500">{r.note}</span>
          </a>
        ))}

        <p className="text-xs text-zinc-500">
          PDF 가 새 탭에서 열립니다. 게임 화면의 규칙 탭 맨 아래에도 같은 링크가 있습니다.
        </p>

        <button
          type="button"
          aria-label="메인 화면으로"
          className="mt-auto min-h-12 rounded-full border border-zinc-700 text-base text-zinc-200 hover:bg-zinc-900"
          onClick={() => router.push("/")}
        >
          메인 화면으로
        </button>
      </main>
    </div>
  );
}
