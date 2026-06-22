import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resetScope } from "@/lib/admin/reset";

// GM 대시보드용 초기화. (난수 슬러그 대시보드에서만 노출되며 테스트 가드와 무관)
// body:
//   { scope: "game", game: "subway"|"mafia"|"defense"|"vote" }
//                        → 해당 게임 런타임만 삭제 + 해당 게임 설정 초기화 (플레이어 유지)
//   { scope: "runtime" } → 모든 런타임 삭제 + 전체 설정 초기화 (플레이어 유지)
//   { scope: "all" }     → 위 + 플레이어 전체 삭제 (완전 clean slate)
export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as {
    scope?: string;
    game?: string;
  } | null;

  const scope = body?.scope;
  const game = body?.game;

  const result = await resetScope(supabase, scope, game);

  // 잘못된 입력은 400 으로 구분해 돌려준다.
  if (result.badRequest) {
    return NextResponse.json({ error: result.badRequest }, { status: 400 });
  }

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, scope, errors: result.errors },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, scope, warnings: result.warnings });
}
