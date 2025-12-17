"use client";

import { useState } from "react";
import { usePlayerAuth } from "@/lib/hooks/usePlayerAuth";
import { ErrorMessage } from "@/components/ErrorMessage";
import type { MafiaAbilityPayload } from "@/lib/mafia/abilities";

type Props = {
  job: string | null;
};

export function MafiaAbilityTab({ job }: Props) {
  const { player } = usePlayerAuth();
  const [stockKey, setStockKey] = useState("");
  const [target1, setTarget1] = useState("");
  const [target2, setTarget2] = useState("");
  const [policeTarget, setPoliceTarget] = useState("");
  const [taxTarget, setTaxTarget] = useState("");
  const [mayorPrice, setMayorPrice] = useState<1 | 2 | 3 | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedJob = job ?? null;

  const buildPayload = (): MafiaAbilityPayload | null => {
    if (!normalizedJob) return null;

    switch (normalizedJob) {
      case "up_manipulator":
      case "down_manipulator":
      case "broker": {
        const key = stockKey.trim();
        if (!key) {
          setError("대상 주식 코드를 입력해 주세요. (국채 제외)");
          return null;
        }
        return { job: normalizedJob, stock_key: key } as MafiaAbilityPayload;
      }
      case "robber": {
        const t1 = target1.trim();
        const t2 = target2.trim();
        if (!t1 || !t2 || t1 === t2) {
          setError("서로 다른 두 명의 대상을 입력해 주세요.");
          return null;
        }
        return { job: "robber", targets: [t1, t2] };
      }
      case "police": {
        const t = policeTarget.trim();
        return { job: "police", target: t || null };
      }
      case "tax_auditor": {
        const t = taxTarget.trim();
        if (!t) {
          setError("세무조사 대상을 입력해 주세요.");
          return null;
        }
        return { job: "tax_auditor", target: t };
      }
      case "mayor": {
        if (!mayorPrice) {
          setError("표 가격을 1~3원 중에서 선택해 주세요.");
          return null;
        }
        return { job: "mayor", ticket_price: mayorPrice };
      }
      case "ceo":
        return { job: "ceo" };
      case "salaryman":
        return { job: "salaryman" };
      default:
        // 알 수 없는 직업은 서버에서 무시하도록 간단히 처리
        return null;
    }
  };

  const handleSubmit = async () => {
    if (!player?.nickname || !normalizedJob) return;

    setSubmitting(true);
    setError(null);

    const payload = buildPayload();
    if (!payload) {
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/mafia/action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nickname: player.nickname,
          type: "ability",
          payload,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: true;
        error?: string;
      } | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "능력 사용을 기록하지 못했습니다.");
      }
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "능력 사용을 기록하지 못했습니다.";
      setError(message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
  };

  if (!normalizedJob) {
    return (
      <div className="space-y-3 text-sm text-zinc-100">
        <p className="text-xs text-zinc-400">
          현재 직업 정보가 없습니다. GM에게 직업을 확인한 뒤 능력 사용 내용을
          적어 주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm text-zinc-100">
      {error && <ErrorMessage message={error} />}
      <p className="text-xs text-zinc-400">
        현재 직업: <span className="font-semibold text-zinc-100">{job}</span>
      </p>

      {(normalizedJob === "up_manipulator" ||
        normalizedJob === "down_manipulator" ||
        normalizedJob === "broker") && (
        <>
          <p className="text-xs text-zinc-400">
            국채를 제외한 대상 주식 코드를 입력해 주세요.
          </p>
          <input
            className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm outline-none focus:border-zinc-400"
            placeholder="예: beonjjeok, subway, owl_edu 등"
            value={stockKey}
            onChange={(e) => setStockKey(e.target.value)}
          />
        </>
      )}

      {normalizedJob === "robber" && (
        <>
          <p className="text-xs text-zinc-400">
            강도의 피해를 줄 서로 다른 두 명의 닉네임을 입력해 주세요.
          </p>
          <input
            className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm outline-none focus:border-zinc-400"
            placeholder="대상 1 닉네임"
            value={target1}
            onChange={(e) => setTarget1(e.target.value)}
          />
          <input
            className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm outline-none focus:border-zinc-400"
            placeholder="대상 2 닉네임"
            value={target2}
            onChange={(e) => setTarget2(e.target.value)}
          />
        </>
      )}

      {normalizedJob === "police" && (
        <>
          <p className="text-xs text-zinc-400">
            조사할 닉네임을 입력해 주세요. 비워 두면 이번 라운드에는 조사하지
            않습니다.
          </p>
          <input
            className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm outline-none focus:border-zinc-400"
            placeholder="조사 대상 닉네임 (선택)"
            value={policeTarget}
            onChange={(e) => setPoliceTarget(e.target.value)}
          />
        </>
      )}

      {normalizedJob === "tax_auditor" && (
        <>
          <p className="text-xs text-zinc-400">
            세무조사를 진행할 닉네임을 입력해 주세요.
          </p>
          <input
            className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm outline-none focus:border-zinc-400"
            placeholder="세무조사 대상 닉네임"
            value={taxTarget}
            onChange={(e) => setTaxTarget(e.target.value)}
          />
        </>
      )}

      {normalizedJob === "mayor" && (
        <>
          <p className="text-xs text-zinc-400">
            이번 라운드 표 가격을 선택해 주세요. (1~3원)
          </p>
          <div className="flex gap-2">
            {[1, 2, 3].map((p) => (
              <button
                key={p}
                type="button"
                className={`h-8 flex-1 rounded-full border text-xs font-semibold ${
                  mayorPrice === p
                    ? "border-amber-400 bg-amber-400 text-zinc-950"
                    : "border-zinc-600 bg-zinc-900 text-zinc-100"
                }`}
                onClick={() => setMayorPrice(p as 1 | 2 | 3)}
              >
                {p}원
              </button>
            ))}
          </div>
        </>
      )}

      {(normalizedJob === "ceo" || normalizedJob === "salaryman") && (
        <p className="text-xs text-zinc-400">
          이 직업은 별도의 대상 선택 없이 자동으로 능력이 적용됩니다. 아래
          버튼을 눌러 능력 사용을 확정해 주세요.
        </p>
      )}

      <button
        className="h-10 w-full rounded-full bg-amber-400 text-xs font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
        onClick={handleSubmit}
        disabled={submitting || !normalizedJob}
      >
        {submitting ? "제출 중..." : "능력 사용 제출"}
      </button>
    </div>
  );
}
