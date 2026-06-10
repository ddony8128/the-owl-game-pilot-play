import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  isTestConsoleEnabled,
  TEST_CONSOLE_DISABLED_MESSAGE,
} from "@/lib/test/guard";
import { resetScope } from "@/lib/admin/reset";

/**
 * POST /api/test/reset
 * body:
 *   { scope: "game", game: "subway" | "mafia" | "defense" | "vote" }
 *      → 해당 게임 런타임만 삭제 + 해당 게임 설정 초기화 (플레이어 유지)
 *   { scope: "runtime" }
 *      → 모든 게임 런타임 삭제 + 전체 설정 초기화 (플레이어 유지)
 *   { scope: "all" }
 *      → 모든 런타임 삭제 + 플레이어 전체 삭제 + 전체 설정 초기화 (완전 clean slate)
 */
export async function POST(request: Request) {
  if (!isTestConsoleEnabled()) {
    return NextResponse.json(
      { error: TEST_CONSOLE_DISABLED_MESSAGE },
      { status: 403 }
    );
  }

  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as {
    scope?: string;
    game?: string;
  } | null;

  const result = await resetScope(supabase, body?.scope, body?.game);

  if (result.badRequest) {
    return NextResponse.json({ error: result.badRequest }, { status: 400 });
  }
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, scope: body?.scope, errors: result.errors },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    scope: body?.scope,
    game: body?.game ?? null,
    warnings: result.warnings,
  });
}
