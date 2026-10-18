"use client";

import { useMemo, useState } from "react";
import type { Player } from "@/lib/types";
import { ErrorMessage } from "@/components/ErrorMessage";
import { describeSubmitFailure } from "@/components/PhoneNotices";
import { newRequestId } from "@/lib/requestId";

type Props = {
  // 인증은 상위(MafiaInner)에서 한 번만 확인하고 내려준다 — 탭마다 재확인하면 직후 제출이 버려진다.
  player: Pick<Player, "nickname">;
  roomCode: string;
  ticketPrice: number | null;
  playerCash: number | null;
  players: Player[];
  myVoteSummary: {
    target: string;
    vote_count: number;
    total_spent: number;
  }[];
  roomEnded?: boolean;
  onSubmitted?: () => Promise<void> | void;
};

export function MafiaVoteTab({
  player,
  roomCode,
  ticketPrice,
  playerCash,
  players,
  myVoteSummary,
  roomEnded = false,
  onSubmitted,
}: Props) {
  // 선택된 대상은 players.id (uuid)를 들고 있고,
  // 화면에는 nickname을 표시한다.
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [count, setCount] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveTicketPrice =
    typeof ticketPrice === "number" && ticketPrice > 0 ? ticketPrice : 1;

  const handleSubmit = async () => {
    if (!player?.nickname || !roomCode) return;
    if (!selectedTarget) {
      setError("먼저 투표할 대상을 선택해 주세요.");
      return;
    }

    const voteCount = Number(count);
    if (!Number.isInteger(voteCount) || voteCount <= 0) {
      setError("표 수는 1 이상의 정수로 입력해 주세요.");
      return;
    }

    const totalCost = voteCount * effectiveTicketPrice;
    if (playerCash != null && totalCost > playerCash) {
      setError("현금이 부족합니다. 표 수를 줄여 주세요.");
      return;
    }

    if (submitting) return;
    setSubmitting(true);
    setError(null);

    // 제출 1건 = requestId 1개(응답 유실 재전송 멱등)
    const request_id = newRequestId();
    let status: number | null = null;
    try {
      const res = await fetch("/api/mafia/vote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(12000),
        body: JSON.stringify({
          room: roomCode,
          nickname: player.nickname,
          target_id: selectedTarget,
          vote_count: voteCount,
          request_id,
        }),
      });
      status = res.status;
      const json = (await res.json().catch(() => null)) as {
        ok?: true;
        error?: string;
        reason?: string;
      } | null;
      if (!res.ok || !json?.ok) {
        throw new Error(describeSubmitFailure(status, json, "투표를 기록하지 못했습니다."));
      }
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "투표를 기록하지 못했습니다.";
      setError(status === null ? describeSubmitFailure(null, null, message) : message);
      setSubmitting(false);
      return;
    }

    await onSubmitted?.();
    setSubmitting(false);
    setSelectedTarget(null);
    setCount("1");
  };

  const myNickname = player?.nickname ?? null;

  // 내 닉네임을 아직 모를 때는 선택지를 아예 비워 두고,
  // 닉네임이 준비된 뒤에만 "나를 제외한 다른 플레이어들"을 노출한다.
  const otherPlayers = useMemo(() => {
    if (!myNickname) return [];
    return players.filter((p) => p.nickname && p.nickname !== myNickname);
  }, [players, myNickname]);

  const currentTotalSpent = myVoteSummary?.reduce(
    (sum, v) => sum + v.total_spent,
    0
  );

  return (
    <div className="space-y-3 text-sm text-zinc-100">
      {error && <ErrorMessage message={error} />}

      <div className="rounded-lg bg-zinc-900 px-3 py-2 text-base text-zinc-200">
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
            <p className="text-base text-zinc-400">이번 라운드 내 투표 현황</p>
            {myVoteSummary.map((v) => (
              <p key={v.target} className="text-base">
                {v.target}에게 {v.vote_count}표 (총 {v.total_spent}원 사용)
              </p>
            ))}
            <p className="text-base text-zinc-500">
              총 사용 금액: {currentTotalSpent}원
            </p>
          </div>
        ) : (
          <p className="mt-2 text-base text-zinc-500">
            아직 투표를 하지 않았습니다.
          </p>
        )}
      </div>

      {roomEnded && (
        <p className="rounded-lg bg-zinc-900 px-3 py-2 text-sm text-zinc-400">종료된 방입니다. 투표할 수 없습니다.</p>
      )}

      {!roomEnded && (
      <>
      <p className="mt-1 text-base text-zinc-400">
        마피아로 의심되는 사람을 선택하고, 몇 표를 행사할지 정해 주세요. <br />{" "}
        (여러 번 투표 가능합니다.)
      </p>

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {otherPlayers.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-label={`${p.nickname}에게 투표 대상 선택`}
              aria-pressed={selectedTarget === p.id}
              data-testid={`vote-target-${p.nickname}`}
              onClick={() => setSelectedTarget(p.id)}
              className={`user-text min-h-11 rounded-lg border px-2 text-sm ${
                selectedTarget === p.id
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
        <div className="space-y-2 rounded-lg bg-zinc-900 px-3 py-2 text-sm">
          <p className="font-semibold text-zinc-100">
            대상:{" "}
            <span className="text-amber-300">
              {otherPlayers.find((p) => p.id === selectedTarget)?.nickname ??
                "선택된 플레이어"}
            </span>
          </p>
          <label className="block space-y-1">
            <span className="text-base text-zinc-400">표 수 입력</span>
            <input
              className="h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm outline-none focus:border-zinc-400"
              placeholder="표 수"
              aria-label="표 수"
              data-testid="vote-count"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              inputMode="numeric"
            />
          </label>
          <p className="text-sm text-zinc-400">
            예상 비용:{" "}
            <span className="font-semibold text-amber-300">
              {Number.isFinite(Number(count)) && Number(count) > 0
                ? Number(count) * effectiveTicketPrice
                : 0}
              원
            </span>
          </p>
          <button
            className="mt-2 h-12 w-full rounded-full bg-amber-400 text-base font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
            onClick={handleSubmit}
            disabled={submitting}
            type="button"
            aria-label="투표 제출"
            data-testid="vote-submit"
          >
            {submitting ? "제출 중..." : "투표 제출"}
          </button>
        </div>
      )}
      </>
      )}
    </div>
  );
}
