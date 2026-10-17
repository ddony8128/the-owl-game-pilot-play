import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeRoomCode } from "@/lib/rooms";

/**
 * 디펜스 보드(빔) GM 자동 추종용 공개 상태 — Iteration 5 WS-C.
 * 보드는 이 응답의 round 를 폴링해 라운드가 바뀌면 자동으로 그 라운드 화면(전투 결과 → 점수 발표 → 대기열)으로 간다.
 * 공개 정보만 담는다: 라운드, 방 상태, 등록 인원 수(이름·행동·점수 없음).
 */
type DefenseBoardPhase = {
  round: number;
  updatedAt: string | null;
  roomStatus: "active" | "ended" | null;
  playerCount: number;
  serverNow: string;
};

export async function GET(request: Request) {
  const supabase = createServerSupabaseClient();
  const room = normalizeRoomCode(new URL(request.url).searchParams.get("room") ?? "");
  if (!room) {
    return NextResponse.json({ error: "room 필요" }, { status: 400 });
  }

  const [roomRes, phaseRes, playersRes] = await Promise.all([
    supabase.from("rooms").select("code, status, game").eq("code", room).maybeSingle(),
    supabase.from("defense_phase_state").select("round, updated_at").eq("room_code", room).maybeSingle(),
    supabase.from("players").select("id", { count: "exact", head: true }).eq("room_code", room),
  ]);

  if (roomRes.error) {
    return NextResponse.json({ error: roomRes.error.message }, { status: 500 });
  }
  if (!roomRes.data) {
    return NextResponse.json({ error: "방을 찾을 수 없습니다." }, { status: 404 });
  }
  if (phaseRes.error) {
    return NextResponse.json({ error: phaseRes.error.message }, { status: 500 });
  }

  const body: DefenseBoardPhase = {
    round: typeof phaseRes.data?.round === "number" ? phaseRes.data.round : 0,
    updatedAt: (phaseRes.data?.updated_at as string | null) ?? null,
    roomStatus: (roomRes.data.status as "active" | "ended" | null) ?? null,
    playerCount: playersRes.count ?? 0,
    serverNow: new Date().toISOString(),
  };
  return NextResponse.json(body);
}
