import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeRoomCode } from "@/lib/rooms";
import type { MafiaPhaseState, Player } from "@/lib/types";
import { isValidNickname, normalizeNickname } from "@/lib/nickname";
import { isRequestIdShaped, parseRequestId } from "@/lib/requestId";
import { isUniqueViolation, parsePositiveInt, requireActiveRoom } from "@/lib/player/roomGuard";
import { casUpdate, computeTrade, normalizeStocks, type CasReadState } from "@/lib/mafia/cas";

// POST /api/mafia/action — 베팅(bet) · 매수/매도(buy/sell) · 능력(ability)
//  - 종료된 방 409 room_ended · 입력 열거/정수 검사(500 금지) · 닉네임 NFC 정규화
//  - request_id(선택): 같은 (방, 플레이어, request_id)는 한 번만 반영(응답 유실 재전송 멱등)
//  - 매수/매도는 cash CAS(읽은 값일 때만 갱신, 0행이면 다시 읽기)로 lost update 를 막는다
//  - 베팅·능력은 라운드/페이즈당 1회(유니크 인덱스가 동시 제출을 막는다)
type ActionBody = {
  room?: string;
  nickname?: string;
  type?: unknown;
  payload?: unknown;
  request_id?: unknown;
};

type ActionResponse = { ok: true; idempotent?: boolean } | { error: string; reason?: string };

const ACTION_TYPES = ["bet", "buy", "sell", "ability"] as const;
type ActionType = (typeof ACTION_TYPES)[number];
const MAX_AMOUNT = 100000;

