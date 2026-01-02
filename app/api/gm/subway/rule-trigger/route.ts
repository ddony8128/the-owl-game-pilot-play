import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SubwayPlayerEvent } from "@/lib/types";

type Body = {
  player_id?: string;
  trigger?: "meeting" | "food";
};

type ResponseBody = { ok: true } | { error: string };

const TRIGGER_RULE_MAP: Record<NonNullable<Body["trigger"]>, number> = {
  meeting: 2,
  food: 3,
};

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as Body | null;

  if (!body || typeof body.player_id !== "string") {
    return NextResponse.json(
      { error: "player_id is required" } as ResponseBody,
      { status: 400 }
    );
  }

  if (!body.trigger || !(body.trigger in TRIGGER_RULE_MAP)) {
    return NextResponse.json({ error: "invalid trigger" } as ResponseBody, {
      status: 400,
    });
  }

  const playerId = body.player_id;
  const ruleId = TRIGGER_RULE_MAP[body.trigger];

  // 이미 공개된 규칙인지 확인
  const { data, error } = await supabase
    .from("subway_player_events")
    .select("event_value")
    .eq("player_id", playerId)
    .eq("event_type", "rule_opened");

  if (error) {
    return NextResponse.json({ error: error.message } as ResponseBody, {
      status: 500,
    });
  }

  const opened = new Set<number>();
  for (const row of (data ?? []) as Pick<SubwayPlayerEvent, "event_value">[]) {
    const v = row.event_value as { rule_id?: number } | null;
    if (v && typeof v.rule_id === "number") {
      opened.add(v.rule_id);
    }
  }

  if (!opened.has(ruleId)) {
    await supabase.from("subway_player_events").insert({
      player_id: playerId,
      event_type: "rule_opened",
      event_value: { rule_id: ruleId, source: body.trigger },
    } as Partial<SubwayPlayerEvent>);
  }

  return NextResponse.json({ ok: true } as ResponseBody);
}
