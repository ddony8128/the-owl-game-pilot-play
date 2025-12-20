import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { PlayerVote } from "@/lib/types";

type VoteSummary = {
  topic: string;
  target_id: string | null;
  target_nickname: string | null;
  votes: number;
  reasons: string[];
};

type GetResponse = { summaries: VoteSummary[] } | { error: string };

export async function GET() {
  const supabase = createServerSupabaseClient();

  const { data: voteData, error: voteError } = await supabase
    .from("player_votes")
    .select("id, voter_id, topic, target_id, reason, created_at");

  if (voteError) {
    return NextResponse.json({ error: voteError.message } as GetResponse, {
      status: 500,
    });
  }

  const { data: playerData, error: playerError } = await supabase
    .from("players")
    .select("id, nickname");

  if (playerError) {
    return NextResponse.json({ error: playerError.message } as GetResponse, {
      status: 500,
    });
  }

  const rows = (voteData || []) as PlayerVote[];
  const players = (playerData || []) as {
    id: string;
    nickname: string | null;
  }[];

  const nicknameById = new Map<string, string>();
  for (const p of players) {
    if (p.nickname) {
      nicknameById.set(p.id, p.nickname);
    }
  }

  const grouped = new Map<string, VoteSummary>();

  for (const row of rows) {
    const key = `${row.topic}__${row.target_id ?? "null"}`;
    const existing = grouped.get(key);
    const nickname =
      row.target_id != null ? nicknameById.get(row.target_id) ?? null : null;
    if (existing) {
      existing.votes += 1;
      existing.reasons.push(row.reason);
    } else {
      grouped.set(key, {
        topic: row.topic,
        target_id: row.target_id,
        target_nickname: nickname,
        votes: 1,
        reasons: [row.reason],
      });
    }
  }

  const summaries = Array.from(grouped.values()).sort((a, b) => {
    if (a.topic === b.topic) {
      return (b.votes ?? 0) - (a.votes ?? 0);
    }
    return a.topic.localeCompare(b.topic);
  });

  return NextResponse.json({ summaries } as GetResponse);
}
