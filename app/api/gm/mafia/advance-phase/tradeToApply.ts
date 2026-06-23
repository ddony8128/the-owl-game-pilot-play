import type {
  MafiaAbilityResult,
  MafiaAction,
  MafiaPhaseState,
  MafiaPlayerState,
  MafiaStockState,
  Player,
} from "@/lib/types";
import type { MafiaAbilityPayload } from "@/lib/mafia/abilities";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

export async function handleTradeToApply(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  current: MafiaPhaseState,
  room: string
) {
  // 현재 주가 조회
  const { data: stockRows, error: stockError } = await supabase
    .from("mafia_stock_state")
    .select("stock_key, price, updated_at")
    .eq("room_code", room);

  if (stockError || !stockRows) {
    throw new Error(
      stockError?.message ?? "mafia_stock_state 조회에 실패했습니다."
    );
  }

  const stockMap = new Map<string, MafiaStockState>();
  for (const row of stockRows as MafiaStockState[]) {
    stockMap.set(row.stock_key, row);
  }

  // trade 단계 액션 조회 (buy/sell/ability)
  const { data: actionRows, error: actionsError } = await supabase
    .from("mafia_actions")
    .select("player_id, round_number, phase, action_type, payload, created_at")
    .eq("room_code", room)
    .eq("round_number", current.round_number)
    .eq("phase", current.phase);

  if (actionsError) {
    throw new Error(
      actionsError.message ?? "trade 액션을 불러오지 못했습니다."
    );
  }

  const actions = (actionRows || []) as MafiaAction[];

  // 플레이어 상태 조회 (cash, job, stocks, is_mafia)
  const { data: playerStateRows, error: playerStateError } = await supabase
    .from("mafia_player_state")
    .select("player_id, cash, is_mafia, job, stocks, updated_at")
    .eq("room_code", room);

  if (playerStateError) {
    throw new Error(
      playerStateError.message ?? "mafia_player_state 조회에 실패했습니다."
    );
  }

  const playerStates = (playerStateRows || []) as MafiaPlayerState[];
  const playerStateById = new Map<string, MafiaPlayerState>();
  for (const p of playerStates) {
    playerStateById.set(p.player_id, p);
  }

  // 플레이어 기본 정보 (닉네임 매핑용)
  const { data: playerRows, error: playersError } = await supabase
    .from("players")
    .select("id, nickname, created_at")
    .eq("room_code", room);

  if (playersError || !playerRows) {
    throw new Error(playersError?.message ?? "players 조회에 실패했습니다.");
  }

  const players = playerRows as Player[];
  const idByNickname = new Map<string, string>();
  const nicknameById = new Map<string, string>();
  for (const p of players) {
    idByNickname.set(p.nickname, p.id);
    nicknameById.set(p.id, p.nickname);
  }

  type TradeAgg = { buy: number; sell: number };
  const buyVolumeByStock = new Map<string, number>();
  const sellVolumeByStock = new Map<string, number>();
  const tradeByPlayerStock = new Map<string, Map<string, TradeAgg>>();
  const tradeValueByStock = new Map<string, number>();

  // 이번 라운드 수익(매도 수익 + 직업 능력 수익) - 강도 계산용
  const roundIncomeForRobber = new Map<string, number>();

  // 직업 능력 payload
  const abilitiesByPlayer = new Map<string, MafiaAbilityPayload[]>();

  const abilityResults: Omit<
    MafiaAbilityResult,
    "id" | "created_at" | "room_code"
  >[] = [];

  const addIncome = (playerId: string, amount: number) => {
    if (!amount) return;
    const prev = roundIncomeForRobber.get(playerId) ?? 0;
    roundIncomeForRobber.set(playerId, prev + amount);
  };

  // trade 액션 순회
  for (const a of actions) {
    if (!a.player_id) continue;
    const playerId = a.player_id;

    if (a.action_type === "buy" || a.action_type === "sell") {
      const payload = (a.payload ?? {}) as {
        stock_key?: string;
        amount?: number;
      };
      const stockKey = payload.stock_key;
      const amount = typeof payload.amount === "number" ? payload.amount : 0;
      if (!stockKey || amount <= 0) continue;

      const stock = stockMap.get(stockKey);
      const priceBefore = stock?.price ?? 0;

      if (a.action_type === "buy") {
        const prev = buyVolumeByStock.get(stockKey) ?? 0;
        buyVolumeByStock.set(stockKey, prev + amount);
      } else if (a.action_type === "sell") {
        const prev = sellVolumeByStock.get(stockKey) ?? 0;
        sellVolumeByStock.set(stockKey, prev + amount);

        const revenue = amount * priceBefore;
        addIncome(playerId, revenue);
      }

      const perPlayer =
        tradeByPlayerStock.get(playerId) ?? new Map<string, TradeAgg>();
      if (!tradeByPlayerStock.has(playerId)) {
        tradeByPlayerStock.set(playerId, perPlayer);
      }
      const agg = perPlayer.get(stockKey) ?? { buy: 0, sell: 0 };
      if (a.action_type === "buy") {
        agg.buy += amount;
      } else {
        agg.sell += amount;
      }
      perPlayer.set(stockKey, agg);

      const tradeValue = amount * priceBefore;
      const prevValue = tradeValueByStock.get(stockKey) ?? 0;
      tradeValueByStock.set(stockKey, prevValue + tradeValue);
    } else if (a.action_type === "ability") {
      const payload = a.payload as MafiaAbilityPayload | null;
      if (!payload || typeof payload.job !== "string") continue;
      const list = abilitiesByPlayer.get(a.player_id) ?? [];
      if (!abilitiesByPlayer.has(a.player_id)) {
        abilitiesByPlayer.set(a.player_id, list);
      }
      list.push(payload);
    }
  }

  // 매수/매도량에 따른 기본 주가 변동
  const priceDeltaByStock = new Map<string, number>();

  // 최대 매수/매도 종목 계산용
  const buyEntries = Array.from(buyVolumeByStock.entries()).filter(
    ([, vol]) => vol > 0
  );
  const maxBuyStocks = new Set<string>();
  if (buyEntries.length > 0) {
    const distinctVolumes = Array.from(
      new Set(buyEntries.map(([, vol]) => vol))
    ).sort((a, b) => b - a);
    const top = distinctVolumes[0];
    const second = distinctVolumes[1];

    for (const [key, vol] of buyEntries) {
      if (vol === top) {
        maxBuyStocks.add(key);
        priceDeltaByStock.set(key, (priceDeltaByStock.get(key) ?? 0) + 2);
      } else if (second != null && vol === second) {
        priceDeltaByStock.set(key, (priceDeltaByStock.get(key) ?? 0) + 1);
      }
    }
  }

  const sellEntries = Array.from(sellVolumeByStock.entries()).filter(
    ([, vol]) => vol > 0
  );
  const maxSellStocks = new Set<string>();
  if (sellEntries.length > 0) {
    const maxSell = Math.max(...sellEntries.map(([, vol]) => vol));
    for (const [key, vol] of sellEntries) {
      if (vol === maxSell) {
        maxSellStocks.add(key);
        priceDeltaByStock.set(key, (priceDeltaByStock.get(key) ?? 0) - 1);
      }
    }
  }

  // 마피아 주가조작 능력 반영 (국채 제외) + 능력 결과 메시지
  const applyAbilityPriceChange = () => {
    for (const [playerId, abilities] of abilitiesByPlayer.entries()) {
      const pState = playerStateById.get(playerId);
      if (!pState) continue;
      for (const ability of abilities) {
        switch (ability.job) {
          case "up_manipulator": {
            const key = ability.stock_key;
            if (!key || !stockMap.has(key) || key === "국채") continue;
            let delta = 1;
            // 최대 매도 종목에 능력을 사용했으면 추가 +1
            if (maxSellStocks.has(key)) {
              delta += 1;
            }
            priceDeltaByStock.set(
              key,
              (priceDeltaByStock.get(key) ?? 0) + delta
            );

            // 능력 결과 기록: 상승 주가조작
            abilityResults.push({
              player_id: playerId,
              round_number: current.round_number,
              phase: "apply",
              job: "up_manipulator",
              category: "price_manipulation",
              message: `상승 주가조작 능력으로 ${key} 주가에 ${
                delta === 2 ? "2" : "1"
              } 만큼 상승 효과를 주었습니다.`,
              payload: {
                stock_key: key,
                delta,
              },
            });
            break;
          }
          case "down_manipulator": {
            const key = ability.stock_key;
            if (!key || !stockMap.has(key) || key === "국채") continue;
            let delta = -2;
            // 최대 매수 종목에 능력을 사용했으면 추가 -1
            if (maxBuyStocks.has(key)) {
              delta -= 1;
            }
            priceDeltaByStock.set(
              key,
              (priceDeltaByStock.get(key) ?? 0) + delta
            );

            // 능력 결과 기록: 하락 주가조작
            abilityResults.push({
              player_id: playerId,
              round_number: current.round_number,
              phase: "apply",
              job: "down_manipulator",
              category: "price_manipulation",
              message: `하락 주가조작 능력으로 ${key} 주가에 ${
                delta === -3 ? "3" : "2"
              } 만큼 하락 효과를 주었습니다.`,
              payload: {
                stock_key: key,
                delta,
              },
            });
            break;
          }
          default:
            break;
        }
      }
    }
  };

  applyAbilityPriceChange();

  // 새로운 주가 계산 및 최소 1원 보정
  const updatedStocks: MafiaStockState[] = [];
  for (const [key, stock] of stockMap.entries()) {
    const delta = priceDeltaByStock.get(key) ?? 0;
    let nextPrice = stock.price + delta;
    if (nextPrice < 1) nextPrice = 1;
    updatedStocks.push({
      ...stock,
      price: nextPrice,
    });
  }

  if (updatedStocks.length > 0) {
    const { error: updateStocksError } = await supabase
      .from("mafia_stock_state")
      .upsert(
        updatedStocks.map((s) => ({
          room_code: room,
          stock_key: s.stock_key,
          price: s.price,
        })),
        { onConflict: "room_code,stock_key" }
      );

    if (updateStocksError) {
      throw new Error(
        updateStocksError.message ?? "주가를 업데이트하지 못했습니다."
      );
    }

    // 주가 히스토리 기록 (라운드별 before/after)
    const historyRows = updatedStocks.map((s) => {
      const before = stockMap.get(s.stock_key)?.price ?? null;
      const after = s.price ?? null;
      return {
        room_code: room,
        stock_key: s.stock_key,
        round_number: current.round_number,
        price_before: before,
        price_after: after,
        meta: {},
      };
    });

    const { error: historyError } = await supabase
      .from("mafia_stock_history")
      .insert(historyRows);

    if (historyError) {
      throw new Error(
        historyError.message ?? "주가 히스토리를 기록하지 못했습니다."
      );
    }
  }

  // 직업별 현금 수익 및 강도 정산 + 능력결과 기록
  const cashDelta = new Map<string, number>();

  const addCash = (
    playerId: string,
    amount: number,
    isAbilityIncome: boolean,
    ability?: {
      job: string;
      category: string;
      message: string;
      payload?: Record<string, unknown> | null;
    }
  ) => {
    if (!amount) return;
    cashDelta.set(playerId, (cashDelta.get(playerId) ?? 0) + amount);
    if (isAbilityIncome) {
      addIncome(playerId, amount);
      if (ability) {
        abilityResults.push({
          player_id: playerId,
          round_number: current.round_number,
          phase: "apply",
          job: ability.job,
          category: ability.category,
          message: ability.message,
          payload: ability.payload ?? null,
        });
      }
    }
  };

  // 증권사 직원용: 종목별 총 거래금액
  const getBrokerReward = (stockKey: string): number => {
    const total = tradeValueByStock.get(stockKey) ?? 0;
    if (total <= 0) return 0;
    // 패치: 총 거래금액의 10%(버림)
    return Math.floor(total * 0.1);
  };

  // CEO, 월급쟁이, 경찰, 세무조사원, 시장, 증권사 직원 보너스
  for (const p of playerStates) {
    const job = p.job;
    const pid = p.player_id;
    if (!job) continue;

    switch (job) {
      case "ceo":
        addCash(pid, 10, true, {
          job: "ceo",
          category: "salary",
          message: "이번 라운드 월급으로 10원을 얻었습니다.",
        });
        break;
      case "salaryman":
        addCash(pid, 3, true, {
          job: "salaryman",
          category: "salary",
          message: "이번 라운드 월급으로 3원을 얻었습니다.",
        });
        break;
      case "police":
        addCash(pid, 5, true, {
          job: "police",
          category: "salary",
          message: "이번 라운드 월급으로 5원을 얻었습니다.",
        });
        break;
      case "mayor":
        addCash(pid, 5, true, {
          job: "mayor",
          category: "salary",
          message: "이번 라운드 월급으로 5원을 얻었습니다.",
        });
        break;
      case "tax_auditor":
        addCash(pid, 5, true, {
          job: "tax_auditor",
          category: "salary",
          message: "이번 라운드 월급으로 5원을 얻었습니다.",
        });
        break;
      case "broker": {
        const abilities = abilitiesByPlayer.get(pid) ?? [];
        const broker = abilities.find(
          (a): a is Extract<MafiaAbilityPayload, { job: "broker" }> =>
            a.job === "broker"
        );
        if (broker?.stock_key) {
          const reward = getBrokerReward(broker.stock_key);
          if (reward > 0) {
            addCash(pid, reward, true, {
              job: "broker",
              category: "broker_bonus",
              message: `증권사 직원: ${broker.stock_key} 주식 거래로 ${reward}원을 얻었습니다.`,
              payload: {
                stock_key: broker.stock_key,
                reward,
                total_trade: tradeValueByStock.get(broker.stock_key) ?? 0,
              },
            });
          }
        }
        break;
      }
      default:
        break;
    }
  }

  // CEO 능력: 자신을 제외한 한 사람에게 5원을 지급하고, 대상은 CEO가 누구인지 알게 된다.
  for (const p of playerStates) {
    if (p.job !== "ceo") continue;
    const pid = p.player_id;
    const abilities = abilitiesByPlayer.get(pid) ?? [];
    const ceoAbility = abilities.find(
      (a): a is Extract<MafiaAbilityPayload, { job: "ceo" }> => a.job === "ceo"
    );
    if (!ceoAbility) continue;

    const targetName = ceoAbility.target;
    const targetId = idByNickname.get(targetName) ?? null;
    if (!targetId || targetId === pid) {
      // 잘못된 대상 선택은 무시 (자기 자신 등)
      continue;
    }

    // 대상 플레이어에게 5원 지급 (능력 수익으로 취급)
    addCash(targetId, 5, true, {
      job: "ceo",
      category: "ceo_gift",
      message: `CEO로부터 5원을 받았습니다. (CEO: ${
        nicknameById.get(pid) ?? pid
      })`,
      payload: {
        from_ceo_player_id: pid,
        from_ceo_nickname: nicknameById.get(pid) ?? pid,
      },
    });

    // CEO 본인에게도 누구에게 줬는지 안내 메시지를 남긴다.
    abilityResults.push({
      player_id: pid,
      round_number: current.round_number,
      phase: "apply",
      job: "ceo",
      category: "ceo_gift",
      message: `이번 라운드에 ${targetName}에게 5원을 지급했습니다.`,
      payload: {
        target_nickname: targetName,
        target_player_id: targetId,
      },
    });
  }

  // 경찰 / 세무조사원 능력 결과 메시지
  for (const p of playerStates) {
    const pid = p.player_id;
    const abilities = abilitiesByPlayer.get(pid) ?? [];

    // 시장: 이번 라운드 표 가격 안내 (능력 사용 시)
    const mayorAbility = abilities.find(
      (a): a is Extract<MafiaAbilityPayload, { job: "mayor" }> =>
        a.job === "mayor"
    );
    if (mayorAbility) {
      const tp = mayorAbility.ticket_price;
      if (tp === 1 || tp === 2 || tp === 3) {
        abilityResults.push({
          player_id: pid,
          round_number: current.round_number,
          phase: "apply",
          job: "mayor",
          category: "ticket_price",
          message: `시장 능력으로 이번 라운드 표 가격이 ${tp}원으로 적용되었습니다.`,
          payload: {
            ticket_price: tp,
          },
        });
      }
    }

    // 경찰: 대상이 마피아인지 여부를 알려준다.
    const policeAbility = abilities.find(
      (a): a is Extract<MafiaAbilityPayload, { job: "police" }> =>
        a.job === "police"
    );
    if (policeAbility) {
      const targetsRaw = policeAbility.targets;
      const targetNames =
        Array.isArray(targetsRaw) && targetsRaw.length >= 2
          ? [...new Set(targetsRaw)].slice(0, 2)
          : [];

      if (targetNames.length !== 2) {
        abilityResults.push({
          player_id: pid,
          round_number: current.round_number,
          phase: "apply",
          job: "police",
          category: "police_check",
          message:
            "경찰 조사 결과: 유효한 두 명을 선택하지 않아 조사가 제대로 진행되지 않았습니다.",
          payload: null,
        });
      } else {
        const targetIds: (string | null)[] = targetNames.map(
          (name) => idByNickname.get(name) ?? null
        );
        const hasMafia = targetIds.some((tid) => {
          if (!tid) return false;
          const s = playerStateById.get(tid) ?? null;
          return !!s?.is_mafia;
        });

        abilityResults.push({
          player_id: pid,
          round_number: current.round_number,
          phase: "apply",
          job: "police",
          category: "police_check",
          message: `경찰 조사 결과: 선택한 두 사람 ${targetNames.join(
            ", "
          )} 중 마피아가 ${hasMafia ? "있습니다." : "없습니다."}`,
          payload: {
            target_nicknames: targetNames,
            target_player_ids: targetIds,
            has_mafia: hasMafia,
          },
        });
      }
    }

    // 세무조사원: 대상의 보유 주식 및 이번 라운드 거래 내역을 알려준다.
    const taxAbility = abilities.find(
      (a): a is Extract<MafiaAbilityPayload, { job: "tax_auditor" }> =>
        a.job === "tax_auditor"
    );
    if (taxAbility) {
      const targetsRaw = taxAbility.targets;
      const targetNames =
        Array.isArray(targetsRaw) && targetsRaw.length >= 2
          ? [...new Set(targetsRaw)].slice(0, 2)
          : [];

      if (targetNames.length !== 2) {
        abilityResults.push({
          player_id: pid,
          round_number: current.round_number,
          phase: "apply",
          job: "tax_auditor",
          category: "tax_audit",
          message:
            "세무조사 결과: 유효한 두 명을 선택하지 않아 조사가 제대로 진행되지 않았습니다.",
          payload: null,
        });
      } else {
        const lines: string[] = [];
        const targetsPayload: {
          target_nickname: string | null;
          target_player_id: string | null;
        }[] = [];

        targetNames.forEach((targetName) => {
          const targetId = idByNickname.get(targetName) ?? null;
          const targetState = targetId
            ? playerStateById.get(targetId) ?? null
            : null;

          if (!targetId || !targetState) {
            lines.push(
              `세무조사 결과: ${targetName}의 정보를 찾을 수 없어 조사에 실패했습니다.`
            );
            targetsPayload.push({
              target_nickname: targetName,
              target_player_id: targetId,
            });
            lines.push("");
            return;
          }

          const rawStocks = (targetState as unknown as { stocks?: unknown })
            .stocks;
          const stocks: Record<string, { amount: number }> =
            rawStocks && typeof rawStocks === "object"
              ? { ...(rawStocks as Record<string, { amount: number }>) }
              : {};

          const trades =
            tradeByPlayerStock.get(targetId) ?? new Map<string, TradeAgg>();

          const displayName =
            nicknameById.get(targetId) ??
            targetName ??
            targetId ??
            "알 수 없음";

          lines.push(
            `세무조사 결과: ${displayName}의 보유 주식과 이번 라운드 거래 내역입니다.`
          );
          lines.push("");
          lines.push("보유 주식:");

          const holdingEntries = Object.entries(stocks);
          if (holdingEntries.length === 0) {
            lines.push("- 보유 주식 없음");
          } else {
            for (const [stockKey, info] of holdingEntries) {
              const amt =
                typeof info?.amount === "number" && info.amount > 0
                  ? info.amount
                  : 0;
              lines.push(`- ${stockKey}: ${amt}주`);
            }
          }

          lines.push("");
          lines.push("이번 라운드 매수/매도:");
          if (trades.size === 0) {
            lines.push("- 거래 내역 없음");
          } else {
            for (const [stockKey, agg] of trades.entries()) {
              lines.push(`- ${stockKey}: 매수 ${agg.buy} / 매도 ${agg.sell}`);
            }
          }

          lines.push("");
          targetsPayload.push({
            target_nickname: targetName,
            target_player_id: targetId,
          });
        });

        const message = lines.join("\n");

        abilityResults.push({
          player_id: pid,
          round_number: current.round_number,
          phase: "apply",
          job: "tax_auditor",
          category: "tax_audit",
          message,
          payload: {
            targets: targetsPayload,
          },
        });
      }
    }
  }

  // 강도 정산
  for (const p of playerStates) {
    if (p.job !== "robber") continue;
    const pid = p.player_id;
    const abilities = abilitiesByPlayer.get(pid) ?? [];
    const robberAbility = abilities.find(
      (a): a is Extract<MafiaAbilityPayload, { job: "robber" }> =>
        a.job === "robber"
    );
    if (!robberAbility) continue;

    const [t1Name, t2Name] = robberAbility.targets;
    const t1Id = idByNickname.get(t1Name) ?? null;
    const t2Id = idByNickname.get(t2Name) ?? null;

    const targets = [t1Id, t2Id].filter(
      (id): id is string => !!id && id !== pid
    );
    if (targets.length === 0) continue;

    let totalStolen = 0;
    const victimsPayload: { player_id: string; stolen: number }[] = [];
    for (const tid of targets) {
      const victimState = playerStateById.get(tid);
      if (!victimState) continue;

      // 시장은 강도 면역: 피해를 받지 않고, 강도가 누구인지 알게 된다.
      if (victimState.job === "mayor") {
        const robberName =
          nicknameById.get(pid) ?? playerStateById.get(pid)?.player_id ?? pid;
        abilityResults.push({
          player_id: tid,
          round_number: current.round_number,
          phase: "apply",
          job: "mayor",
          category: "robber_blocked",
          message: `강도의 공격을 막아냈습니다. 강도는 ${robberName}이었습니다.`,
          payload: {
            from_player_id: pid,
            from_player_nickname: robberName,
          },
        });
        continue;
      }

      const income = roundIncomeForRobber.get(tid) ?? 0;
      if (income <= 0) continue;

      // 패치: 각 대상의 이번 라운드 수익의 25%(버림)를 빼앗는다.
      const stolen = Math.floor(income * 0.25);
      if (stolen <= 0) continue;

      cashDelta.set(tid, (cashDelta.get(tid) ?? 0) - stolen);
      totalStolen += stolen;
      victimsPayload.push({ player_id: tid, stolen });

      // 피해자에게도 이번 라운드에 강도로 인해 얼마를 잃었는지 알려준다.
      const victimName = nicknameById.get(tid) ?? tid;
      abilityResults.push({
        player_id: tid,
        round_number: current.round_number,
        phase: "apply",
        job: victimState.job,
        category: "robber_victim",
        message: `이번 라운드에 강도로부터 ${stolen}원을 빼앗겼습니다.`,
        payload: {
          nickname: victimName,
          stolen,
        },
      });
    }

    if (totalStolen > 0) {
      cashDelta.set(pid, (cashDelta.get(pid) ?? 0) + totalStolen);

      // 강도 본인에게는 피해자별로 얼마를 빼앗았는지 상세히 알려준다.
      const victimSummaries = victimsPayload.map((v) => {
        const name = nicknameById.get(v.player_id) ?? v.player_id;
        return `${name}에게 ${v.stolen}원`;
      });
      const detailText =
        victimSummaries.length > 0 ? ` (${victimSummaries.join(", ")})` : "";

      abilityResults.push({
        player_id: pid,
        round_number: current.round_number,
        phase: "apply",
        job: "robber",
        category: "robber_gain",
        message: `강도로 총 ${totalStolen}원을 빼앗았습니다.${detailText}`,
        payload: {
          victims: victimsPayload,
        },
      });
    }
  }

  // 능력/강도로 인한 현금 변화만 반영 (주식 보유량은 trade 시점에 이미 반영됨)
  const updatedPlayers: Partial<MafiaPlayerState>[] = [];

  for (const p of playerStates) {
    const pid = p.player_id;
    const deltaCash = cashDelta.get(pid) ?? 0;

    if (deltaCash === 0) continue;

    const nextCash = p.cash + deltaCash;

    updatedPlayers.push({
      player_id: pid,
      room_code: room,
      cash: nextCash,
    } as Partial<MafiaPlayerState>);
  }

  if (updatedPlayers.length > 0) {
    const { error: updatePlayersError } = await supabase
      .from("mafia_player_state")
      .upsert(updatedPlayers, { onConflict: "player_id" });

    if (updatePlayersError) {
      throw new Error(
        updatePlayersError.message ??
          "플레이어 자산 상태를 업데이트하지 못했습니다."
      );
    }
  }

  if (abilityResults.length > 0) {
    const { error: abilityError } = await supabase
      .from("mafia_ability_results")
      .insert(abilityResults.map((r) => ({ ...r, room_code: room })));

    if (abilityError) {
      throw new Error(
        abilityError.message ?? "능력 결과를 기록하지 못했습니다."
      );
    }
  }
}
