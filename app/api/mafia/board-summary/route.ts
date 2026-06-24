import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeRoomCode } from "@/lib/rooms";

// 마피아 결과 페이지용 요약:
//  - finished: 본게임 마지막 라운드(5)의 'end' 페이즈에 도달했는지
//  - rounds: 라운드별 각 플레이어의 직업 + 자산(현금 + 보유주식 평가액)
//  - final: 라이브 상태 기준 최종 순위
// 게임 종료 전에는 라운드/직업/마피아를 공개하지 않는다(보드에서 대기 화면 표시).

const PHASE_RANK: Record<string, number> = {
  prepare: 0,
  auction: 1,
  trade: 2,
  apply: 3,
  vote: 4,
  end: 5,
};

const FINAL_MAIN_ROUND = 5;

type PlayerAsset = {
  player_id: string;
  nickname: string | null;
  job: string | null;
  is_mafia: boolean;
  cash: number;
  holdings_value: number;
  total_assets: number;
};

function isMafiaJob(job: string | null): boolean {
  return (
    job === "up_manipulator" ||
    job === "down_manipulator" ||
    job === "robber"
  );
}

function holdingsValue(
  stocks: unknown,
  priceByStock: Map<string, number>
): number {
  if (!stocks || typeof stocks !== "object") return 0;
  let v = 0;
  for (const [key, info] of Object.entries(
    stocks as Record<string, { amount?: number }>
  )) {
    const amount = info && typeof info.amount === "number" ? info.amount : 0;
    if (amount <= 0) continue;
    v += amount * (priceByStock.get(key) ?? 0);
  }
  return v;
}

export async function GET(request: Request) {
  const supabase = createServerSupabaseClient();
  const room = normalizeRoomCode(
    new URL(request.url).searchParams.get("room") ?? ""
  );
  if (!room) {
    return NextResponse.json({ error: "room 필요" }, { status: 400 });
  }

  // 페이즈/라운드 → 종료 판정
  const { data: phaseRow } = await supabase
    .from("mafia_phase_state")
    .select("round_number, phase")
    .eq("room_code", room)
    .maybeSingle();
  const currentRound =
    typeof phaseRow?.round_number === "number" ? phaseRow.round_number : 0;
  const currentPhase = (phaseRow?.phase as string | null) ?? null;
  const finished =
    currentRound >= FINAL_MAIN_ROUND && currentPhase === "end";

  // 플레이어 이름
  const { data: playerRows } = await supabase
    .from("players")
    .select("id, nickname")
    .eq("room_code", room);
  const nameById = new Map<string, string | null>();
  for (const p of (playerRows || []) as { id: string; nickname: string | null }[]) {
    nameById.set(p.id, p.nickname ?? null);
  }

  // 게임 종료 전에는 빈 결과만 반환(공개 금지)
  if (!finished) {
    return NextResponse.json({
      finished: false,
      currentRound,
      rounds: [],
      final: [],
    });
  }

  // 라이브 상태(최종 순위) + 현재 주가
  const [{ data: liveStates }, { data: liveStocks }] = await Promise.all([
    supabase
      .from("mafia_player_state")
      .select("player_id, job, is_mafia, cash, stocks")
      .eq("room_code", room),
    supabase
      .from("mafia_stock_state")
      .select("stock_key, price")
      .eq("room_code", room),
  ]);

  const finalPrice = new Map<string, number>();
  for (const s of (liveStocks || []) as { stock_key: string; price: number }[]) {
    finalPrice.set(s.stock_key, s.price);
  }

  const final: PlayerAsset[] = (
    (liveStates || []) as {
      player_id: string;
      job: string | null;
      is_mafia: boolean;
      cash: number;
      stocks: unknown;
    }[]
  )
    .map((p) => {
      const hv = holdingsValue(p.stocks, finalPrice);
      return {
        player_id: p.player_id,
        nickname: nameById.get(p.player_id) ?? null,
        job: p.job ?? null,
        is_mafia: !!p.is_mafia,
        cash: p.cash ?? 0,
        holdings_value: hv,
        total_assets: (p.cash ?? 0) + hv,
      };
    })
    .sort((a, b) =>
      b.total_assets !== a.total_assets
        ? b.total_assets - a.total_assets
        : b.cash - a.cash
    );

  // 라운드별 스냅샷(가장 진행된 페이즈) + 주가 히스토리
  const [{ data: snapRows }, { data: historyRows }] = await Promise.all([
    supabase
      .from("mafia_player_snapshots")
      .select("player_id, round_number, phase, cash, stocks, job")
      .eq("room_code", room),
    supabase
      .from("mafia_stock_history")
      .select("stock_key, round_number, price_after, id")
      .eq("room_code", room)
      .order("id", { ascending: true }),
  ]);

  // 라운드별 종료 시점 주가: 5원에서 시작해 라운드 순서대로 price_after를 누적 적용.
  const stockKeys = new Set<string>(finalPrice.keys());
  for (const h of (historyRows || []) as { stock_key: string | null }[]) {
    if (h.stock_key) stockKeys.add(h.stock_key);
  }
  const running = new Map<string, number>();
  for (const k of stockKeys) running.set(k, 5);
  const priceAtRound = new Map<number, Map<string, number>>();
  for (let r = 1; r <= FINAL_MAIN_ROUND; r++) {
    for (const h of (historyRows || []) as {
      stock_key: string | null;
      round_number: number;
      price_after: number | null;
    }[]) {
      if (
        h.round_number === r &&
        h.stock_key &&
        typeof h.price_after === "number"
      ) {
        running.set(h.stock_key, h.price_after);
      }
    }
    priceAtRound.set(r, new Map(running));
  }

  // 라운드별 플레이어 스냅샷에서 가장 진행된 페이즈를 선택
  type Snap = {
    player_id: string;
    round_number: number;
    phase: string | null;
    cash: number | null;
    stocks: unknown;
    job: string | null;
  };
  const bestByRoundPlayer = new Map<string, Snap>(); // key: `${round}:${player_id}`
  for (const s of (snapRows || []) as Snap[]) {
    if (s.round_number == null || !s.player_id) continue;
    const key = `${s.round_number}:${s.player_id}`;
    const prev = bestByRoundPlayer.get(key);
    if (
      !prev ||
      (PHASE_RANK[s.phase ?? "prepare"] ?? 0) >=
        (PHASE_RANK[prev.phase ?? "prepare"] ?? 0)
    ) {
      bestByRoundPlayer.set(key, s);
    }
  }

  const rounds: { round: number; players: PlayerAsset[] }[] = [];
  for (let r = 1; r <= FINAL_MAIN_ROUND; r++) {
    const priceMap = priceAtRound.get(r) ?? new Map<string, number>();
    const players: PlayerAsset[] = [];
    for (const pid of nameById.keys()) {
      const snap = bestByRoundPlayer.get(`${r}:${pid}`);
      if (!snap) continue;
      const cash = typeof snap.cash === "number" ? snap.cash : 0;
      const hv = holdingsValue(snap.stocks, priceMap);
      players.push({
        player_id: pid,
        nickname: nameById.get(pid) ?? null,
        job: snap.job ?? null,
        is_mafia: isMafiaJob(snap.job ?? null),
        cash,
        holdings_value: hv,
        total_assets: cash + hv,
      });
    }
    if (players.length > 0) {
      players.sort((a, b) => b.total_assets - a.total_assets);
      rounds.push({ round: r, players });
    }
  }

  return NextResponse.json({ finished: true, currentRound, rounds, final });
}
