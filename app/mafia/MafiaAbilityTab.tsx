"use client";

import { useMemo, useState } from "react";
import { usePlayerAuth } from "@/lib/hooks/usePlayerAuth";
import { ErrorMessage } from "@/components/ErrorMessage";
import type { MafiaAbilityPayload } from "@/lib/mafia/abilities";
import type { MafiaStockState, Player } from "@/lib/types";
import { JOB_META } from "./MafiaInfoTab";

type Props = {
  job: string | null;
  stocks: MafiaStockState[];
  players: Player[];
  hasUsedAbilityThisPhase: boolean;
  myAbilityActionThisPhase: {
    job: string | null;
    payload: Record<string, unknown> | null;
  } | null;
};

export function MafiaAbilityTab({
  job,
  stocks,
  players,
  hasUsedAbilityThisPhase,
  myAbilityActionThisPhase,
}: Props) {
  const { player, roomCode } = usePlayerAuth();
  const [selectedStockKey, setSelectedStockKey] = useState<string | null>(null);
  const [robberTargets, setRobberTargets] = useState<string[]>([]);
  const [policeTargets, setPoliceTargets] = useState<string[]>([]);
  const [taxTargets, setTaxTargets] = useState<string[]>([]);
  const [ceoTarget, setCeoTarget] = useState<string | null>(null);
  const [mayorPrice, setMayorPrice] = useState<1 | 2 | 3 | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const normalizedJob = job ?? null;

  const jobLabel =
    normalizedJob && JOB_META[normalizedJob]
      ? JOB_META[normalizedJob].label
      : normalizedJob ?? "없음";

  const availableStocks = useMemo(
    () => stocks.filter((s) => s.stock_key !== "국채"),
    [stocks]
  );

  const otherPlayers = useMemo(() => {
    if (!player?.nickname) return [];
    return players.filter((p) => p.nickname && p.nickname !== player?.nickname);
  }, [players, player?.nickname]);

  const buildPayload = (): MafiaAbilityPayload | null => {
    if (!normalizedJob) return null;

    switch (normalizedJob) {
      case "up_manipulator":
      case "down_manipulator":
      case "broker": {
        if (!selectedStockKey) {
          setError("대상 주식을 선택해 주세요. (국채 제외)");
          return null;
        }
        return { job: normalizedJob, stock_key: selectedStockKey };
      }
      case "robber": {
        if (robberTargets.length !== 2) {
          setError("서로 다른 두 명을 선택해 주세요.");
          return null;
        }
        return { job: "robber", targets: robberTargets as [string, string] };
      }
      case "police": {
        if (policeTargets.length !== 2) {
          setError("조사할 두 사람을 정확히 선택해 주세요.");
          return null;
        }
        return { job: "police", targets: policeTargets as [string, string] };
      }
      case "tax_auditor": {
        if (taxTargets.length !== 2) {
          setError("세무조사 대상 두 명을 선택해 주세요.");
          return null;
        }
        return { job: "tax_auditor", targets: taxTargets as [string, string] };
      }
      case "mayor": {
        if (!mayorPrice) {
          setError("표 가격을 1~3원 중에서 선택해 주세요.");
          return null;
        }
        return { job: "mayor", ticket_price: mayorPrice };
      }
      case "ceo":
        if (!ceoTarget) {
          setError("CEO가 5원을 줄 대상을 선택해 주세요.");
          return null;
        }
        return { job: "ceo", target: ceoTarget };
      case "salaryman":
        return { job: "salaryman" };
      default:
        return null;
    }
  };

  const handleSubmit = async () => {
    if (!player?.nickname || !roomCode || !normalizedJob) return;
    if (submitted) return;

    setError(null);
    setInfo(null);

    const payload = buildPayload();
    if (!payload) {
      return;
    }

    const confirmed = window.confirm(
      "능력 사용을 제출하면 이 라운드에서는 다시 변경할 수 없습니다.\n정말 제출하시겠습니까?"
    );
    if (!confirmed) {
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/mafia/action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          room: roomCode,
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
    setSubmitted(true);
    setInfo("이번 라운드에 능력을 사용했습니다. 한 번만 사용할 수 있습니다.");
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

  const summarizeUsedAbility = (): string => {
    const action = myAbilityActionThisPhase;
    if (!action || !action.job) {
      return "이번 라운드에 이미 능력을 사용했습니다. 능력은 각 라운드마다 한 번만 사용할 수 있습니다.";
    }

    const payload = (action.payload ?? {}) as Record<string, unknown>;

    switch (action.job) {
      case "up_manipulator":
      case "down_manipulator":
      case "broker": {
        const stockKey =
          typeof payload.stock_key === "string" ? payload.stock_key : null;
        if (stockKey) {
          return `이번 라운드에 ${stockKey} 주식에 능력을 사용했습니다.`;
        }
        return "이번 라운드에 주가 조작/증권사 능력을 사용했습니다.";
      }
      case "robber": {
        const targets = payload.targets as unknown;
        const names =
          Array.isArray(targets) && targets.length >= 2
            ? (targets as unknown[]).filter(
                (t): t is string => typeof t === "string"
              )
            : [];
        if (names.length >= 2) {
          return `이번 라운드에 강도 능력으로 ${names[0]}, ${names[1]}을(를) 대상으로 지정했습니다.`;
        }
        return "이번 라운드에 강도 능력을 사용했습니다.";
      }
      case "police": {
        const targets = payload.targets as unknown;
        const names =
          Array.isArray(targets) && targets.length >= 2
            ? (targets as unknown[]).filter(
                (t): t is string => typeof t === "string"
              )
            : [];
        if (names.length >= 2) {
          return `이번 라운드에 경찰 능력으로 ${names[0]}, ${names[1]}을(를) 조사 대상으로 선택했습니다.`;
        }
        return "이번 라운드에 경찰 능력을 사용했습니다.";
      }
      case "tax_auditor": {
        const targets = payload.targets as unknown;
        const names =
          Array.isArray(targets) && targets.length >= 2
            ? (targets as unknown[]).filter(
                (t): t is string => typeof t === "string"
              )
            : [];
        if (names.length >= 2) {
          return `이번 라운드에 세무조사원 능력으로 ${names[0]}, ${names[1]}의 자산을 조사하기로 선택했습니다.`;
        }
        return "이번 라운드에 세무조사원 능력을 사용했습니다.";
      }
      case "mayor": {
        const tp =
          typeof payload.ticket_price === "number"
            ? (payload.ticket_price as number)
            : null;
        if (tp != null) {
          return `이번 라운드 표 가격을 ${tp}원으로 설정했습니다.`;
        }
        return "이번 라운드에 시장 능력으로 표 가격을 설정했습니다.";
      }
      case "ceo":
        return "이번 라운드에 CEO 능력을 사용했습니다.";
      case "salaryman":
        return "이번 라운드에 월급쟁이 능력을 사용했습니다. (고정 월급 지급)";
      default:
        return "이번 라운드에 이미 능력을 사용했습니다. 능력은 각 라운드마다 한 번만 사용할 수 있습니다.";
    }
  };

  // 이미 이번 라운드/페이즈에서 능력을 사용했다면 요약 문구만 표시
  if (hasUsedAbilityThisPhase || submitted) {
    const summary = summarizeUsedAbility();
    return (
      <div className="space-y-3 text-sm text-zinc-100">
        {error && <ErrorMessage message={error} />}
        <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-base text-emerald-300 whitespace-pre-wrap">
          {summary}
        </p>
        <p className="text-sm text-zinc-400">
          능력의 결과는 다음 단계(주가 변동)에서 적용됩니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-base text-zinc-100">
      {error && <ErrorMessage message={error} />}
      {info && (
        <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
          {info}
        </p>
      )}
      <p className="text-base text-zinc-400">
        현재 직업:{" "}
        <span className="font-semibold text-zinc-100">{jobLabel}</span>
      </p>

      {(normalizedJob === "up_manipulator" ||
        normalizedJob === "down_manipulator" ||
        normalizedJob === "broker") && (
        <>
          <p className="text-base text-zinc-400">
            국채를 제외한 종목을 하나 선택해 주세요.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {availableStocks.map((s) => (
              <button
                key={s.stock_key}
                type="button"
                className={`h-12 rounded-lg border text-base font-semibold ${
                  selectedStockKey === s.stock_key
                    ? "border-amber-400 bg-amber-400 text-zinc-950"
                    : "border-zinc-700 bg-zinc-900 text-zinc-100"
                }`}
                onClick={() =>
                  setSelectedStockKey(
                    selectedStockKey === s.stock_key ? null : s.stock_key
                  )
                }
              >
                {s.stock_key} ({s.price}원)
              </button>
            ))}
            {availableStocks.length === 0 && (
              <p className="col-span-2 text-base text-zinc-500">
                선택 가능한 주식이 없습니다.
              </p>
            )}
          </div>
        </>
      )}

      {normalizedJob === "robber" && (
        <>
          <p className="text-base text-zinc-400">
            돈을 빼앗아 올 2명을 선택해줘부엉!
          </p>
          <div className="grid grid-cols-2 gap-2">
            {otherPlayers.map((p) => {
              const selected = robberTargets.includes(p.nickname);
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`h-10 rounded-lg border text-sm font-semibold ${
                    selected
                      ? "border-red-400 bg-red-500 text-zinc-950"
                      : "border-zinc-700 bg-zinc-900 text-zinc-100"
                  }`}
                  onClick={() => {
                    setRobberTargets((prev) => {
                      if (prev.includes(p.nickname)) {
                        return prev.filter((n) => n !== p.nickname);
                      }
                      if (prev.length >= 2) {
                        return prev;
                      }
                      return [...prev, p.nickname];
                    });
                  }}
                >
                  {p.nickname}
                </button>
              );
            })}
            {otherPlayers.length === 0 && (
              <p className="col-span-2 text-base text-zinc-500">
                선택 가능한 다른 플레이어가 없습니다.
              </p>
            )}
          </div>
          <p className="text-sm text-zinc-400">
            선택된 대상: {""}
            {robberTargets.length > 0 ? robberTargets.join(", ") : "없음"}
          </p>
        </>
      )}

      {normalizedJob === "police" && (
        <>
          <p className="text-base text-zinc-400">
            마피아인지 조사할 두 사람을 선택해 주세요. 두 사람 중 마피아가
            있는지 없는지만 알 수 있다부엉!
          </p>
          <div className="grid grid-cols-2 gap-2">
            {otherPlayers.map((p) => {
              const selected = policeTargets.includes(p.nickname);
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`h-10 rounded-lg border text-sm font-semibold ${
                    selected
                      ? "border-emerald-400 bg-emerald-500 text-zinc-950"
                      : "border-zinc-700 bg-zinc-900 text-zinc-100"
                  }`}
                  onClick={() =>
                    setPoliceTargets((prev) => {
                      if (prev.includes(p.nickname)) {
                        return prev.filter((n) => n !== p.nickname);
                      }
                      if (prev.length >= 2) {
                        return prev;
                      }
                      return [...prev, p.nickname];
                    })
                  }
                >
                  {p.nickname}
                </button>
              );
            })}
            {otherPlayers.length === 0 && (
              <p className="col-span-2 text-sm text-zinc-500">
                선택 가능한 다른 플레이어가 없습니다.
              </p>
            )}
          </div>
        </>
      )}

      {normalizedJob === "tax_auditor" && (
        <>
          <p className="text-base text-zinc-400">
            세무조사를 진행할 두 명을 선택해줘부엉! 아주 탈탈 털어보자부엉!
          </p>
          <div className="grid grid-cols-2 gap-2">
            {otherPlayers.map((p) => {
              const selected = taxTargets.includes(p.nickname);
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`h-10 rounded-lg border text-sm font-semibold ${
                    selected
                      ? "border-amber-400 bg-amber-400 text-zinc-950"
                      : "border-zinc-700 bg-zinc-900 text-zinc-100"
                  }`}
                  onClick={() =>
                    setTaxTargets((prev) => {
                      if (prev.includes(p.nickname)) {
                        return prev.filter((n) => n !== p.nickname);
                      }
                      if (prev.length >= 2) {
                        return prev;
                      }
                      return [...prev, p.nickname];
                    })
                  }
                >
                  {p.nickname}
                </button>
              );
            })}
            {otherPlayers.length === 0 && (
              <p className="col-span-2 text-sm text-zinc-500">
                선택 가능한 다른 플레이어가 없습니다.
              </p>
            )}
          </div>
        </>
      )}

      {normalizedJob === "mayor" && (
        <>
          <p className="text-base text-zinc-400">
            이번 라운드의 표 가격을 선택해 주세요. (1~3원)
          </p>
          <div className="flex gap-2">
            {[1, 2, 3].map((p) => (
              <button
                key={p}
                type="button"
                className={`h-12 flex-1 rounded-full border text-base font-semibold ${
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
        <>
          {normalizedJob === "ceo" && (
            <p className="text-base text-zinc-400">
              CEO는 자신을 제외한 한 사람을 골라 그 사람에게 5원을 줄 수
              있다부엉! 아래에서 대상을 선택해줘부엉.
            </p>
          )}
          {normalizedJob === "salaryman" && (
            <p className="text-base text-zinc-400">
              월급쟁이는 별도로 사용하지 않아도 자동으로 월급이 지급된다부엉!
            </p>
          )}
        </>
      )}

      {normalizedJob === "ceo" && (
        <div>
          <p className="mb-2 text-base text-zinc-400">
            5원을 줄 대상을 한 명 선택해줘부엉. 선택된 사람은 CEO가 누구인지
            알게 된다부엉!
          </p>
          <div className="grid grid-cols-2 gap-2">
            {otherPlayers.map((p) => {
              const selected = ceoTarget === p.nickname;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`h-10 rounded-lg border text-sm font-semibold ${
                    selected
                      ? "border-amber-400 bg-amber-400 text-zinc-950"
                      : "border-zinc-700 bg-zinc-900 text-zinc-100"
                  }`}
                  onClick={() =>
                    setCeoTarget(
                      selected ? null : (p.nickname as string | null)
                    )
                  }
                >
                  {p.nickname}
                </button>
              );
            })}
            {otherPlayers.length === 0 && (
              <p className="col-span-2 text-sm text-zinc-500">
                선택 가능한 다른 플레이어가 없습니다.
              </p>
            )}
          </div>
        </div>
      )}

      <button
        className="h-12 w-full rounded-full bg-amber-400 text-base font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
        onClick={handleSubmit}
        disabled={submitting || !normalizedJob || submitted}
      >
        {submitted
          ? "이미 능력을 사용했습니다"
          : submitting
          ? "제출 중..."
          : "능력 사용 제출"}
      </button>
    </div>
  );
}
