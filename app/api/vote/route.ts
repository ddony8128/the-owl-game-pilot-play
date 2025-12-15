import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Player } from "@/lib/types";

type Body = {
  nickname?: string;
  set1A?: string;
  set1B?: string;
  set2A?: string;
  set2B?: string;
  reason?: string;
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

  const { set1A, set1B, set2A, set2B, reason } = body;

  if (!reason || reason.trim().length < 5) {
    return NextResponse.json(
      { error: "reason must be at least 5 characters" } as VoteResponse,
      { status: 400 }
    );
  }

  if (!set1A || !set1B || !set2A || !set2B) {
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
      topic: "set1",
      voter_id: voter.id,
      target_id: set1A,
      reason: reason.trim(),
    },
    {
      topic: "set1",
      voter_id: voter.id,
      target_id: set1B,
      reason: reason.trim(),
    },
    {
      topic: "set2",
      voter_id: voter.id,
      target_id: set2A,
      reason: reason.trim(),
    },
    {
      topic: "set2",
      voter_id: voter.id,
      target_id: set2B,
      reason: reason.trim(),
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

  const summary = `vote: ${
    voter.nickname
  } -> [${set1A}, ${set1B}] & [${set2A}, ${set2B}] / reason: ${reason.trim()}`;

  await supabase.from("gm_memo").insert({ content: summary });

  return NextResponse.json({ ok: true } as VoteResponse, { status: 200 });
}
