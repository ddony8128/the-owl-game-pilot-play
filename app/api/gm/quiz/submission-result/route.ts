import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Body = {
  id?: number;
  result?: string;
};

type ResultResponse = { ok: true } | { error: string };

const ALLOWED_RESULTS = new Set(["correct", "wrong", "skip"]);

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as Body | null;

  if (!body || typeof body.id !== "number") {
    return NextResponse.json({ error: "id is required" } as ResultResponse, {
      status: 400,
    });
  }

  if (typeof body.result !== "string" || !ALLOWED_RESULTS.has(body.result)) {
    return NextResponse.json({ error: "invalid result" } as ResultResponse, {
      status: 400,
    });
  }

  const { error } = await supabase
    .from("quiz_submissions")
    .update({ result: body.result })
    .eq("id", body.id);

  if (error) {
    return NextResponse.json({ error: error.message } as ResultResponse, {
      status: 500,
    });
  }

  return NextResponse.json({ ok: true } as ResultResponse, { status: 200 });
}
