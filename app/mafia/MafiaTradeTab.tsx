"use client";

import { useState } from "react";
import type { MafiaStockState } from "@/lib/types";
import { usePlayerAuth } from "@/lib/hooks/usePlayerAuth";
import { ErrorMessage } from "@/components/ErrorMessage";

type Props = {
  stocks: MafiaStockState[];
};

type TradeStep = "pickStock" | "enterAmount";

export function MafiaTradeTab({ stocks }: Props) {
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
        <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
          {info}
        </p>
      )}

      {step === "pickStock" && (
        <div className="space-y-3">
          <p className="text-xs text-zinc-400">
            같은 주식을 매수, 매도 둘 다 할 수는 없습니다. 어떤 주식을
            거래하겠습니까?
          </p>
          <div className="space-y-2">
            {stocks.map((s) => {
              const disabledBuy = soldStocks.includes(s.stock_key);
              const disabledSell = boughtStocks.includes(s.stock_key);
              return (
                <div
                  key={s.stock_key}
                  className="flex items-center justify-between rounded-lg bg-zinc-900 px-3 py-2"
                >
                  <div className="flex flex-col">
                    <span className="text-sm text-zinc-100">{s.stock_key}</span>
                    <span className="text-[11px] text-zinc-400">
                      현재 가격: {s.price}원
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="h-8 rounded-full bg-emerald-500 px-3 text-[11px] font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-40"
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
                      className="h-8 rounded-full bg-red-500 px-3 text-[11px] font-semibold text-zinc-950 hover:bg-red-400 disabled:opacity-40"
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
        <div className="space-y-3">
          <p className="text-xs text-zinc-400">
            {stockKey}을(를) 얼마나 {type === "buy" ? "매수" : "매도"}
            하시겠습니까?
          </p>
          <input
            className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm outline-none focus:border-zinc-400"
            placeholder="수량"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <p className="text-xs text-zinc-400">
            현재 가격 {priceFor(stockKey)}원 × 수량 ={" "}
            <span className="font-semibold text-amber-300">
              {validAmount ? `${totalPrice}원` : "-원"}
            </span>
          </p>
          <div className="flex gap-2">
            <button
              className="h-10 flex-1 rounded-full bg-zinc-800 text-xs font-semibold text-zinc-100 hover:bg-zinc-700"
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
              className="h-10 flex-1 rounded-full bg-amber-400 text-xs font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
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
