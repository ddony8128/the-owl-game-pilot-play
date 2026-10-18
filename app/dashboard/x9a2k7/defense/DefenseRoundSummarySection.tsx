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
  const [expandedMonsterIds, setExpandedMonsterIds] = useState<Set<string>>(
    () => new Set()
  );

  const selectedRoundRef = useRef<number | null>(null);
  selectedRoundRef.current = selectedRound;

  const load = async (round: number, silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
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

      if (round !== selectedRoundRef.current) return;
      setData(json);
      setError(null);
    } catch (e: unknown) {
      if (silent || round !== selectedRoundRef.current) return;
      const message =
        e instanceof Error
          ? e.message
          : "라운드 요약 정보를 불러오지 못했습니다.";
      setError(message);
      setData(null);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // 진행 중 제출이 보이도록 대시보드 상태 폴링(4초)과 같은 주기로 조용히 다시 불러온다.
  // silent 갱신은 로딩 표시·에러 초기화를 하지 않고, 라운드를 바꾼 뒤 늦게 온 응답은 버린다.
  useEffect(() => {
    if (selectedRound == null) return;
    const id = setInterval(() => void load(selectedRound, true), 4000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRound, room]);

  useEffect(() => {
    void load(selectedRound);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">라운드별 상황 요약</h2>
        <div className="flex flex-wrap items-center gap-2 text-base">
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
          <button
            type="button"
            onClick={() => void load(selectedRound)}
            disabled={loading}
            className="ml-1 rounded bg-zinc-800 px-3 py-1 text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
            title="현재 선택된 라운드 정보를 다시 불러옵니다"
          >
            ↻ 새로고침
          </button>
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
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-zinc-300">
                플레이어 행동
              </h3>
              <span className="text-xs text-zinc-500">
                제출 {data.players.filter((player) => player.action).length}/
                {data.players.length}
              </span>
            </div>
            {data.players.length === 0 ? (
              <p className="text-sm text-zinc-500">
                해당 라운드의 플레이어 정보가 없습니다.
              </p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/70 text-sm">
                <div className="hidden grid-cols-[minmax(7rem,1fr)_5rem_minmax(12rem,2fr)_4rem] gap-3 border-b border-zinc-800 bg-zinc-950/50 px-3 py-2 text-xs font-medium text-zinc-500 md:grid">
                  <span>플레이어</span>
                  <span>행동</span>
                  <span>내용</span>
                  <span className="text-right">점수</span>
                </div>
                <div className="divide-y divide-zinc-800">
                  {data.players.map((p) => {
                    const actionLabel = !p.action
                      ? "미제출"
                      : p.action.type === "rest"
                        ? "휴식"
                        : p.action.type === "training"
                          ? "훈련"
                          : p.action.type === "combat"
                            ? "전투"
                            : p.action.type;
                    const actionDetail = !p.action
                      ? "이 라운드에는 행동 기록이 없습니다."
                      : p.action.type === "rest"
                        ? p.action.restValues?.length
                          ? `카드 ${p.action.restValues.join(", ")} 활성화`
                          : "비활성 카드 활성화"
                        : p.action.type === "training"
                          ? `카드 ${p.action.trainingFromValue ?? "?"} 비활성 · ${p.action.trainingToBeforeValue ?? "?"}→${p.action.trainingToAfterValue ?? "?"} 강화`
                          : p.action.type === "combat"
                            ? `${p.action.targetMonsterName ?? "대상 없음"} · 카드 ${p.action.usedCardValue ?? "?"}`
                            : "세부 정보 없음";

                    return (
                      <div
                        key={p.player_id}
                        className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-3 py-2.5 md:grid-cols-[minmax(7rem,1fr)_5rem_minmax(12rem,2fr)_4rem]"
                      >
                        <span className="min-w-0 truncate font-semibold text-zinc-100">
                          {p.nickname ?? "(이름 없음)"}
                        </span>
                        <span className="text-right font-semibold text-amber-300 md:order-last">
                          {p.score ?? 0}점
                        </span>
                        <span
                          className={`w-fit rounded-full px-2 py-0.5 text-xs font-medium ${
                            !p.action
                              ? "bg-zinc-800 text-zinc-500"
                              : p.action.type === "combat"
                                ? "bg-red-950/70 text-red-300"
                                : p.action.type === "training"
                                  ? "bg-sky-950/70 text-sky-300"
                                  : "bg-emerald-950/70 text-emerald-300"
                          }`}
                        >
                          {actionLabel}
                        </span>
                        <span
                          className="min-w-0 truncate text-zinc-400"
                          title={actionDetail}
                        >
                          {actionDetail}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 몬스터 요약 */}
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-zinc-300">몬스터 현황</h3>
            {data.monsters.length === 0 ? (
              <p className="text-sm text-zinc-500">
                해당 라운드 스냅샷 시점에 남아 있는 몬스터가 없습니다.
              </p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/70 text-sm">
                <div className="hidden grid-cols-[minmax(10rem,2fr)_5rem_7rem_5rem_7rem] gap-3 border-b border-zinc-800 bg-zinc-950/50 px-3 py-2 text-xs font-medium text-zinc-500 md:grid">
                  <span>몬스터</span>
                  <span>HP</span>
                  <span>남은 라운드</span>
                  <span>점수</span>
                  <span className="text-right">공격자</span>
                </div>
                <div className="divide-y divide-zinc-800">
                  {data.monsters.map((m) => {
                    const expanded = expandedMonsterIds.has(m.instance_id);

                    return (
                      <div key={m.instance_id}>
                        <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-3 py-2.5 md:grid-cols-[minmax(10rem,2fr)_5rem_7rem_5rem_7rem]">
                          <span className="min-w-0 truncate font-semibold text-zinc-100">
                            {m.name}
                            <span className="ml-1.5 text-xs font-normal text-zinc-500">
                              슬롯 {m.slot_index + 1}
                            </span>
                          </span>
                          <button
                            type="button"
                            aria-expanded={expanded}
                            onClick={() =>
                              setExpandedMonsterIds((current) => {
                                const next = new Set(current);
                                if (next.has(m.instance_id)) {
                                  next.delete(m.instance_id);
                                } else {
                                  next.add(m.instance_id);
                                }
                                return next;
                              })
                            }
                            className="rounded-md bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-700 md:order-last md:text-right"
                          >
                            공격자 {m.attackers.length}명 {expanded ? "접기" : "보기"}
                          </button>
                          <span className="col-span-2 text-xs text-zinc-400 md:hidden">
                            HP {m.current_hp} · 잔여 {m.remaining_time}R ·{" "}
                            <span className="font-semibold text-amber-300">
                              +{m.points}점
                            </span>
                          </span>
                          <span className="hidden text-zinc-300 md:inline">
                            {m.current_hp}
                          </span>
                          <span className="hidden text-zinc-300 md:inline">
                            {m.remaining_time}R
                          </span>
                          <span className="hidden font-semibold text-amber-300 md:inline">
                            +{m.points}점
                          </span>
                        </div>

                        {expanded && (
                          <div className="border-t border-zinc-800/80 bg-zinc-950/40 px-3 py-2">
                            {m.attackers.length === 0 ? (
                              <p className="text-xs text-zinc-500">
                                공격한 플레이어가 없습니다.
                              </p>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {m.attackers.map((a, idx) => (
                                  <span
                                    key={`${a.player_id}-${idx}`}
                                    className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300"
                                  >
                                    {a.nickname ?? "(이름 없음)"} · 카드{" "}
                                    {a.usedCardValue ?? "?"}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}


