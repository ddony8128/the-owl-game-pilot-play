import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

interface QuizQuestionRow {
  id: number;
  question: string;
}

type QuestionsResponse =
  | { questions: { id: number; question: string }[] }
  | { error: string };

export async function GET() {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("quiz_questions")
    .select("id, question")
    .order("id", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message } as QuestionsResponse, {
      status: 500,
    });
  }

  const rows = (data || []) as QuizQuestionRow[];
  const questions = rows.map((q) => ({ id: q.id, question: q.question }));

  return NextResponse.json({ questions } as QuestionsResponse, { status: 200 });
}