const err = (status: number, error: string, reason?: string) =>
  NextResponse.json({ error, ...(reason ? { reason } : {}) } as ActionResponse, { status });

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as ActionBody | null;

  const room = normalizeRoomCode(body?.room ?? "");
  if (!room) return err(400, "room 필요", "bad_request");
  if (!body || typeof body.nickname !== "string") return err(400, "nickname is required", "bad_request");
  if (typeof body.type !== "string" || !(ACTION_TYPES as readonly string[]).includes(body.type.trim())) {
    return err(400, "type 은 bet | buy | sell | ability 중 하나여야 합니다.", "bad_request");
  }
  const nickname = normalizeNickname(body.nickname);
  if (!isValidNickname(nickname)) return err(400, "invalid nickname", "bad_request");
  const action_type = body.type.trim() as ActionType;
  if (body.request_id !== undefined && body.request_id !== null && !isRequestIdShaped(body.request_id)) {
    return err(400, "request_id 형식이 올바르지 않습니다.", "bad_request");
  }
  const requestId = parseRequestId(body.request_id);
  const payloadIn = (body.payload && typeof body.payload === "object" ? body.payload : {}) as Record<string, unknown>;

  const guard = await requireActiveRoom(supabase, room);
  if (!guard.ok) return NextResponse.json(guard.body, { status: guard.status });

  // 현재 phase/round 조회
  const { data: phaseRow, error: phaseError } = await supabase
    .from("mafia_phase_state")
    .select("room_code, round_number, phase, updated_at")
    .eq("room_code", room)
    .maybeSingle();
  if (phaseError) return err(500, phaseError.message);
  const phaseState = (phaseRow || null) as MafiaPhaseState | null;
  if (!phaseState) return err(500, "mafia_phase_state가 초기화되지 않았습니다.");

  const { data: playerRow, error: playerError } = await supabase
    .from("players")
    .select("id, nickname, created_at")
    .eq("room_code", room)
    .eq("nickname", nickname)
    .maybeSingle();
  if (playerError) return err(500, playerError.message);
  if (!playerRow) return err(403, "등록되지 않은 닉네임입니다.", "not_registered");
  const player = playerRow as Player;
  const phase = phaseState.phase;

  // 페이즈별로 허용되는 액션 제한
  const isAllowedAction =
    (phase === "auction" && action_type === "bet") ||
    (phase === "trade" && (action_type === "buy" || action_type === "sell" || action_type === "ability"));
  if (!isAllowedAction) {
    return err(400, "현재 페이즈에서는 이 행동을 할 수 없습니다.", "wrong_phase");
  }

  // 멱등: 같은 request_id 가 이미 반영됐으면 다시 하지 않는다.
  if (requestId) {
    const dup = await supabase
      .from("mafia_actions")
      .select("id")
      .eq("room_code", room)
      .eq("player_id", player.id)
      .eq("payload->>request_id", requestId)
      .maybeSingle();
    if (dup.error) return err(500, dup.error.message);
    if (dup.data) return NextResponse.json({ ok: true, idempotent: true } as ActionResponse, { status: 200 });
  }

  const insertAction = async (payload: Record<string, unknown>) =>
    supabase
      .from("mafia_actions")
      .insert({
        room_code: room,
        player_id: player.id,
        round_number: phaseState.round_number,
        phase: phaseState.phase,
        action_type,
        payload: requestId ? { ...payload, request_id: requestId } : payload,
      })
      .select("id")
      .maybeSingle();

  // 능력 사용: 라운드/페이즈당 1회
  if (action_type === "ability") {
    const existing = await supabase
      .from("mafia_actions")
      .select("id")
      .eq("room_code", room)
      .eq("player_id", player.id)
      .eq("round_number", phaseState.round_number)
      .eq("phase", phaseState.phase)
      .eq("action_type", "ability")
      .maybeSingle();
    if (existing.error) return err(500, existing.error.message);
    if (existing.data) return err(400, "이번 라운드에서는 이미 능력을 사용했습니다.", "already_used");
    if (typeof payloadIn.job !== "string") return err(400, "능력 payload 에 job 이 필요합니다.", "bad_request");

    const ins = await insertAction(payloadIn);
    if (ins.error) {
      if (isUniqueViolation(ins.error)) return err(400, "이번 라운드에서는 이미 능력을 사용했습니다.", "already_used");
      return err(500, ins.error.message);
    }
    return NextResponse.json({ ok: true } as ActionResponse, { status: 200 });
  }

  // 직업 경매 베팅: 라운드/페이즈당 1회
  if (action_type === "bet") {
    const existing = await supabase
      .from("mafia_actions")
      .select("id")
      .eq("room_code", room)
      .eq("player_id", player.id)
      .eq("round_number", phaseState.round_number)
      .eq("phase", phaseState.phase)
      .eq("action_type", "bet")
      .maybeSingle();
    if (existing.error) return err(500, existing.error.message);
    if (existing.data) return err(400, "이번 라운드에서는 이미 직업 경매에 베팅했습니다.", "already_bet");

    const giveUp = payloadIn.give_up === true;
    const job = typeof payloadIn.job === "string" && payloadIn.job.length > 0 ? payloadIn.job : null;
    let amount = 0;
    if (!giveUp) {
      // 정수만 받는다(1.5 같은 값은 400 — 입구에서 거른다)
      const parsed = parsePositiveInt(payloadIn.amount, MAX_AMOUNT);
      if (parsed == null || !job) return err(400, "유효한 베팅 금액을 입력해 주세요.", "bad_request");
      amount = parsed;

      const { data: stateRow, error: stateError } = await supabase
        .from("mafia_player_state")
        .select("player_id, cash")
        .eq("room_code", room)
        .eq("player_id", player.id)
        .maybeSingle();
      if (stateError) return err(500, stateError.message);
      const currentCash = stateRow && typeof stateRow.cash === "number" ? stateRow.cash : 0;
      if (amount > currentCash) return err(400, "보유 현금을 초과해서 베팅할 수 없습니다.", "insufficient_cash");
    }

    const ins = await insertAction(giveUp ? { job: null, give_up: true } : { job, amount });
    if (ins.error) {
      if (isUniqueViolation(ins.error)) return err(400, "이번 라운드에서는 이미 직업 경매에 베팅했습니다.", "already_bet");
      return err(500, ins.error.message);
    }
    return NextResponse.json({ ok: true } as ActionResponse, { status: 200 });
  }

  // 주식 거래: 즉시 현금/보유 주식에 반영(CAS)
  const stockKey = typeof payloadIn.stock_key === "string" && payloadIn.stock_key.length > 0 && payloadIn.stock_key.length <= 32 ? payloadIn.stock_key : null;
  const amount = parsePositiveInt(payloadIn.amount, MAX_AMOUNT); // 정수만(소수·음수·문자열 400)
  if (!stockKey || amount == null) return err(400, "유효한 종목과 수량을 입력해 주세요.", "bad_request");

  // 같은 라운드/페이즈/종목에 대해 매수·매도를 동시에 할 수 없음
  const oppositeType = action_type === "buy" ? "sell" : "buy";
  const opposite = await supabase
    .from("mafia_actions")
    .select("id")
    .eq("room_code", room)
    .eq("player_id", player.id)
    .eq("round_number", phaseState.round_number)
    .eq("phase", phaseState.phase)
    .eq("action_type", oppositeType)
    .eq("payload->>stock_key", stockKey)
    .maybeSingle();
  if (opposite.error) return err(500, opposite.error.message);
  if (opposite.data) {
    return err(400, "같은 라운드에서는 같은 종목을 매수와 매도 둘 다 할 수 없습니다.", "opposite_trade");
  }

  const { data: stockRow, error: stockError } = await supabase
    .from("mafia_stock_state")
    .select("stock_key, price")
    .eq("room_code", room)
    .eq("stock_key", stockKey)
    .maybeSingle();
  if (stockError) return err(500, stockError.message);
  const price = stockRow && typeof stockRow.price === "number" ? stockRow.price : 0;
  if (price <= 0) return err(400, "유효하지 않은 주가입니다.", "bad_request");

  const readState = async (): Promise<CasReadState | null> => {
    const { data, error } = await supabase
      .from("mafia_player_state")
      .select("player_id, cash, stocks")
      .eq("room_code", room)
      .eq("player_id", player.id)
      .maybeSingle();
    if (error || !data) return null;
    return {
      cash: typeof data.cash === "number" ? data.cash : 0,
      stocks: normalizeStocks((data as { stocks?: unknown }).stocks),
    };
  };
  const writeState = async (expectCash: number, next: CasReadState) => {
    const { data, error } = await supabase
      .from("mafia_player_state")
      .update({ cash: next.cash, stocks: next.stocks })
      .eq("room_code", room)
      .eq("player_id", player.id)
      .eq("cash", expectCash)
      .select("player_id");
    return { updated: data?.length ?? 0, error: error?.message ?? null };
  };

  const outcome = await casUpdate({
    read: readState,
    compute: (cur) => computeTrade(cur, { type: action_type, stockKey, amount, price }),
    write: writeState,
  });

  if (outcome.status === "missing") {
    return err(500, "플레이어 자산 상태가 초기화되지 않았습니다. GM에게 문의해 주세요.");
  }
  if (outcome.status === "rejected") return err(400, outcome.error, "insufficient");
  if (outcome.status === "db_error") return err(500, outcome.error);
  if (outcome.status === "exhausted") {
    return err(409, "거래가 몰려 처리하지 못했습니다. 다시 시도해 주세요.", "busy");
  }

  const ins = await insertAction({ stock_key: stockKey, amount, price, total: outcome.extra.total });
  if (ins.error) {
    // 기록 실패 → 현금/수량을 되돌린다(반대 거래를 CAS 로 적용).
    await casUpdate({
      read: readState,
      compute: (cur) => computeTrade(cur, { type: oppositeType, stockKey, amount, price }),
      write: writeState,
    });
    if (isUniqueViolation(ins.error)) {
      // 같은 request_id 가 동시에 두 번 → 먼저 간 요청이 반영됐으니 멱등 성공으로 답한다.
      return NextResponse.json({ ok: true, idempotent: true } as ActionResponse, { status: 200 });
    }
    return err(500, ins.error.message);
  }

  return NextResponse.json({ ok: true } as ActionResponse, { status: 200 });
}
