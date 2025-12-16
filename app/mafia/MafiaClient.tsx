"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  MafiaLog,
  MafiaPhaseState,
  MafiaPlayerState,
  MafiaStockState,
} from "@/lib/types";
import { usePlayerAuth } from "@/lib/hooks/usePlayerAuth";
import { PageGuard } from "@/components/PageGuard";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ErrorMessage } from "@/components/ErrorMessage";
import { TabLayout, type TabKey } from "@/components/TabLayout";
import { useCountdown } from "@/lib/hooks/useCountdown";

export default function MafiaClient() {
  return (
    <PageGuard requireLogin allowGames={["mafia", "mafia_tutorial"]}>
      <MafiaInner />
    </PageGuard>
  );
}

function MafiaInner() {
  const { player } = usePlayerAuth();
  const [mafiaPlayer, setMafiaPlayer] = useState<MafiaPlayerState | null>(null);
  const [stocks, setStocks] = useState<MafiaStockState[]>([]);
  const [phase, setPhase] = useState<MafiaPhaseState | null>(null);
  const [logs, setLogs] = useState<MafiaLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("info");

  useEffect(() => {
    if (!player?.nickname) return;
    let cancelled = false;

    const load = async (nickname: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ nickname });
        const res = await fetch(`/api/mafia/state?${params.toString()}`);
        const json = (await res.json().catch(() => null)) as
          | {
              phase: MafiaPhaseState | null;
              stocks: MafiaStockState[];
              playerState: MafiaPlayerState | null;
              logs: MafiaLog[];
              error?: undefined;
            }
          | { error: string }
          | null;

        if (!res.ok || !json || "error" in json) {
          throw new Error(
            (json as { error?: string })?.error ??
              "마피아 게임 정보를 불러오지 못했습니다."
          );
        }

        if (cancelled) return;

        setMafiaPlayer(json.playerState ?? null);
        setStocks(json.stocks ?? []);
        setPhase(json.phase ?? null);
        setLogs(json.logs ?? []);
        setError(null);
      } catch (e: unknown) {
        if (!cancelled) {
          const message =
            e instanceof Error
              ? e.message
              : "마피아 게임 정보를 불러오지 못했습니다.";
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load(player.nickname);

    return () => {
      cancelled = true;
    };
  }, [player?.nickname]);

  const targetTime = null;
  const { minutes, seconds } = useCountdown(targetTime);

  const availableTabs = useMemo(() => {
    const base: TabKey[] = ["info", "rules", "stocks"];
    const phaseKey = phase?.phase;
    if (phaseKey === "auction") base.push("auction");
    if (phaseKey === "trade" || phaseKey === "apply") {
      base.push("trade", "ability");
    }
    if (phaseKey === "vote") {
      base.push("result", "vote");
    }
    return base;
  }, [phase?.phase]);

  const tabsDef = useMemo(
    () =>
      [
        { key: "info", label: "정보" },
        { key: "rules", label: "규칙" },
        { key: "stocks", label: "주가" },
        { key: "auction", label: "경매" },
        { key: "trade", label: "거래" },
        { key: "ability", label: "능력사용" },
        { key: "result", label: "능력결과" },
        { key: "vote", label: "투표" },
      ].filter((t) => availableTabs.includes(t.key)),
    [availableTabs]
  );

  useEffect(() => {
    if (!tabsDef.find((t) => t.key === activeTab) && tabsDef.length > 0) {
      setActiveTab(tabsDef[0].key);
    }
  }, [activeTab, tabsDef]);

  if (loading || !player) return <LoadingScreen />;
  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-zinc-50">
        <ErrorMessage message={error} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-950 px-4 py-6 text-zinc-50">
      <header className="flex w-full max-w-md items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">자본주의 마피아</h1>
          <p className="text-xs text-zinc-400">
            라운드와 페이즈에 맞춰 행동해 주세요.
          </p>
        </div>
        <div className="text-right text-[10px] text-zinc-400">
          <div>
            라운드 {phase?.round_number ?? "-"} / 페이즈 {phase?.phase ?? "-"}
          </div>
          <div>
            남은 시간{" "}
            {minutes != null && seconds != null
              ? `${minutes}:${seconds.toString().padStart(2, "0")}`
              : "--:--"}
          </div>
        </div>
      </header>

      <main className="mt-4 flex w-full max-w-md flex-1 flex-col">
        <TabLayout tabs={tabsDef} activeKey={activeTab} onChange={setActiveTab}>
          {activeTab === "info" && <InfoTab mafiaPlayer={mafiaPlayer} />}
          {activeTab === "rules" && <RulesTab />}
          {activeTab === "stocks" && <StocksTab stocks={stocks} />}
          {activeTab === "auction" && <AuctionTab />}
          {activeTab === "trade" && <TradeTab />}
          {activeTab === "ability" && <AbilityTab />}
          {activeTab === "result" && <ResultTab logs={logs} />}
          {activeTab === "vote" && <VoteTab />}
        </TabLayout>
      </main>
    </div>
  );
}

