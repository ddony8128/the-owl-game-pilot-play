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
  // 이미 이 라운드의 경제사범 처리(국채 조정/벌금/안내 메시지 등)를 한 번 수행했다면
  // 같은 라운드에 대해 중복으로 호출되더라도 두 번째부터는 아무 작업도 하지 않는다.
  const { data: existingResults, error: existingError } = await supabase
    .from("mafia_ability_results")
    .select("id, category")
    .eq("round_number", current.round_number)
    .eq("phase", "vote")
    .in("category", ["econ_mafia", "econ_not_mafia", "vote_no_econ"]);

  if (existingError) {
    throw new Error(
      existingError.message ??
        "경제사범 결과 여부 확인을 위해 능력 결과를 조회하지 못했습니다."
    );
  }

  if ((existingResults ?? []).length > 0) {
    // 이 라운드는 이미 경제사범 처리 로직을 한 번 수행한 상태이므로 재실행하지 않는다.
    return;
  }

  // 현재 라운드 투표 집계
  const { data: voteRows, error: votesError } = await supabase
    .from("mafia_votes")
    .select("round_number, target_id, vote_count")
    .eq("round_number", current.round_number);

  if (votesError) {
    throw new Error(votesError.message ?? "투표 기록을 불러오지 못했습니다.");
  }

  const votes = voteRows ?? [];
  // 공통: 경제사범이 뽑히지 않았을 때 모든 플레이어에게 안내 메시지를 남기는 함수
  const insertNoEconAbilityResult = async () => {
    const { data: stateRows, error: stateError } = await supabase
      .from("mafia_player_state")
      .select("player_id, job");

    if (stateError) {
      throw new Error(
        stateError.message ??
          "경제사범 부재 안내 메시지 생성을 위해 플레이어 상태를 조회하지 못했습니다."
      );
    }

    const abilityResults: Omit<MafiaAbilityResult, "id" | "created_at">[] = [];

    for (const row of (stateRows ?? []) as MafiaPlayerState[]) {
      if (!row.player_id) continue;
      abilityResults.push({
        player_id: row.player_id,
        round_number: current.round_number,
        phase: "vote",
        job: row.job,
        category: "vote_no_econ",
        message: "이번 라운드에는 경제사범이 뽑히지 않았습니다.",
        payload: null,
      });
    }

    if (abilityResults.length > 0) {
      const { error: abilityError } = await supabase
        .from("mafia_ability_results")
        .insert(abilityResults);

      if (abilityError) {
        throw new Error(
          abilityError.message ??
            "경제사범 부재 안내 메시지를 능력 결과로 기록하지 못했습니다."
        );
      }
    }
  };

  // 1) 아무도 투표하지 않은 경우
  if (votes.length === 0) {
    await insertNoEconAbilityResult();
    return;
  }

  const tally = new Map<string, number>();
  for (const v of votes) {
    // target_id는 players.id (uuid)를 담고 있다.
    const target = v.target_id as string | null;
    const count = typeof v.vote_count === "number" ? v.vote_count : 0;
    if (!target || count <= 0) continue;
    tally.set(target, (tally.get(target) ?? 0) + count);
  }

  // 2) 유효한 표(타깃/표 수)가 하나도 없는 경우
  if (tally.size === 0) {
    await insertNoEconAbilityResult();
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

  // 3) 공동 1위가 둘 이상이면 경제사범 없음
  if (topTargets.length !== 1) {
    await insertNoEconAbilityResult();
    return;
  }

  const econTargetId = topTargets[0]!;

  // 경제사범 플레이어 찾기 (target_id = players.id)
  const { data: econPlayerRow, error: econPlayerError } = await supabase
    .from("players")
    .select("id, nickname, created_at")
    .eq("id", econTargetId)
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
  const isMafia = econState.is_mafia;

  const abilityResults: Omit<MafiaAbilityResult, "id" | "created_at">[] = [];

  // 현재 국채 가격 조회
  const { data: bondRow, error: bondError } = await supabase
    .from("mafia_stock_state")
    .select("stock_key, price")
    .eq("stock_key", "국채")
    .maybeSingle();

  if (bondError) {
    throw new Error(bondError.message ?? "국채 가격을 조회하지 못했습니다.");
  }

  let currentBondPrice =
    bondRow && typeof bondRow.price === "number" ? bondRow.price : 0;
  if (currentBondPrice <= 0) {
    currentBondPrice = 5;
  }

  // 마피아가 경제사범으로 뽑힌 경우: 국채 가격 +1, 경제사범은 (상승한) 국채 가격만큼 벌금,
  // 그리고 시민/경찰에게 국채 지급
  if (isMafia) {
    const newBondPrice = currentBondPrice + 1;

    const { error: updateBondError } = await supabase
      .from("mafia_stock_state")
      .update({ price: newBondPrice })
      .eq("stock_key", "국채");

    if (updateBondError) {
      throw new Error(
        updateBondError.message ?? "국채 가격을 1 올리지 못했습니다."
      );
    }

    // 투표 결과(경제사범이 마피아인 경우)에 의해 변경된 국채 가격을
    // 주가 히스토리에도 남겨 둔다.
    const { error: historyError } = await supabase
      .from("mafia_stock_history")
      .insert({
        stock_key: "국채",
        round_number: current.round_number,
        price_before: currentBondPrice,
        price_after: newBondPrice,
        meta: {
          source: "vote_econ_mafia",
        },
      });

    if (historyError) {
      throw new Error(
        historyError.message ??
          "경제사범 투표 결과로 인한 국채 가격 변동 히스토리를 기록하지 못했습니다."
      );
    }

    // 경제사범은 (상승한) 국채 가격만큼 벌금
    const totalFine = newBondPrice;
    const nextCash = econState.cash - totalFine;
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
      category: "vote_fine_bond",
      message: `경제사범으로 지목되어 (상승한) 국채 가격 ${newBondPrice}원만큼 벌금을 내었습니다.`,
      payload: {
        nickname: econPlayer.nickname,
        bond_price: newBondPrice,
        total_fine: totalFine,
      },
    });

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
      // 기본 시민 국채 1개 + 경찰 추가 보너스 1개 (경찰은 총 2개)
      const extraForPolice = row.job === "police" ? 1 : 0;
      stocks["국채"] = { amount: prevAmount + 1 + extraForPolice };

      citizenUpdates.push({
        player_id: row.player_id,
        stocks,
      } as Partial<MafiaPlayerState>);
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

    // 모든 플레이어에게: 경제사범이 마피아이었고 시민에게 국채가 지급되었음을 안내
    const { data: allRows, error: allError } = await supabase
      .from("mafia_player_state")
      .select("player_id, job");

    if (allError) {
      throw new Error(
        allError.message ??
          "경제사범 안내 메시지를 위한 플레이어 조회에 실패했습니다."
      );
    }

    for (const row of (allRows ?? []) as MafiaPlayerState[]) {
      if (!row.player_id) continue;
      abilityResults.push({
        player_id: row.player_id,
        round_number: current.round_number,
        phase: "vote",
        job: row.job,
        category: "econ_mafia",
        message: `경제사범으로 지목되었던 ${econPlayer.nickname}은(는) 마피아였습니다. 국채 가격이 1 오르고, 모든 시민에게 국채가 지급되었습니다.`,
        payload: {
          econ_target_nickname: econPlayer.nickname,
        },
      });
    }
  } else {
    // 마피아가 아닌 경우: 기본 벌금 5원
    const baseFine = 5;
    const nextCash = econState.cash - baseFine;
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

    // 경제사범이 마피아가 아니면, 모든 플레이어에게 "마피아가 아니었다"는 안내 메시지를 남긴다.
    const { data: allRows, error: allError } = await supabase
      .from("mafia_player_state")
      .select("player_id, cash, is_mafia, job, stocks, updated_at");

    if (allError) {
      throw new Error(
        allError.message ?? "경제사범 안내를 위한 플레이어 조회에 실패했습니다."
      );
    }

    for (const row of (allRows ?? []) as MafiaPlayerState[]) {
      if (!row.player_id) continue;
      abilityResults.push({
        player_id: row.player_id,
        round_number: current.round_number,
        phase: "vote",
        job: row.job,
        category: "econ_not_mafia",
        message: `경제사범으로 지목되었던 ${econPlayer.nickname}은(는) 마피아가 아니었습니다.`,
        payload: {
          econ_target_nickname: econPlayer.nickname,
        },
      });
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
