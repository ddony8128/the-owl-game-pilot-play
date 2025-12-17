"use client";

import { useState } from "react";
import { usePlayerAuth } from "@/lib/hooks/usePlayerAuth";
import { ErrorMessage } from "@/components/ErrorMessage";

export function MafiaTradeTab() {
  const [type, setType] = useState<"buy" | "sell">("buy");
  const [stockKey, setStockKey] = useState("");
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { player } = usePlayerAuth();

  const handleSubmit = async () => {
    if (!player?.nickname) return;
    const amount = Number(value);
    if (!stockKey || !Number.isFinite(amount) || amount <= 0) {
      setError("종목과 양수를 모두 입력해 주세요.");
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
          type,
          payload: { stock_key: stockKey, amount },
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: true;
        error?: string;
      } | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "거래를 기록하지 못했습니다.");
      }
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "거래를 기록하지 못했습니다.";
      setError(message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setValue("");
  };

  return (
    <div className="space-y-3 text-sm text-zinc-100">
      {error && <ErrorMessage message={error} />}
      <p className="text-xs text-zinc-400">
        거래할 종목과 수량을 입력해 주세요.
      </p>
      <div className="flex gap-2">
        <select
          className="h-10 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-xs outline-none focus:border-zinc-400"
          value={type}
          onChange={(e) => setType(e.target.value as "buy" | "sell")}
        >
          <option value="buy">매수</option>
          <option value="sell">매도</option>
        </select>
        <input
          className="h-10 flex-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm outline-none focus:border-zinc-400"
          placeholder="종목 키 (예: bond)"
          value={stockKey}
          onChange={(e) => setStockKey(e.target.value)}
        />
      </div>
      <input
        className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm outline-none focus:border-zinc-400"
        placeholder="수량"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button
        className="h-10 w-full rounded-full bg-amber-400 text-xs font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
        onClick={handleSubmit}
        disabled={submitting}
      >
        {submitting ? "제출 중..." : "거래 제출"}
      </button>
    </div>
  );
}