type InfoProps = {
  mafiaPlayer: MafiaPlayerState | null;
};

function InfoTab({ mafiaPlayer }: InfoProps) {
  return (
    <div className="flex flex-col gap-2 text-sm text-zinc-100">
      <p className="text-xs text-zinc-400">당신의 현재 상태입니다.</p>
      <div className="rounded-xl bg-zinc-900 p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-300">보유 현금</span>
          <span className="font-semibold text-amber-300">
            {mafiaPlayer?.cash ?? 0} 코인
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-zinc-400">
          <span>직업</span>
          <span>{mafiaPlayer?.job ?? "(비공개)"}</span>
        </div>
      </div>
    </div>
  );
}

function RulesTab() {
  return (
    <div className="space-y-2 text-xs leading-relaxed text-zinc-200">
      <p>자본주의 마피아의 상세 규칙은 현장에서 GM이 설명합니다.</p>
      <p>여기서는 현재 페이즈와 가능한 행동만 간단히 요약합니다.</p>
      <ul className="list-disc pl-4">
        <li>경매 페이즈: 주가에 영향을 줄 수 있는 베팅을 진행합니다.</li>
        <li>거래 페이즈: 다른 플레이어나 은행과 주식/현금을 교환합니다.</li>
        <li>능력 사용: 역할에 따라 부여된 능력을 사용합니다.</li>
        <li>투표 페이즈: 마피아로 의심되는 사람에게 표를 던집니다.</li>
      </ul>
    </div>
  );
}

type StocksProps = {
  stocks: MafiaStockState[];
};

function StocksTab({ stocks }: StocksProps) {
  return (
    <div className="space-y-2 text-sm text-zinc-100">
      <p className="text-xs text-zinc-400">현재 공개된 주가입니다.</p>
      <div className="divide-y divide-zinc-800 rounded-xl bg-zinc-900">
        {stocks.map((s) => (
          <div
            key={s.stock_key}
            className="flex items-center justify-between px-3 py-2 text-sm"
          >
            <span className="capitalize text-zinc-200">{s.stock_key}</span>
            <span className="font-semibold text-emerald-300">
              {s.price} 코인
            </span>
          </div>
        ))}
        {stocks.length === 0 && (
          <p className="px-3 py-4 text-xs text-zinc-400">
            아직 공개된 주가 정보가 없습니다.
          </p>
        )}
      </div>
    </div>
  );
}

function AuctionTab() {
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

function TradeTab() {
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

function AbilityTab() {
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
      <p className="text-xs text-zinc-400">
        능력을 사용할 대상(선택)과 내용을 적어 주세요. 최종 해석은 GM이
        진행합니다.
      </p>
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

type ResultProps = {
  logs: MafiaLog[];
};

function ResultTab({ logs }: ResultProps) {
  return (
    <div className="space-y-2 text-xs text-zinc-200">
      <p className="text-xs text-zinc-400">
        GM이 공개한 로그가 여기에 표시됩니다.
      </p>
      <div className="space-y-2">
        {logs.map((log) => (
          <div
            key={log.id}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-xs text-zinc-100"
          >
            {log.content}
          </div>
        ))}
        {logs.length === 0 && (
          <p className="text-xs text-zinc-400">아직 공개된 로그가 없습니다.</p>
        )}
      </div>
    </div>
  );
}

function VoteTab() {
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
