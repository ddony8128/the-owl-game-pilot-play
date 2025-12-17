"use client";

import { useState } from "react";
import type { Player } from "@/lib/types";
import { usePlayerAuth } from "@/lib/hooks/usePlayerAuth";
import { ErrorMessage } from "@/components/ErrorMessage";

type Props = {
  ticketPrice: number | null;
  playerCash: number | null;
  players: Player[];
  myVoteSummary: {
    target: string;
    vote_count: number;
    total_spent: number;
  }[];
};

export function MafiaVoteTab({
  ticketPrice,
  playerCash,
  players,
  myVoteSummary,
}: Props) {
  const { player } = usePlayerAuth();
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [count, setCount] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveTicketPrice =
    typeof ticketPrice === "number" && ticketPrice > 0 ? ticketPrice : 1;

  const handleSubmit = async () => {
    if (!player?.nickname) return;
    if (!selectedTarget) {
      setError("먼저 투표할 대상을 선택해 주세요.");
      return;
    }

    const voteCount = Number(count);
    if (!Number.isFinite(voteCount) || voteCount <= 0) {
      setError("표 수를 올바르게 입력해 주세요.");
      return;
    }

    const totalCost = voteCount * effectiveTicketPrice;
    if (playerCash != null && totalCost > playerCash) {
      setError("현금이 부족합니다. 표 수를 줄여 주세요.");
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
          target_id: selectedTarget,
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
    setCount("1");
  };

  const otherPlayers = players.filter(
    (p) => p.nickname && p.nickname !== player?.nickname
  );

  const currentTotalSpent = myVoteSummary?.reduce(
    (sum, v) => sum + v.total_spent,
    0
  );

  return (
    <div className="space-y-3 text-sm text-zinc-100">
      {error && <ErrorMessage message={error} />}

      <div className="rounded-lg bg-zinc-900 px-3 py-2 text-xs text-zinc-200">
        <p className="font-semibold text-amber-300">이번 라운드 투표 정보</p>
        <p className="mt-1">
          표 가격:{" "}
          <span className="font-semibold text-amber-300">
            {effectiveTicketPrice}원
          </span>
        </p>
        <p className="mt-1">
          내 현금:{" "}
          <span className="font-semibold">
            {playerCash != null ? `${playerCash}원` : "-"}
          </span>
        </p>
        {myVoteSummary && myVoteSummary.length > 0 ? (
          <div className="mt-2 space-y-1">
            <p className="text-[11px] text-zinc-400">
              이번 라운드 내 투표 현황
            </p>
            {myVoteSummary.map((v) => (
              <p key={v.target} className="text-[11px]">
                {v.target}에게 {v.vote_count}표 (총 {v.total_spent}원 사용)
              </p>
            ))}
            <p className="text-[11px] text-zinc-500">
              총 사용 금액: {currentTotalSpent}원
            </p>
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-zinc-500">
            아직 기록된 투표가 없습니다.
          </p>
        )}
      </div>

      <p className="mt-1 text-xs text-zinc-400">
        마피아로 의심되는 사람을 선택하고, 몇 표를 행사할지 정해 주세요.
      </p>

      <div className="space-y-2">
        <p className="text-[11px] text-zinc-400">플레이어 선택</p>
        <div className="grid grid-cols-2 gap-2">
          {otherPlayers.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedTarget(p.nickname)}
              className={`h-9 rounded-lg border text-xs ${
                selectedTarget === p.nickname
                  ? "border-amber-400 bg-amber-400/10 text-amber-300"
                  : "border-zinc-700 bg-zinc-900 text-zinc-100"
              }`}
            >
              {p.nickname}
            </button>
          ))}
          {otherPlayers.length === 0 && (
            <p className="col-span-2 text-[11px] text-zinc-500">
              다른 플레이어가 없습니다.
            </p>
          )}
        </div>
      </div>

      {selectedTarget && (
        <div className="space-y-2 rounded-lg bg-zinc-900 px-3 py-2 text-xs">
          <p className="font-semibold text-zinc-100">
            대상: <span className="text-amber-300">{selectedTarget}</span>
          </p>
          <label className="block space-y-1">
            <span className="text-[11px] text-zinc-400">표 수 입력</span>
            <input
              className="h-9 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-xs outline-none focus:border-zinc-400"
              placeholder="표 수"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              inputMode="numeric"
            />
          </label>
          <p className="text-[11px] text-zinc-400">
            예상 비용:{" "}
            <span className="font-semibold text-amber-300">
              {Number.isFinite(Number(count)) && Number(count) > 0
                ? Number(count) * effectiveTicketPrice
                : 0}
              원
            </span>
          </p>
          <button
            className="mt-2 h-9 w-full rounded-full bg-amber-400 text-[11px] font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
            onClick={handleSubmit}
            disabled={submitting}
            type="button"
          >
            {submitting ? "제출 중..." : "투표 제출"}
          </button>
        </div>
      )}
    </div>
  );
}
