import { createServerSupabaseClient } from "@/lib/supabase/server";

// 혼동되기 쉬운 글자(0/O, 1/I) 제외
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 5;

export type RoomGame = "mafia" | "defense" | "subway";

export type Room = {
  code: string;
  game: RoomGame;
  status: "active" | "ended";
  ended_normally: boolean;
  created_at: string;
};

/** 방 코드 정규화(대문자, 공백 제거) */
export function normalizeRoomCode(input: string): string {
  return (input ?? "").trim().toUpperCase();
}

/** 무작위 방 코드 1개 생성 (index 로 결정성 부여 가능) */
export function randomRoomCode(seed: number[]): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += ALPHABET[seed[i] % ALPHABET.length];
  }
  return out;
}

/** 방별 초기 시드 값 */
export const MAFIA_STOCK_SEED: { stock_key: string; price: number }[] = [
  { stock_key: "부엉교육", price: 5 },
  { stock_key: "번쩍전기", price: 5 },
  { stock_key: "국채", price: 5 },
  { stock_key: "이상교통", price: 5 },
];

export const DEFENSE_MONSTER_COUNT_SEED: { id: number; count: number }[] = [
  { id: 1, count: 6 },
  { id: 2, count: 4 },
  { id: 3, count: 5 },
  { id: 4, count: 4 },
  { id: 5, count: 3 },
  { id: 6, count: 2 },
];

export const RULE_KEYS = ["intro", "subway", "mafia", "defense"] as const;

/** 방 코드로 방 조회 */
export async function getRoom(code: string): Promise<Room | null> {
  const normalized = normalizeRoomCode(code);
  if (!normalized) return null;
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("rooms")
    .select("code, game, status, ended_normally, created_at")
    .eq("code", normalized)
    .maybeSingle();
  return (data as Room | null) ?? null;
}

/** 중복되지 않는 방 코드 생성 */
export async function generateUniqueRoomCode(): Promise<string> {
  const supabase = createServerSupabaseClient();
  for (let attempt = 0; attempt < 20; attempt++) {
    // crypto 없이 결정적이지 않게: 현재 존재 코드와 충돌 시 재시도
    const seed = Array.from({ length: CODE_LENGTH }, () =>
      Math.floor(Math.random() * ALPHABET.length),
    );
    const code = randomRoomCode(seed);
    const { data } = await supabase
      .from("rooms")
      .select("code")
      .eq("code", code)
      .maybeSingle();
    if (!data) return code;
  }
  throw new Error("방 코드 생성 실패(충돌 과다)");
}

/**
 * 방 생성 + 해당 방의 게임 상태 시드.
 * 한 방 = 한 게임. game 에 따라 필요한 상태 행을 만든다.
 */
export async function createRoomWithSeed(game: RoomGame): Promise<Room> {
  const supabase = createServerSupabaseClient();
  const code = await generateUniqueRoomCode();

  const { data: room, error: roomErr } = await supabase
    .from("rooms")
    .insert({ code, game, status: "active", ended_normally: false })
    .select("code, game, status, ended_normally, created_at")
    .single();
  if (roomErr || !room) {
    throw new Error(roomErr?.message ?? "방 생성 실패");
  }

  // 방별 공통 상태
  await supabase
    .from("game_state")
    .insert({ room_code: code, active_game: game, timer_start: false });
  await supabase.from("rules_state").insert(
    RULE_KEYS.map((rule_key) => ({ room_code: code, rule_key, is_open: false })),
  );

  // 게임별 상태 시드
  if (game === "mafia") {
    await supabase
      .from("mafia_phase_state")
      .insert({ room_code: code, round_number: 0, phase: "prepare" });
    await supabase
      .from("mafia_stock_state")
      .insert(MAFIA_STOCK_SEED.map((s) => ({ ...s, room_code: code })));
  } else if (game === "defense") {
    await supabase
      .from("defense_phase_state")
      .insert({ room_code: code, round: 0 });
    await supabase
      .from("defense_monster_count")
      .insert(
        DEFENSE_MONSTER_COUNT_SEED.map((m) => ({ ...m, room_code: code })),
      );
  }

  return room as Room;
}
