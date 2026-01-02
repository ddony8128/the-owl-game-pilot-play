import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  Player,
  SubwayPlayerEvent,
  SubwayReport,
  SubwayPlayerState,
} from "@/lib/types";

type ReportBody = {
  nickname?: string;
  name?: string;
  content?: string;
};

type ReportPostResponse =
  | { ok: true; id: SubwayReport["id"]; status: SubwayReport["status"] }
  | { error: string };

type ReportGetResponse =
  | { report: Pick<SubwayReport, "id" | "status"> | null }
  | { error: string };

export async function GET(request: Request) {
  const supabase = createServerSupabaseClient();
  const { searchParams } = new URL(request.url);
  const idParam = searchParams.get("id");

  if (!idParam) {
    return NextResponse.json({ error: "id is required" } as ReportGetResponse, {
      status: 400,
    });
  }

  const { data, error } = await supabase
    .from("subway_reports")
    .select("id, status")
    .eq("id", idParam)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message } as ReportGetResponse, {
      status: 500,
    });
  }

  return NextResponse.json(
    {
      report: (data as Pick<SubwayReport, "id" | "status"> | null) ?? null,
    } as ReportGetResponse,
    { status: 200 }
  );
}

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as ReportBody | null;

  if (
    !body ||
    typeof body.name !== "string" ||
    typeof body.content !== "string"
  ) {
    return NextResponse.json(
      { error: "name and content are required" } as ReportPostResponse,
      { status: 400 }
    );
  }

  const reporterName = body.name.trim();
  const content = body.content.trim();

  if (reporterName.length < 2 || content.length < 2) {
    return NextResponse.json(
      {
        error: "닉네임과 내용을 2글자 이상 입력해 주세요.",
      } as ReportPostResponse,
      { status: 400 }
    );
  }

  let playerId: string | null = null;

  if (body.nickname && body.nickname.trim()) {
    const { data, error } = await supabase
      .from("players")
      .select("id, nickname, created_at")
      .eq("nickname", body.nickname.trim())
      .maybeSingle();

    if (!error && data) {
      playerId = (data as Player).id;
    }
  }

  // 기본적으로 신고는 기록해 둔다
  const { data, error: insertError } = await supabase
    .from("subway_reports")
    .insert({
      player_id: playerId,
      reporter_name: reporterName,
      content,
    })
    .select("id, status")
    .maybeSingle();

  if (insertError || !data) {
    return NextResponse.json(
      {
        error:
          insertError?.message ??
          "신고를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      } as ReportPostResponse,
      { status: 500 }
    );
  }

  // 추가 규칙: 신고된 플레이어가 03_capture_monster 에 있으면 규칙 4 공개
  let shouldApprove = false;

  if (playerId) {
    const { data: stateRow } = await supabase
      .from("subway_player_state")
      .select("player_id, current_location")
      .eq("player_id", playerId)
      .maybeSingle();

    const currentLocation = (
      stateRow as Pick<SubwayPlayerState, "current_location"> | null
    )?.current_location;

    if (currentLocation && currentLocation.includes("03_capture_monster")) {
      // 이미 규칙 4가 열려있는지 확인
      const { data: openedRows } = await supabase
        .from("subway_player_events")
        .select("event_value")
        .eq("player_id", playerId)
        .eq("event_type", "rule_opened");

      let hasRule4 = false;
      for (const row of (openedRows ?? []) as Pick<
        SubwayPlayerEvent,
        "event_value"
      >[]) {
        const v = row.event_value as { rule_id?: number } | null;
        if (v && v.rule_id === 4) {
          hasRule4 = true;
          break;
        }
      }

      if (!hasRule4) {
        await supabase.from("subway_player_events").insert({
          player_id: playerId,
          event_type: "rule_opened",
          event_value: { rule_id: 4, source: "report" },
        } as Partial<SubwayPlayerEvent>);
      }

      shouldApprove = true;
    }
  }

  const row = data as Pick<SubwayReport, "id" | "status">;
  const id = row.id;

  // 승인/기각 상태 자동 반영
  const nextStatus: SubwayReport["status"] = shouldApprove
    ? "approved"
    : "rejected";

  const { error: statusError } = await supabase
    .from("subway_reports")
    .update({
      status: nextStatus,
      decided_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (statusError) {
    return NextResponse.json(
      {
        error:
          statusError.message ??
          "신고 상태를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      } as ReportPostResponse,
      { status: 500 }
    );
  }

  return NextResponse.json(
    { ok: true, id, status: nextStatus } as ReportPostResponse,
    { status: 200 }
  );
}
