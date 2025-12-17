import type { RulesState } from "@/lib/types";

const RULE_LABELS: Record<string, string> = {
  intro: "인트로 안내",
  subway: "이상교통 8번출구 규칙",
  hidden_piece: "히든 피스 힌트",
  mafia: "자본주의 마피아 규칙",
  quiz: "부엉퀴즈쇼 규칙",
  quiz_questions: "퀴즈 문제 안내",
};

type Props = {
  rules: RulesState[];
  onToggleRule: (ruleKey: string, isOpen: boolean) => void;
};

export function RulesSection({ rules, onToggleRule }: Props) {
  return (
    <section>
      <h2 className="mb-2 text-base font-semibold">규칙 공개 상태</h2>
      <div className="space-y-1 text-xs">
        {rules.map((r) => (
          <label key={r.rule_key} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={r.is_open}
              onChange={() => onToggleRule(r.rule_key, r.is_open)}
            />
            <span>{RULE_LABELS[r.rule_key] ?? r.rule_key}</span>
          </label>
        ))}
        {rules.length === 0 && (
          <p className="text-zinc-400">rules_state에 데이터가 없습니다.</p>
        )}
      </div>
    </section>
  );
}
