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
    <section className="space-y-2 text-sm">
      <h2 className="text-base font-semibold">주가</h2>
      <div className="flex flex-wrap gap-2 text-sm">
        {stocks.map((s) => (
          <div
            key={s.stock_key}
            className="flex items-center gap-2 rounded-full bg-zinc-900 px-3 py-1 text-zinc-200"
          >
            {getStockLogoSrc(s.stock_key) && (
              <div className="relative h-6 w-6 overflow-hidden rounded-md bg-zinc-800">
                <Image
                  src={getStockLogoSrc(s.stock_key)!}
                  alt={s.stock_key}
                  fill
                  className="object-cover"
                />
              </div>
            )}
            <span>{s.stock_key}</span>
            <span className="ml-1 text-emerald-300">{s.price}</span>
          </div>
        ))}
        {stocks.length === 0 && (
          <p className="text-zinc-400">주가 데이터가 없습니다.</p>
        )}
      </div>
    </section>
  );
}
