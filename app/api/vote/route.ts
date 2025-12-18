import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Player } from "@/lib/types";

type Body = {
  nickname?: string;
  cunning1?: string;
  cunning2?: string;
  strategic1?: string;
  strategic2?: string;
  reason_cunning?: string;
  reason_strategic?: string;
};

type VoteResponse = { ok: true } | { error: string };

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await request.json().catch(() => null)) as Body | null;

  if (!body || typeof body.nickname !== "string") {
    return NextResponse.json(
      { error: "nickname is required" } as VoteResponse,
      { status: 400 }
    );
  }

  const { cunning1, cunning2, strategic1, strategic2 } = body;
  const reasonCunning = body.reason_cunning?.trim() ?? "";
  const reasonStrategic = body.reason_strategic?.trim() ?? "";

  if (reasonCunning.length < 5) {
    return NextResponse.json(
      { error: "reason_cunning must be at least 5 characters" } as VoteResponse,
      { status: 400 }
    );
  }

  if (reasonStrategic.length < 5) {
    return NextResponse.json(
      {
        error: "reason_strategic must be at least 5 characters",
      } as VoteResponse,
      { status: 400 }
    );
  }

  if (!cunning1 || !cunning2 || !strategic1 || !strategic2) {
    return NextResponse.json(
      { error: "all four target ids are required" } as VoteResponse,
      { status: 400 }
    );
  }

  const nickname = body.nickname.trim();

  const { data: voterRow, error: voterError } = await supabase
    .from("players")
    .select("id, nickname, is_finalist, created_at")
    .eq("nickname", nickname)
    .maybeSingle();

  if (voterError) {
    return NextResponse.json({ error: voterError.message } as VoteResponse, {
      status: 500,
    });
  }

  if (!voterRow) {
    return NextResponse.json(
      { error: "등록되지 않은 닉네임입니다." } as VoteResponse,
      { status: 403 }
    );
  }

  const voter = voterRow as Player;

  const inserts = [
    {
      topic: "most_cunning",
      voter_id: voter.id,
      target_id: cunning1,
      reason: reasonCunning,
    },
    {
      topic: "most_cunning",
      voter_id: voter.id,
      target_id: cunning2,
      reason: reasonCunning,
    },
    {
      topic: "most_strategic",
      voter_id: voter.id,
      target_id: strategic1,
      reason: reasonStrategic,
    },
    {
      topic: "most_strategic",
      voter_id: voter.id,
      target_id: strategic2,
      reason: reasonStrategic,
    },
  ];

  const { error: voteError } = await supabase
    .from("player_votes")
    .insert(inserts);

  if (voteError) {
    return NextResponse.json({ error: voteError.message } as VoteResponse, {
      status: 500,
    });
  }

  const summary = `vote: ${voter.nickname} -> cunning[${cunning1}, ${cunning2}] strategic[${strategic1}, ${strategic2}] / reason_cunning: ${reasonCunning} / reason_strategic: ${reasonStrategic}`;

  await supabase.from("gm_memo").insert({ content: summary });

  return NextResponse.json({ ok: true } as VoteResponse, { status: 200 });
}
