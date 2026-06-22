import type { MafiaPlayerState, MafiaStockState } from "@/lib/types";

type Props = {
  players: MafiaPlayerState[];
  playerNames: Record<string, string>;
  stocks: MafiaStockState[];
};

export function MafiaAssetsSection({ players, playerNames, stocks }: Props) {
  const priceByStock = new Map<string, number>();
  for (const s of stocks) {
    priceByStock.set(s.stock_key, s.price);
  }

  const computeHoldingsAndTotal = (p: MafiaPlayerState) => {
    const rawStocks = (p as unknown as { stocks?: unknown }).stocks;
    const holdings: {
      stock_key: string;
      amount: number;
      price: number;
      value: number;
    }[] = [];

    if (rawStocks && typeof rawStocks === "object") {
      const obj = rawStocks as Record<string, { amount?: number }>;
      for (const [stockKey, info] of Object.entries(obj)) {
        const amount =
          info && typeof info.amount === "number" ? info.amount : 0;
        if (amount <= 0) continue;
        const price = priceByStock.get(stockKey) ?? 0;
        const value = amount * price;
        holdings.push({ stock_key: stockKey, amount, price, value });
      }
    }

    const holdingsValue = holdings.reduce((sum, h) => sum + h.value, 0);
    const totalAssets = p.cash + holdingsValue;
    return { holdings, holdingsValue, totalAssets };
  };

  return (
    <section className="space-y-2 text-sm">
      <h2 className="text-base font-semibold">자산 현황</h2>
      {players.length === 0 ? (
        <p className="text-sm text-zinc-400">플레이어 데이터가 없습니다.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {players.map((p) => {
            const name = playerNames[p.player_id] ?? "(이름 없음)";
            const { holdings, holdingsValue, totalAssets } =
              computeHoldingsAndTotal(p);
            return (
              <div
                key={p.player_id}
                className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{name}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p>
                      직업:{" "}
                      <span className="font-semibold">
                        {p.job ?? "미배정(월급쟁이)"}
                      </span>
                    </p>
                    <p>
                      마피아:{" "}
                      <span className="font-semibold">
                        {p.is_mafia ? "예" : "아니오"}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="rounded-md bg-zinc-950 px-2 py-1.5">
                  <p className="flex justify-between text-sm text-zinc-300">
                    <span>현금</span>
                    <span className="font-semibold">{p.cash}원</span>
                  </p>
                  <p className="mt-1 flex justify-between text-sm text-zinc-300">
                    <span>주식 평가액</span>
                    <span className="font-semibold">{holdingsValue}원</span>
                  </p>
                  <p className="mt-1 flex justify-between text-sm text-amber-300">
                    <span>총 자산</span>
                    <span className="font-semibold">{totalAssets}원</span>
                  </p>
                </div>

                <div>
                  <p className="mb-1 text-sm text-zinc-400">보유 주식</p>
                  {holdings.length === 0 ? (
                    <p className="text-sm text-zinc-600">
                      보유한 주식이 없습니다.
                    </p>
                  ) : (
                    <div className="max-h-40 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-950">
                      <table className="min-w-full border-collapse text-sm">
                        <thead className="bg-zinc-900">
                          <tr>
                            <th className="px-2 py-1 text-left">종목</th>
                            <th className="px-2 py-1 text-right">수량</th>
                            <th className="px-2 py-1 text-right">현재가</th>
                            <th className="px-2 py-1 text-right">평가금액</th>
                          </tr>
                        </thead>
                        <tbody>
                          {holdings.map((h) => (
                            <tr
                              key={h.stock_key}
                              className="border-t border-zinc-800"
                            >
                              <td className="px-2 py-1">{h.stock_key}</td>
                              <td className="px-2 py-1 text-right">
                                {h.amount}
                              </td>
                              <td className="px-2 py-1 text-right">
                                {h.price}
                              </td>
                              <td className="px-2 py-1 text-right">
                                {h.value}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
