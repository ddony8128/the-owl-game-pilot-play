import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { MafiaLog, MafiaPhaseState } from "@/lib/types";

type Body = {
  content?: string;
};

type ResponseBody = { ok: true; log: MafiaLog } | { error: string };

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as Body | null;

  if (!body || typeof body.content !== "string" || !body.content.trim()) {
    return NextResponse.json({ error: "content is required" } as ResponseBody, {
      status: 400,
    });
  }

  // 현재 라운드/페이즈 정보를 함께 기록한다.
  const { data: phaseRow, error: phaseError } = await supabase
    .from("mafia_phase_state")
    .select("id, round_number, phase, updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (phaseError) {
    return NextResponse.json({ error: phaseError.message } as ResponseBody, {
      status: 500,
    });
  }

  const phase = (phaseRow || null) as MafiaPhaseState | null;
  if (!phase) {
    return NextResponse.json(
      { error: "mafia_phase_state가 초기화되지 않았습니다." } as ResponseBody,
      { status: 500 }
    );
  }

  const { data, error } = await supabase
    .from("mafia_public_logs")
    .insert({
      round_number: phase.round_number,
      phase: phase.phase,
      content: body.content.trim(),
    })
    .select("id, content, created_at")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      {
        error: error?.message ?? "로그를 추가하지 못했습니다.",
      } as ResponseBody,
      { status: 500 }
    );
  }

  return NextResponse.json(
    { ok: true, log: data as MafiaLog } as ResponseBody,
    { status: 200 }
  );
}
