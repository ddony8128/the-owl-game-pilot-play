import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { QuizQuestion } from "@/lib/types";

const TARGET_IDS = [7, 8, 9, 11, 12];

type QuestionsResponse = { questions: QuizQuestion[] } | { error: string };

type UpdateBody = {
  id?: number;
  question?: string;
  is_open?: boolean;
};

type UpdateResponse = { ok: true } | { error: string };

export async function GET() {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("quiz_questions")
    .select("id, question, options, correct_answer, is_open, updated_at")
    .in("id", TARGET_IDS)
    .order("id", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message } as QuestionsResponse, {
      status: 500,
    });
  }

  return NextResponse.json({ questions: (data || []) as QuizQuestion[] });
}

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as UpdateBody | null;

  if (!body || typeof body.id !== "number") {
    return NextResponse.json({ error: "id is required" } as UpdateResponse, {
      status: 400,
    });
  }

  const patch: Partial<Pick<QuizQuestion, "question" | "is_open">> = {};

  if (typeof body.question === "string") {
    patch.question = body.question;
  }

  if (typeof body.is_open === "boolean") {
    patch.is_open = body.is_open;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "no fields to update" } as UpdateResponse,
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("quiz_questions")
    .update(patch)
    .eq("id", body.id);

  if (error) {
    return NextResponse.json({ error: error.message } as UpdateResponse, {
      status: 500,
    });
  }

  return NextResponse.json({ ok: true } as UpdateResponse, { status: 200 });
}
