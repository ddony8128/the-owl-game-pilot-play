import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  isTestConsoleEnabled,
  TEST_CONSOLE_DISABLED_MESSAGE,
} from "@/lib/test/guard";
import type { Player } from "@/lib/types";

// 테스트용 플레이어 생성.
// 본문 형태(택1):
//   { nickname: "철수" }                       // 단건
//   { nicknames: ["철수", "영희"] }            // 다건
//   { count: 8, prefix: "테스터" }             // prefix1..prefixN 자동 생성
//
// 닉네임이 이미 있으면 건너뛰고 기존 행을 반환한다(중복 생성 방지).
export async function POST(request: Request) {
  if (!isTestConsoleEnabled()) {
    return NextResponse.json(
      { error: TEST_CONSOLE_DISABLED_MESSAGE },
      { status: 403 }
    );
  }

  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as {
    nickname?: unknown;
    nicknames?: unknown;
    count?: unknown;
    prefix?: unknown;
  } | null;

  if (!body) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  // 생성 대상 닉네임 목록 구성
  let names: string[] = [];
  if (typeof body.nickname === "string" && body.nickname.trim()) {
    names = [body.nickname.trim()];
  } else if (Array.isArray(body.nicknames)) {
    names = body.nicknames
      .filter((n): n is string => typeof n === "string")
      .map((n) => n.trim())
      .filter(Boolean);
  } else if (typeof body.count === "number" && body.count > 0) {
    const count = Math.min(Math.trunc(body.count), 30); // 안전 상한
    const prefix =
      typeof body.prefix === "string" && body.prefix.trim()
        ? body.prefix.trim()
        : "테스터";
    names = Array.from({ length: count }, (_, i) => `${prefix}${i + 1}`);
  }

  // 중복 제거
  names = Array.from(new Set(names));

  if (names.length === 0) {
    return NextResponse.json(
      { error: "생성할 닉네임이 없습니다. (nickname / nicknames / count 중 하나)" },
      { status: 400 }
    );
  }

  // 이미 존재하는 닉네임 조회
  const { data: existingRows, error: existingError } = await supabase
    .from("players")
    .select("id, nickname, created_at")
    .in("nickname", names);

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const existing = (existingRows || []) as Player[];
  const existingNames = new Set(existing.map((p) => p.nickname));
  const toCreate = names.filter((n) => !existingNames.has(n));

  let created: Player[] = [];
  if (toCreate.length > 0) {
    const rows = toCreate.map((nickname) => ({
      id: randomUUID(),
      nickname,
      feather: 0,
    }));

    const { data: insertedRows, error: insertError } = await supabase
      .from("players")
      .insert(rows)
      .select("id, nickname, created_at");

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    created = (insertedRows || []) as Player[];
  }

  return NextResponse.json({
    ok: true,
    created,
    skipped: existing, // 이미 존재해 건너뛴 플레이어
  });
}
