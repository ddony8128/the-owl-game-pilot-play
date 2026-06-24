import { useEffect, useRef, useState } from "react";

type RoundPlayerSummary = {
  player_id: string;
  nickname: string | null;
  action:
    | {
        type: string;
        targetMonsterName?: string | null;
        usedCardValue?: number | null;
        trainingFromValue?: number | null;
        trainingToBeforeValue?: number | null;
        trainingToAfterValue?: number | null;
        restValues?: number[] | null;
      }
    | null;
  score: number | null;
};

type RoundMonsterSummary = {
  instance_id: string;
  monster_id: number;
  name: string;
  description: string;
  slot_index: number;
  current_hp: number;
  remaining_time: number;
  points: number;
  attackers: {
    player_id: string;
    nickname: string | null;
    usedCardSlot: number | null;
    usedCardValue: number | null;
  }[];
};

type RoundState = {
  round: number;
  players: RoundPlayerSummary[];
  monsters: RoundMonsterSummary[];
} | null;

export function DefenseRoundSummarySection({
  room,
  currentRound,
}: {
  room: string;
  currentRound: number | null;
}) {
  // 대시보드의 현재 라운드(DB round)를 선택 가능한 라운드(1·2·4~15)로 매핑한다.
  const toSelectable = (r: number | null): number => {
    if (r == null || r <= 0) return 1; // 준비 단계
    if (r === 3) return 2; // 튜토리얼 결과 → 튜토리얼 2
    if (r >= 16) return 15; // 종료 → 마지막 라운드
    return r; // 1·2·4~15
  };

  const [selectedRound, setSelectedRound] = useState<number>(() =>
    toSelectable(currentRound)
  );
  const lastCurrentRef = useRef<number | null>(currentRound);
  const [data, setData] = useState<RoundState>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (round: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ round: String(round), room });
      const res = await fetch(
        `/api/gm/defense/round-state?${params.toString()}`
      );
      const json = (await res.json().catch(() => null)) as
        | {
            round: number;
            players: RoundPlayerSummary[];
            monsters: RoundMonsterSummary[];
            error?: undefined;
          }
        | { error: string }
        | null;

      if (!res.ok || !json || "error" in json) {
        throw new Error(
          (json as { error?: string })?.error ??
            "라운드 요약 정보를 불러오지 못했습니다."
        );
      }

      setData(json);
    } catch (e: unknown) {
      const message =
        e instanceof Error
          ? e.message
          : "라운드 요약 정보를 불러오지 못했습니다.";
      setError(message);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(selectedRound);
  }, [selectedRound]);

  // 대시보드의 현재 라운드가 바뀌면 자동으로 그 라운드로 따라간다.
  // (GM이 수동으로 다른 라운드를 골랐다면, 라운드가 다시 바뀔 때까지는 그 선택을 유지)
  useEffect(() => {
    if (currentRound !== lastCurrentRef.current) {
      lastCurrentRef.current = currentRound;
      setSelectedRound(toSelectable(currentRound));
    }
  }, [currentRound]);

  const getRoundLabel = (r: number) => {
    if (r === 1) return "튜토리얼 1라운드";
    if (r === 2) return "튜토리얼 2라운드";
    // DB round 4~15 -> 본게임 1~12라운드에 대응 (3은 튜토리얼 결과라 생략)
    const gameRound = r - 3;
    return `${gameRound}라운드`;
  };

  const roundLabel = getRoundLabel(selectedRound);

  return (
    <section className="space-y-3 text-base">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">라운드별 상황 요약</h2>
          <button
            type="button"
            onClick={() => void load(selectedRound)}
            disabled={loading}
            className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
            title="현재 선택된 라운드 정보를 다시 불러옵니다"
          >
            ↻ 새로고침
          </button>
        </div>
        <div className="flex items-center gap-2 text-base">
          <span className="text-sm text-zinc-400">라운드 선택:</span>
          {[1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((round) => (
            <button
              key={round}
              type="button"
              onClick={() => setSelectedRound(round)}
              className={`rounded-full px-3 py-1 text-sm ${
                selectedRound === round
                  ? "bg-amber-400 text-zinc-950"
                  : "bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              {getRoundLabel(round)}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <p className="text-sm text-zinc-400">
          {roundLabel} 정보를 불러오는 중입니다...
        </p>
      )}
      {error && (
        <p className="text-sm text-red-400">
          {roundLabel} 정보를 불러오지 못했습니다: {error}
        </p>
      )}

      {!loading && !error && data && (
        <div className="space-y-4 text-base">
          {/* 플레이어별 행동 요약 */}
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-zinc-300">
              플레이어별 행동 / 점수
            </h3>
            {data.players.length === 0 ? (
              <p className="text-sm text-zinc-500">
                해당 라운드의 플레이어 정보가 없습니다.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {data.players.map((p) => (
                  <div
                    key={p.player_id}
                    className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-base font-semibold">
                          {p.nickname ?? "(이름 없음)"}
                        </p>
                      </div>
                      <div className="text-right text-sm">
                        <p>
                          점수:{" "}
                          <span className="font-semibold">
                            {p.score ?? 0}점
                          </span>
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="mb-1 text-sm text-zinc-400">선택한 행동</p>
                      {!p.action ? (
                        <p className="text-sm text-zinc-500">
                          이 라운드에는 행동 기록이 없습니다.
                        </p>
                      ) : p.action.type === "rest" ? (
                        <p className="text-sm">
                          {p.action.restValues && p.action.restValues.length > 0
                            ? `휴식 – 값 ${p.action.restValues.join(
                                ", "
                              )} 카드를 다시 활성화했습니다.`
                            : "휴식 – 비활성화된 숫자 카드 중 일부를 다시 활성화했습니다."}
                        </p>
                      ) : p.action.type === "training" ? (
                        <p className="text-sm">
                          훈련 – 숫자{" "}
                          {p.action.trainingFromValue != null
                            ? p.action.trainingFromValue
                            : "?"}
                          {"  "}카드를 비활성화해 숫자{" "}
                          {p.action.trainingToBeforeValue != null
                            ? p.action.trainingToBeforeValue
                            : "?"}
                          {"  "}
                          카드를{" "}
                          {p.action.trainingToAfterValue != null
                            ? p.action.trainingToAfterValue
                            : "?"}
                          로 강화.
                        </p>
                      ) : p.action.type === "combat" ? (
                        <p className="text-sm">
                          전투 –{" "}
                          {p.action.targetMonsterName ??
                            "알 수 없는 몬스터"}
                          에게 숫자{" "}
                          {p.action.usedCardValue != null
                            ? p.action.usedCardValue
                            : "?"}
                          카드를 사용.
                        </p>
                      ) : (
                        <p className="text-sm">
                          {p.action.type} – 세부 정보 없음.
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 몬스터 요약 */}
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-zinc-300">
              몬스터 / 공격자 요약
            </h3>
            {data.monsters.length === 0 ? (
              <p className="text-sm text-zinc-500">
                해당 라운드 스냅샷 시점에 남아 있는 몬스터가 없습니다.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {data.monsters.map((m) => (
                  <div
                    key={m.instance_id}
                    className="space-y-1 rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">
                        {m.name} (슬롯 {m.slot_index + 1})
                      </span>
                      <span className="text-zinc-300">
                        HP {m.current_hp} · 잔여 {m.remaining_time} 라운드 ·{" "}
                        <span className="font-semibold text-amber-300">
                          +{m.points}점
                        </span>
                      </span>
                    </div>
                    <p className="text-sm text-zinc-400">{m.description}</p>
                    <div className="mt-1 space-y-1">
                      <p className="text-sm text-zinc-400">공격자 목록</p>
                      {m.attackers.length === 0 ? (
                        <p className="text-sm text-zinc-500">
                          이 몬스터를 공격한 플레이어가 없습니다.
                        </p>
                      ) : (
                        <ul className="space-y-0.5 text-sm">
                          {m.attackers.map((a, idx) => (
                            <li key={`${a.player_id}-${idx}`}>
                              {a.nickname ?? "(이름 없음)"} – 숫자{" "}
                              {a.usedCardValue != null
                                ? a.usedCardValue
                                : "?"}
                              카드 사용
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}


