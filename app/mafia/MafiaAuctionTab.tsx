"use client";

import { useState } from "react";
import { usePlayerAuth } from "@/lib/hooks/usePlayerAuth";
import { ErrorMessage } from "@/components/ErrorMessage";

export function MafiaAuctionTab() {
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { player } = usePlayerAuth();

  const handleSubmit = async () => {
    if (!player?.nickname) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("양수를 입력해 주세요.");
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
          type: "bet",
          payload: { amount: value },
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: true;
        error?: string;
      } | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "베팅을 기록하지 못했습니다.");
      }
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "베팅을 기록하지 못했습니다.";
      setError(message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setAmount("");
  };

  return (
    <div className="space-y-3 text-sm text-zinc-100">
      {error && <ErrorMessage message={error} />}
      <p className="text-xs text-zinc-400">
        현재 라운드에 대한 경매 베팅 금액을 입력해 주세요.
      </p>
      <input
        className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm outline-none focus:border-zinc-400"
        placeholder="베팅 금액"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <button
        className="h-10 w-full rounded-full bg-amber-400 text-xs font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
        onClick={handleSubmit}
        disabled={submitting}
      >
        {submitting ? "제출 중..." : "베팅 제출"}
      </button>
    </div>
  );
}
