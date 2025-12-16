import type { MafiaStockState } from "@/lib/types";

type Props = {
  stocks: MafiaStockState[];
};

export function MafiaStocksSection({ stocks }: Props) {
  return (
    <section className="space-y-2 text-sm">
      <h2 className="text-base font-semibold">주가</h2>
      <div className="flex flex-wrap gap-2 text-xs">
        {stocks.map((s) => (
          <div
            key={s.stock_key}
            className="rounded-full bg-zinc-900 px-3 py-1 text-zinc-200"
          >
            {s.stock_key}: {s.price}
          </div>
        ))}
        {stocks.length === 0 && (
          <p className="text-zinc-400">주가 데이터가 없습니다.</p>
        )}
      </div>
    </section>
  );
}
