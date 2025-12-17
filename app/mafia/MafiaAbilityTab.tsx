"use client";

import { useState } from "react";
import { usePlayerAuth } from "@/lib/hooks/usePlayerAuth";
import { ErrorMessage } from "@/components/ErrorMessage";

type Props = {
  job: string | null;
};

export function MafiaAbilityTab({ job }: Props) {
  const [target, setTarget] = useState("");
  const [desc, setDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { player } = usePlayerAuth();

  const handleSubmit = async () => {
    if (!player?.nickname) return;
    if (!desc.trim()) {
      setError("능력 사용 내용을 입력해 주세요.");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/mafia/action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nickname: player.nickname,
          type: "ability",
          payload: {
            target: target.trim() || null,
            description: desc.trim(),
          },
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
    setDesc("");
  };

  return (
    <div className="space-y-3 text-sm text-zinc-100">
      {error && <ErrorMessage message={error} />}
      {job ? (
        <p className="text-xs text-zinc-400">
          현재 직업: <span className="font-semibold text-zinc-100">{job}</span>
          <br />이 직업의 능력을 사용할 대상(선택)과 내용을 적어 주세요. 최종
          해석은 GM이 진행합니다.
        </p>
      ) : (
        <p className="text-xs text-zinc-400">
          현재 직업 정보가 없습니다. GM에게 직업을 확인한 뒤 능력 사용 내용을
          적어 주세요.
        </p>
      )}
      <input
        className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm outline-none focus:border-zinc-400"
        placeholder="대상 플레이어 닉네임 (선택)"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
      />
      <textarea
        className="h-24 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-sm outline-none focus:border-zinc-400"
        placeholder="능력 사용 내용을 적어 주세요."
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
      />
      <button
        className="h-10 w-full rounded-full bg-amber-400 text-xs font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
        onClick={handleSubmit}
        disabled={submitting}
      >
        {submitting ? "제출 중..." : "능력 사용 제출"}
      </button>
    </div>
  );
}
