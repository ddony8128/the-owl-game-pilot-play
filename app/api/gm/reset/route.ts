import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resetScope } from "@/lib/admin/reset";

// GM 대시보드용 초기화. (난수 슬러그 대시보드에서만 노출되며 테스트 가드와 무관)
// body:
//   { scope: "runtime" } → 모든 런타임 삭제 + 전체 설정 초기화 (플레이어 유지)
//   { scope: "all" }     → 위 + 플레이어 전체 삭제 (완전 clean slate)
export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as {
    scope?: string;
  } | null;

  const scope = body?.scope;
  if (scope !== "runtime" && scope !== "all") {
    return NextResponse.json(
      { error: "scope 가 필요합니다. (runtime|all)" },
      { status: 400 }
    );
  }

  const result = await resetScope(supabase, scope);

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, scope, errors: result.errors },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, scope, warnings: result.warnings });
}
