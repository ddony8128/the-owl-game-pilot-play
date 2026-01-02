import type { Player } from "@/lib/types";

type Props = {
  players: Player[];
};

// finalist 상태는 DB 등 외부에서 관리하고,
// 대시보드에서는 읽기 전용으로만 표시합니다.
export function FinalistsSection({ players }: Props) {
  return (
    <section>
      <h2 className="mb-2 text-base font-semibold">결승 진출자</h2>
      <p className="text-xs text-zinc-400">
        현재 버전에서는 결승 진출자 정보를 별도로 관리하지 않습니다.
      </p>
    </section>
  );
}
