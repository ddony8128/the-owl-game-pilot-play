import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = await request.json().catch(() => null);

  if (
    !body ||
    typeof body.rule_key !== "string" ||
    typeof body.is_open !== "boolean"
  ) {
    return NextResponse.json(
      { error: "rule_key and is_open are required" },
      { status: 400 }
    );
  }

  const rule_key = body.rule_key.trim();
  if (!rule_key) {
    return NextResponse.json(
      { error: "rule_key is required" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("rules_state")
    .update({ is_open: !body.is_open })
    .eq("rule_key", rule_key);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, rule_key, is_open: !body.is_open });
}
