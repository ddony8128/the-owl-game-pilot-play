import Image from "next/image";
import type { MafiaStockState } from "@/lib/types";

type Props = {
  stocks: MafiaStockState[];
};

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

export function MafiaStocksSection({ stocks }: Props) {
  return (
    <section className="space-y-3 text-sm">
      <div className="flex items-end justify-between">
        <div><p className="text-xs font-bold tracking-[0.18em] text-emerald-400">MARKET</p><h2 className="mt-1 text-lg font-black text-white">현재 주가</h2></div>
        <p className="text-xs text-zinc-500">현황 새로고침 시 갱신</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stocks.map((s) => (
          <div
            key={s.stock_key}
            className="flex min-h-20 items-center gap-3 rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-200"
          >
            {getStockLogoSrc(s.stock_key) && (
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-zinc-800">
                <Image
                  src={getStockLogoSrc(s.stock_key)!}
                  alt={s.stock_key}
                  fill
                  className="object-cover"
                />
              </div>
            )}
            <span className="min-w-0 flex-1 font-bold text-white">{s.stock_key}</span>
            <span className="text-2xl font-black tabular-nums text-emerald-300">{s.price}</span>
          </div>
        ))}
        {stocks.length === 0 && (
          <p className="text-zinc-400">주가 데이터가 없습니다.</p>
        )}
      </div>
    </section>
  );
}
