import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeRoomCode } from "@/lib/rooms";
import type { MafiaPhaseState, Player } from "@/lib/types";
import { isValidNickname, normalizeNickname } from "@/lib/nickname";
import { isRequestIdShaped, parseRequestId } from "@/lib/requestId";
import { isUniqueViolation, isUuid, parsePositiveInt, requireActiveRoom } from "@/lib/player/roomGuard";
import { casUpdate, computeVoteCost, normalizeStocks, type CasReadState } from "@/lib/mafia/cas";

// POST /api/mafia/vote — 경제사범 투표(여러 번 가능, 표값만큼 현금 차감)
//  - 종료된 방 409 · target_id uuid 형식 검사 · vote_count 정수 1~1000 · 닉네임 정규화
//  - request_id 멱등(mafia_votes.request_id 유니크) · 현금 차감은 CAS
type VoteBody = {
  room?: string;
  nickname?: string;
  target_id?: unknown;
  vote_count?: unknown;
  request_id?: unknown;
};

type VoteResponse = { ok: true; idempotent?: boolean } | { error: string; reason?: string };

const MAX_VOTES_PER_REQUEST = 1000;

const err = (status: number, error: string, reason?: string) =>
  NextResponse.json({ error, ...(reason ? { reason } : {}) } as VoteResponse, { status });

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as VoteBody | null;

  const room = normalizeRoomCode(body?.room ?? "");
  if (!room) return err(400, "room 필요", "bad_request");
  if (!body || typeof body.nickname !== "string") return err(400, "nickname is required", "bad_request");
  if (!isUuid(body.target_id)) return err(400, "target_id 가 올바르지 않습니다.", "bad_request");
  const vote_count = parsePositiveInt(body.vote_count, MAX_VOTES_PER_REQUEST);
  if (vote_count == null) return err(400, "vote_count 는 1 이상의 정수여야 합니다.", "bad_request");
  const nickname = normalizeNickname(body.nickname);
  if (!isValidNickname(nickname)) return err(400, "invalid nickname", "bad_request");
  if (body.request_id !== undefined && body.request_id !== null && !isRequestIdShaped(body.request_id)) {
    return err(400, "request_id 형식이 올바르지 않습니다.", "bad_request");
  }
  const requestId = parseRequestId(body.request_id);
  const targetId = body.target_id;

  const guard = await requireActiveRoom(supabase, room);
  if (!guard.ok) return NextResponse.json(guard.body, { status: guard.status });

  const { data: phaseRow, error: phaseError } = await supabase
    .from("mafia_phase_state")
    .select("room_code, round_number, phase, updated_at")
    .eq("room_code", room)
    .maybeSingle();
  if (phaseError) return err(500, phaseError.message);
  const phaseState = (phaseRow || null) as MafiaPhaseState | null;
  if (!phaseState) return err(500, "mafia_phase_state가 초기화되지 않았습니다.");
  if (phaseState.phase !== "vote") return err(400, "투표는 투표 단계에서만 할 수 있습니다.", "wrong_phase");

  const { data: playerRow, error: playerError } = await supabase
    .from("players")
    .select("id, nickname, created_at")
    .eq("room_code", room)
    .eq("nickname", nickname)
    .maybeSingle();
  if (playerError) return err(500, playerError.message);
  if (!playerRow) return err(403, "등록되지 않은 닉네임입니다.", "not_registered");
  const player = playerRow as Player;
  const roundNumber = phaseState.round_number;

  if (targetId === player.id) return err(400, "자기 자신에게는 투표할 수 없습니다.", "bad_request");

  // 투표 대상이 같은 방의 실제 플레이어인지 검증
  const { data: targetRow, error: targetError } = await supabase
    .from("players")
    .select("id")
    .eq("room_code", room)
    .eq("id", targetId)
    .maybeSingle();
  if (targetError) return err(500, targetError.message);
  if (!targetRow) return err(400, "투표 대상이 올바르지 않습니다.", "bad_request");

  // 멱등: 같은 request_id 는 한 번만
  if (requestId) {
    const dup = await supabase
      .from("mafia_votes")
      .select("id")
      .eq("room_code", room)
      .eq("voter_id", player.id)
      .eq("request_id", requestId)
      .maybeSingle();
    if (dup.error) return err(500, dup.error.message);
    if (dup.data) return NextResponse.json({ ok: true, idempotent: true } as VoteResponse, { status: 200 });
  }

  // 시장 능력에서 표 가격 결정: trade 페이즈 ability 중 job='mayor'의 ticket_price 사용, 없으면 1원
  let ticketPrice = 1;
  const { data: abilityRows, error: abilityError } = await supabase
    .from("mafia_actions")
    .select("payload")
    .eq("room_code", room)
    .eq("round_number", roundNumber)
    .eq("phase", "trade")
    .eq("action_type", "ability");
  if (!abilityError && abilityRows) {
    for (const row of abilityRows) {
      const payload = row.payload as { job?: string; ticket_price?: number } | null;
      if (payload?.job === "mayor") {
        const tp = payload.ticket_price;
        if (tp === 1 || tp === 2 || tp === 3) ticketPrice = tp;
      }
    }
  }

  const totalCost = ticketPrice * vote_count;

  const readState = async (): Promise<CasReadState | null> => {
    const { data, error } = await supabase
      .from("mafia_player_state")
      .select("player_id, cash, stocks")
      .eq("room_code", room)
      .eq("player_id", player.id)
      .maybeSingle();
    if (error || !data) return null;
    return { cash: typeof data.cash === "number" ? data.cash : 0, stocks: normalizeStocks((data as { stocks?: unknown }).stocks) };
  };
  const writeCash = async (expectCash: number, next: CasReadState) => {
    const { data, error } = await supabase
      .from("mafia_player_state")
      .update({ cash: next.cash })
      .eq("room_code", room)
      .eq("player_id", player.id)
      .eq("cash", expectCash)
      .select("player_id");
    return { updated: data?.length ?? 0, error: error?.message ?? null };
  };

  const outcome = await casUpdate({
    read: readState,
    compute: (cur) => computeVoteCost(cur, totalCost),
    write: writeCash,
  });
  if (outcome.status === "missing") return err(500, "플레이어 자산 상태가 초기화되지 않았습니다. GM에게 문의해 주세요.");
  if (outcome.status === "rejected") return err(400, outcome.error, "insufficient");
  if (outcome.status === "db_error") return err(500, outcome.error);
  if (outcome.status === "exhausted") return err(409, "투표가 몰려 처리하지 못했습니다. 다시 시도해 주세요.", "busy");

  const { error: insertError } = await supabase.from("mafia_votes").insert({
    room_code: room,
    round_number: roundNumber,
    voter_id: player.id,
    target_id: targetId,
    vote_count,
    unit_price: ticketPrice,
    request_id: requestId,
  });

  if (insertError) {
    // 기록 실패 → 차감한 현금을 되돌린다
    await casUpdate({
      read: readState,
      compute: (cur) => ({ ok: true, next: { cash: cur.cash + totalCost, stocks: cur.stocks }, extra: null }),
      write: writeCash,
    });
    if (isUniqueViolation(insertError)) {
      return NextResponse.json({ ok: true, idempotent: true } as VoteResponse, { status: 200 });
    }
    return err(500, insertError.message);
  }

  return NextResponse.json({ ok: true } as VoteResponse, { status: 200 });
}
