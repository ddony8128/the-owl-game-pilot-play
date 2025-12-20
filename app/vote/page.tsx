"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const { player } = usePlayerAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const [cunning1, setCunning1] = useState<string>("");
  const [cunning2, setCunning2] = useState<string>("");
  const [strategic1, setStrategic1] = useState<string>("");
  const [strategic2, setStrategic2] = useState<string>("");
  const [reasonCunning, setReasonCunning] = useState("");
  const [reasonStrategic, setReasonStrategic] = useState("");
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

    if (reasonCunning.trim().length < 5) {
      setError("가장 무자비한 플레이어에 대한 이유를 5글자 이상 적어 주세요.");
      return;
    }
    if (reasonStrategic.trim().length < 5) {
      setError("가장 전략적인 플레이어에 대한 이유를 5글자 이상 적어 주세요.");
      return;
    }
    if (!cunning1 || !cunning2 || !strategic1 || !strategic2) {
      setError("각 항목마다 플레이어 2명을 모두 선택해 주세요.");
      return;
    }

    if (cunning1 === cunning2) {
      setError("가장 무자비한 플레이어 2명은 서로 다른 사람이어야 합니다.");
      return;
    }

    if (strategic1 === strategic2) {
      setError("가장 전략적인 플레이어 2명은 서로 다른 사람이어야 합니다.");
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
          cunning1,
          cunning2,
          strategic1,
          strategic2,
          reason_cunning: reasonCunning,
          reason_strategic: reasonStrategic,
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
        <h1 className="mb-3 text-lg font-semibold">투표가 완료되었습니다</h1>
        <button
          className="mt-2 h-12 rounded-full bg-zinc-100 px-6 text-base font-semibold text-zinc-900 hover:bg-white"
          onClick={() => router.push("/intro")}
        >
          메인 페이지로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-950 px-4 py-8 text-zinc-50">
      <header className="w-full max-w-md text-center">
        <h1 className="text-lg font-semibold">투표</h1>
        <p className="mt-1 text-base text-zinc-400">
          가장 무자비한 플레이어 2명, 가장 전략적인 플레이어 2명을 고르고,
          각각에 대한 이유를 적어 주세요.
        </p>
      </header>

      <main className="mt-6 flex w-full max-w-md flex-1 flex-col gap-4 text-base">
        <section className="rounded-xl bg-zinc-900 p-3">
          <h2 className="mb-2 text-base font-semibold text-zinc-300">
            가장 무자비한 플레이어 2명
          </h2>
          <div className="flex gap-2">
            <SelectPlayer
              value={cunning1}
              onChange={setCunning1}
              players={selectablePlayers}
              placeholder="플레이어 1"
            />
            <SelectPlayer
              value={cunning2}
              onChange={setCunning2}
              players={selectablePlayers}
              placeholder="플레이어 2"
            />
          </div>
          <div className="mt-3 flex flex-col gap-1">
            <label className="text-base text-zinc-400">
              왜 이렇게 선택했는지 적어 주세요. (5글자 이상)
            </label>
            <textarea
              className="h-20 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-xs outline-none focus:border-zinc-400"
              value={reasonCunning}
              onChange={(e) => setReasonCunning(e.target.value)}
            />
          </div>
        </section>

        <section className="rounded-xl bg-zinc-900 p-3">
          <h2 className="mb-2 text-base font-semibold text-zinc-300">
            가장 전략적인 플레이어 2명
          </h2>
          <div className="flex gap-2">
            <SelectPlayer
              value={strategic1}
              onChange={setStrategic1}
              players={selectablePlayers}
              placeholder="플레이어 3"
            />
            <SelectPlayer
              value={strategic2}
              onChange={setStrategic2}
              players={selectablePlayers}
              placeholder="플레이어 4"
            />
          </div>
          <div className="mt-3 flex flex-col gap-1">
            <label className="text-base text-zinc-400">
              왜 이렇게 선택했는지 적어 주세요. (5글자 이상)
            </label>
            <textarea
              className="h-20 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-xs outline-none focus:border-zinc-400"
              value={reasonStrategic}
              onChange={(e) => setReasonStrategic(e.target.value)}
            />
          </div>
        </section>

        {error && <ErrorMessage message={error} />}

        <button
          className="mt-2 h-12 w-full rounded-full bg-amber-400 text-base font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
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
