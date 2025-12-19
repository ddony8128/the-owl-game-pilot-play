"use client";

import { useState } from "react";
import Image from "next/image";
import type { MafiaStockState, MafiaStocksHolding } from "@/lib/types";
import { usePlayerAuth } from "@/lib/hooks/usePlayerAuth";
import { ErrorMessage } from "@/components/ErrorMessage";

type Props = {
  stocks: MafiaStockState[];
  playerCash: number | null;
  holdings: MafiaStocksHolding | null;
  myTradesThisRound: Record<string, { bought: boolean; sold: boolean }> | null;
};

type TradeStep = "pickStock" | "enterAmount";

const getStockLogoSrc = (key: string): string | null => {
  switch (key) {
    case "부엉교육":
      return "/mafia/company/edu.png";
    case "번쩍전기":
      return "/mafia/company/electricity.png";
    case "국채":
      return "/mafia/company/owl_flag.png";
    case "이상교통":
      return "/mafia/company/vehicle.png";
    default:
      return null;
  }
};

export function MafiaTradeTab({
  stocks,
  playerCash,
  holdings,
  myTradesThisRound,
}: Props) {
  const [step, setStep] = useState<TradeStep>("pickStock");
  const [type, setType] = useState<"buy" | "sell">("buy");
  const [stockKey, setStockKey] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [boughtStocks, setBoughtStocks] = useState<string[]>([]);
  const [soldStocks, setSoldStocks] = useState<string[]>([]);
  const { player } = usePlayerAuth();

  const holdingAmountFor = (key: string): number => {
    if (!holdings || typeof holdings !== "object") return 0;
    const entry = (holdings as Record<string, { amount: number }>)[key];
    return typeof entry?.amount === "number" && entry.amount > 0
      ? entry.amount
      : 0;
  };

  const handleSubmit = async () => {
    if (!player?.nickname) return;
    if (!stockKey) return;
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) {
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
    const label =
      stocks.find((s) => s.stock_key === stockKey)?.stock_key ?? stockKey;
    const verb = type === "buy" ? "매수" : "매도";
    setInfo(
      `${label}을(를) ${amount}개 ${verb}했습니다. 정보 탭에서 확인해보세요.`
    );
    setValue("");
    setStep("pickStock");
    if (type === "buy") {
      setBoughtStocks((prev) =>
        prev.includes(stockKey) ? prev : [...prev, stockKey]
      );
    } else {
      setSoldStocks((prev) =>
        prev.includes(stockKey) ? prev : [...prev, stockKey]
      );
    }
  };

  const priceFor = (key: string | null) =>
    key ? stocks.find((s) => s.stock_key === key)?.price ?? 0 : 0;

  const parsedAmount = Number(value);
  const validAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const totalPrice = validAmount ? parsedAmount * priceFor(stockKey) : 0;

  return (
    <div className="space-y-4 text-sm text-zinc-100">
      {error && <ErrorMessage message={error} />}
      {info && (
        <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {info}
        </p>
      )}

      {step === "pickStock" && (
        <div className="space-y-3">
          <p className="text-base text-zinc-400">
            어떤 주식을 거래하겠습니까?
            <br /> (같은 주식을 매수, 매도 둘 다 할 수는 없습니다.)
          </p>
          <div className="space-y-3 ">
            {stocks.map((s) => {
              const tradeInfo = myTradesThisRound?.[s.stock_key];
              const disabledBuy =
                soldStocks.includes(s.stock_key) || tradeInfo?.sold === true;
              const disabledSell =
                boughtStocks.includes(s.stock_key) ||
                tradeInfo?.bought === true ||
                holdingAmountFor(s.stock_key) <= 0;
              return (
                <div
                  key={s.stock_key}
                  className="flex items-center justify-between rounded-lg bg-zinc-900 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    {getStockLogoSrc(s.stock_key) && (
                      <div className="relative h-30 w-30 overflow-hidden rounded-md bg-zinc-800">
                        <Image
                          src={getStockLogoSrc(s.stock_key)!}
                          alt={s.stock_key}
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span className="text-lg text-zinc-100">
                        {s.stock_key}
                      </span>
                      <span className="text-base text-zinc-400">
                        현재 가격: {s.price}원
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="h-12 rounded-full bg-emerald-500 px-4 text-base font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-40"
                      disabled={disabledBuy}
                      onClick={() => {
                        setType("buy");
                        setStockKey(s.stock_key);
                        setValue("");
                        setError(null);
                        setStep("enterAmount");
                      }}
                    >
                      매수
                    </button>
                    <button
                      type="button"
                      className="h-12 rounded-full bg-red-500 px-4 text-base font-semibold text-zinc-950 hover:bg-red-400 disabled:opacity-40"
                      disabled={disabledSell}
                      onClick={() => {
                        setType("sell");
                        setStockKey(s.stock_key);
                        setValue("");
                        setError(null);
                        setStep("enterAmount");
                      }}
                    >
                      매도
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {step === "enterAmount" && stockKey && (
        <div className="space-y-4">
          <p className="text-base text-zinc-400">
            {stockKey}을(를) 얼마나 {type === "buy" ? "매수" : "매도"}
            하시겠습니까?
          </p>
          {type === "buy" && (
            <p className="text-sm text-zinc-500">
              현재 보유 현금:{" "}
              <span className="font-semibold text-amber-300">
                {playerCash ?? 0} 코인
              </span>
            </p>
          )}
          {type === "sell" && (
            <p className="text-sm text-zinc-500">
              현재 보유 수량:{" "}
              <span className="font-semibold text-emerald-300">
                {holdingAmountFor(stockKey)}개
              </span>
            </p>
          )}
          <input
            className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm outline-none focus:border-zinc-400"
            placeholder="수량"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <p className="text-sm text-zinc-400">
            현재 가격 {priceFor(stockKey)}원 × 수량 ={" "}
            <span className="font-semibold text-amber-300">
              {validAmount ? `${totalPrice}원` : "-원"}
            </span>
          </p>
          <div className="flex gap-2">
            <button
              className="h-12 flex-1 rounded-full bg-zinc-800 text-base font-semibold text-zinc-100 hover:bg-zinc-700"
              type="button"
              onClick={() => {
                setStep("pickStock");
                setStockKey(null);
                setValue("");
              }}
            >
              취소
            </button>
            <button
              className="h-12 flex-1 rounded-full bg-amber-400 text-base font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "제출 중..." : "거래 제출"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
