import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// 보존된 이상교통 플레이 기록 조회/내보내기.
//   GET /api/gm/subway/records            → 최신순 JSON
//   GET /api/gm/subway/records?format=csv → CSV 다운로드
const COLUMNS = [
  "archived_at",
  "session_id",
  "nickname",
  "final_exit",
  "reset_count",
  "is_finished",
  "finished_rank",
  "clear_seconds",
  "total_moves",
  "correct_moves",
  "wrong_moves",
  "forward_moves",
  "back_moves",
  "too_fast_count",
  "rules_discovered",
  "rules_discovered_ids",
  "reports_submitted",
  "wrong_by_reason",
  "wrong_by_group",
  "visit_by_group",
] as const;

function toCsvCell(value: unknown): string {
  if (value == null) return "";
  const raw =
    typeof value === "object" ? JSON.stringify(value) : String(value);
  // CSV 이스케이프
  return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

export async function GET(request: Request) {
  const supabase = createServerSupabaseClient();
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format");

  const { data, error } = await supabase
    .from("subway_play_records")
    .select("*")
    .order("archived_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as Record<string, unknown>[];

  if (format === "csv") {
    const header = COLUMNS.join(",");
    const body = rows
      .map((r) => COLUMNS.map((c) => toCsvCell(r[c])).join(","))
      .join("\n");
    const csv = `${header}\n${body}`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="subway_play_records.csv"',
      },
    });
  }

  return NextResponse.json({ records: rows });
}
