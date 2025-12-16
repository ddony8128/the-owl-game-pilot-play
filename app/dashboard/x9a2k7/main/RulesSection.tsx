import type { RulesState } from "@/lib/types";

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
            <span>{r.rule_key}</span>
          </label>
        ))}
        {rules.length === 0 && (
          <p className="text-zinc-400">rules_state에 데이터가 없습니다.</p>
        )}
      </div>
    </section>
  );
}
