import type { SubwayRuleClient } from "./SubwayClient";

type Props = {
  isOpen: boolean;
  rules: SubwayRuleClient[];
  onClose: () => void;
};

export function SubwayGuideModal({ isOpen, rules, onClose }: Props) {
  if (!isOpen) return null;

  const rule0 = rules.find((r) => r.id === 0) ?? null;
  const rule8 = rules.find((r) => r.id === 8) ?? null;
  const middleRules = rules
    .filter((r) => r.id >= 1 && r.id <= 7)
    .sort((a, b) => a.id - b.id);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-md rounded-2xl bg-zinc-950 p-5 text-left text-zinc-50 shadow-xl">
        <h2 className="mb-3 text-lg font-semibold">안내문</h2>
        <div className="max-h-[60vh] space-y-4 px-4 overflow-y-auto text-sm leading-relaxed">
          {rule0 && (
            <div>
              <p className="mb-1 text-base font-semibold">{rule0.title}</p>
              <p className="whitespace-pre-line text-sm text-zinc-200">
                {rule0.body}
              </p>
            </div>
          )}

          {middleRules.map((r) => (
            <div key={r.id}>
              <p className="mb-1 text-base font-semibold">{r.title}</p>
              <p className="whitespace-pre-line text-sm text-zinc-200">
                {r.body}
              </p>
              <p className="mt-1 text-sm text-zinc-400">
                공개 조건: {r.conditionDescription}
              </p>
            </div>
          ))}

          {rule8 && (
            <div>
              <p className="mb-1 text-base font-semibold">{rule8.title}</p>
              <p className="whitespace-pre-line text-sm text-zinc-200">
                {rule8.body}
              </p>
            </div>
          )}
        </div>
        <button
          className="mt-4 h-9 w-full rounded-full bg-zinc-100 text-sm font-semibold text-zinc-900 hover:bg-white"
          onClick={onClose}
        >
          닫기
        </button>
      </div>
    </div>
  );
}
