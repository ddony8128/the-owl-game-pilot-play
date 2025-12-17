import type {
  MafiaAbilityResult,
  MafiaPhaseState,
  MafiaPlayerState,
  Player,
} from "@/lib/types";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

export async function handleVoteToEnd(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  current: MafiaPhaseState
) {
  // 현재 라운드 투표 집계
  const { data: voteRows, error: votesError } = await supabase
    .from("mafia_votes")
    .select("round_number, target_id, vote_count")
    .eq("round_number", current.round_number);

  if (votesError) {
    throw new Error(votesError.message ?? "투표 기록을 불러오지 못했습니다.");
  }

  const votes = voteRows ?? [];
  if (votes.length === 0) {
    return;
  }

  const tally = new Map<string, number>();
  for (const v of votes) {
    const target = v.target_id as string | null;
    const count = typeof v.vote_count === "number" ? v.vote_count : 0;
    if (!target || count <= 0) continue;
    tally.set(target, (tally.get(target) ?? 0) + count);
  }

  if (tally.size === 0) {
    return;
  }

  // 최다 득표자 계산
  let maxVotes = 0;
  for (const [, cnt] of tally.entries()) {
    if (cnt > maxVotes) maxVotes = cnt;
  }
  if (maxVotes <= 0) return;

  const topTargets = Array.from(tally.entries())
    .filter(([, cnt]) => cnt === maxVotes)
    .map(([target]) => target);

  // 공동 1위가 둘 이상이면 경제사범 없음
  if (topTargets.length !== 1) {
    return;
  }

  const econTargetNickname = topTargets[0]!;

  // 경제사범 플레이어 찾기
  const { data: econPlayerRow, error: econPlayerError } = await supabase
    .from("players")
    .select("id, nickname, is_finalist, created_at")
    .eq("nickname", econTargetNickname)
    .maybeSingle();

  if (econPlayerError) {
    throw new Error(econPlayerError.message ?? "경제사범 플레이어 조회 실패");
  }
  if (!econPlayerRow) {
    return;
  }

  const econPlayer = econPlayerRow as Player;

  // 경제사범의 직업/마피아 여부 조회
  const { data: econStateRow, error: econStateError } = await supabase
    .from("mafia_player_state")
    .select("player_id, cash, is_mafia, job, stocks, updated_at")
    .eq("player_id", econPlayer.id)
    .maybeSingle();

  if (econStateError) {
    throw new Error(
      econStateError.message ?? "경제사범 자산 상태 조회에 실패했습니다."
    );
  }

  if (!econStateRow) {
    return;
  }

  const econState = econStateRow as MafiaPlayerState;
  const isMayor = econState.job === "mayor";
  const isMafia = econState.is_mafia;

  const abilityResults: Omit<MafiaAbilityResult, "id" | "created_at">[] = [];

  // 벌금 5원 (시장 직업자는 면제)
  if (!isMayor) {
    const nextCash = econState.cash - 5;
    const { error: updateFineError } = await supabase
      .from("mafia_player_state")
      .update({ cash: nextCash })
      .eq("player_id", econPlayer.id);

    if (updateFineError) {
      throw new Error(updateFineError.message ?? "벌금을 적용하지 못했습니다.");
    }

    abilityResults.push({
      player_id: econPlayer.id,
      round_number: current.round_number,
      phase: "vote",
      job: econState.job,
      category: "vote_fine",
      message: "경제사범으로 지목되어 벌금 5원을 잃었습니다.",
      payload: {
        nickname: econPlayer.nickname,
      },
    });
  }

  // 경제사범이 마피아이면 시민에게 국채 1개씩 지급
  if (isMafia) {
    const { data: citizenRows, error: citizenError } = await supabase
      .from("mafia_player_state")
      .select("player_id, cash, is_mafia, job, stocks, updated_at")
      .eq("is_mafia", false);

    if (citizenError) {
      throw new Error(
        citizenError.message ?? "시민 플레이어 조회에 실패했습니다."
      );
    }

    const citizenUpdates: Partial<MafiaPlayerState>[] = [];
    for (const row of (citizenRows ?? []) as MafiaPlayerState[]) {
      const rawStocks = (row as unknown as { stocks?: unknown }).stocks;
      const stocks: Record<string, { amount: number }> =
        rawStocks && typeof rawStocks === "object"
          ? { ...(rawStocks as Record<string, { amount: number }>) }
          : {};

      const prevAmount =
        typeof stocks["국채"]?.amount === "number" ? stocks["국채"].amount : 0;
      stocks["국채"] = { amount: prevAmount + 1 };

      citizenUpdates.push({
        player_id: row.player_id,
        stocks,
      } as Partial<MafiaPlayerState>);

      abilityResults.push({
        player_id: row.player_id,
        round_number: current.round_number,
        phase: "vote",
        job: row.job,
        category: "bond_bonus",
        message: "경제사범이 마피아이어서 국채 1개를 받았습니다.",
        payload: {
          econ_target_nickname: econPlayer.nickname,
        },
      });
    }

    if (citizenUpdates.length > 0) {
      const { error: updateCitizensError } = await supabase
        .from("mafia_player_state")
        .upsert(citizenUpdates, { onConflict: "player_id" });

      if (updateCitizensError) {
        throw new Error(
          updateCitizensError.message ?? "시민 국채 지급을 반영하지 못했습니다."
        );
      }
    }
  }

  if (abilityResults.length > 0) {
    const { error: abilityError } = await supabase
      .from("mafia_ability_results")
      .insert(abilityResults);

    if (abilityError) {
      throw new Error(
        abilityError.message ?? "능력 결과를 기록하지 못했습니다."
      );
    }
  }
}
