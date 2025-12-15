"use client";

import { useEffect, useMemo, useState } from "react";
import type { Player } from "@/lib/types";
import { usePlayerAuth } from "@/lib/hooks/usePlayerAuth";
import { PageGuard } from "@/components/PageGuard";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ErrorMessage } from "@/components/ErrorMessage";

const STORAGE_KEY = "owlgame:vote-submitted";

export default function VotePage() {
  return (
    <PageGuard requireLogin allowGames={["vote"]}>
      <VoteInner />
    </PageGuard>
  );
}

function VoteInner() {
  const { player } = usePlayerAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const [set1A, setSet1A] = useState<string>("");
  const [set1B, setSet1B] = useState<string>("");
  const [set2A, setSet2A] = useState<string>("");
  const [set2B, setSet2B] = useState<string>("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const flag = localStorage.getItem(STORAGE_KEY);
      if (flag === "1") {
        setSubmitted(true);
      }
    }
  }, []);

  useEffect(() => {
    if (!player || submitted) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/vote/players");
        const json = (await res.json().catch(() => null)) as
          | { players: Player[]; error?: undefined }
          | { error: string }
          | null;
        if (!res.ok || !json || "error" in json) {
          throw new Error(
            (json as { error?: string })?.error ??
              "플레이어 목록을 불러오지 못했습니다."
          );
        }
        if (cancelled) return;
        setPlayers(json.players ?? []);
        setError(null);
      } catch (e: unknown) {
        if (!cancelled) {
          const message =
            e instanceof Error
              ? e.message
              : "플레이어 목록을 불러오지 못했습니다.";
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [player, submitted]);

  const selectablePlayers = useMemo(
    () => players.filter((p) => p.id !== player?.id),
    [players, player?.id]
  );

  const handleSubmit = async () => {
    if (!player?.nickname) return;
    if (reason.trim().length < 5) {
      setError("이유를 5글자 이상 입력해 주세요.");
      return;
    }
    if (!set1A || !set1B || !set2A || !set2B) {
      setError("두 세트 모두 플레이어 2명을 선택해 주세요.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nickname: player.nickname,
          set1A,
          set1B,
          set2A,
          set2B,
          reason,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: true;
        error?: string;
      } | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "제출 중 오류가 발생했습니다.");
      }

      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, "1");
      }
      setSubmitted(true);
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "제출 중 오류가 발생했습니다.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingScreen />;
  if (!player) return <LoadingScreen />;

  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-center text-zinc-50">
        <h1 className="mb-2 text-lg font-semibold">투표가 완료되었습니다</h1>
        <p className="max-w-xs text-sm text-zinc-400">
          다시 접속해도 이 화면만 보입니다.
          <br />
          GM의 안내를 기다려 주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-950 px-4 py-8 text-zinc-50">
      <header className="w-full max-w-md text-center">
        <h1 className="text-lg font-semibold">부엉이 투표</h1>
        <p className="mt-1 text-xs text-zinc-400">
          플레이어 2명씩 두 세트를 선택하고, 그 이유를 적어 주세요.
        </p>
      </header>

      <main className="mt-6 flex w-full max-w-md flex-1 flex-col gap-4 text-sm">
        {error && <ErrorMessage message={error} />}

        <section className="rounded-xl bg-zinc-900 p-3">
          <h2 className="mb-2 text-xs font-semibold text-zinc-300">1세트</h2>
          <div className="flex gap-2">
            <SelectPlayer
              value={set1A}
              onChange={setSet1A}
              players={selectablePlayers}
              placeholder="플레이어 1"
            />
            <SelectPlayer
              value={set1B}
              onChange={setSet1B}
              players={selectablePlayers}
              placeholder="플레이어 2"
            />
          </div>
        </section>

        <section className="rounded-xl bg-zinc-900 p-3">
          <h2 className="mb-2 text-xs font-semibold text-zinc-300">2세트</h2>
          <div className="flex gap-2">
            <SelectPlayer
              value={set2A}
              onChange={setSet2A}
              players={selectablePlayers}
              placeholder="플레이어 3"
            />
            <SelectPlayer
              value={set2B}
              onChange={setSet2B}
              players={selectablePlayers}
              placeholder="플레이어 4"
            />
          </div>
        </section>

        <section className="flex flex-1 flex-col gap-2">
          <label className="text-xs text-zinc-300">
            왜 그렇게 선택했는지 이유를 적어 주세요.
          </label>
          <textarea
            className="h-32 w-full flex-1 rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-sm outline-none focus:border-zinc-400"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </section>

        <button
          className="mt-2 h-11 w-full rounded-full bg-amber-400 text-sm font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? "제출 중..." : "투표 제출"}
        </button>
      </main>
    </div>
  );
}

type SelectProps = {
  value: string;
  onChange: (value: string) => void;
  players: Player[];
  placeholder: string;
};

function SelectPlayer({ value, onChange, players, placeholder }: SelectProps) {
  return (
    <select
      className="h-10 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-xs outline-none focus:border-zinc-400"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {players.map((p) => (
        <option key={p.id} value={p.id}>
          {p.nickname}
        </option>
      ))}
    </select>
  );
}
