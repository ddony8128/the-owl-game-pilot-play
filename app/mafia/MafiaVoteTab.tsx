"use client";

import { useState } from "react";
import { usePlayerAuth } from "@/lib/hooks/usePlayerAuth";
import { ErrorMessage } from "@/components/ErrorMessage";

export function MafiaVoteTab() {
  const [targetNickname, setTargetNickname] = useState("");
  const [count, setCount] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { player } = usePlayerAuth();

  const handleSubmit = async () => {
    if (!player?.nickname) return;
    const voteCount = Number(count);
    if (
      !targetNickname.trim() ||
      !Number.isFinite(voteCount) ||
      voteCount <= 0
    ) {
      setError("대상 닉네임과 표 수를 올바르게 입력해 주세요.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/mafia/vote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nickname: player.nickname,
          target_id: null,
          vote_count: voteCount,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: true;
        error?: string;
      } | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "투표를 기록하지 못했습니다.");
      }
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "투표를 기록하지 못했습니다.";
      setError(message);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setTargetNickname("");
  };

  return (
    <div className="space-y-3 text-sm text-zinc-100">
      {error && <ErrorMessage message={error} />}
      <p className="text-xs text-zinc-400">
        마피아로 의심되는 사람에게 표를 던지세요.
      </p>
      <input
        className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm outline-none focus:border-zinc-400"
        placeholder="대상 플레이어 닉네임"
        value={targetNickname}
        onChange={(e) => setTargetNickname(e.target.value)}
      />
      <input
        className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm outline-none focus:border-zinc-400"
        placeholder="표 수"
        value={count}
        onChange={(e) => setCount(e.target.value)}
      />
      <button
        className="h-10 w-full rounded-full bg-amber-400 text-xs font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
        onClick={handleSubmit}
        disabled={submitting}
      >
        {submitting ? "제출 중..." : "투표 제출"}
      </button>
    </div>
  );
}
