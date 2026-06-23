import { useEffect, useState } from "react";

type RoundPlayerSummary = {
  player_id: string;
  nickname: string | null;
  job: string | null;
  is_mafia: boolean;
  cash: number | null;
  stocks: Record<string, { amount: number }> | null;
  auction_bets: {
    job: string | null;
    amount: number;
    give_up: boolean;
  }[];
  abilities: {
    job: string | null;
    payload: Record<string, unknown>;
  }[];
  trades: {
    stock_key: string;
    buy: number;
    sell: number;
  }[];
  votes: {
    target_id: string | null;
    target_nickname: string | null;
    vote_count: number;
    unit_price: number;
  }[];
};

type RoundStockSummary = {
  stock_key: string;
  price_before: number | null;
  price_after: number | null;
  buy_volume: number;
  sell_volume: number;
  up_manipulators: { player_id: string; nickname: string | null }[];
  down_manipulators: { player_id: string; nickname: string | null }[];
};

type RoundVoteTally = {
  target_id: string | null;
  target_nickname: string | null;
  total_votes: number;
};

type RoundState = {
  round: number;
  players: RoundPlayerSummary[];
  stockSummary: RoundStockSummary[];
  voteTally: RoundVoteTally[];
} | null;

type Props = {
  currentRound: number | null | undefined;
  room: string;
};

export function MafiaRoundSummarySection({ currentRound, room }: Props) {
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [data, setData] = useState<RoundState>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (
      typeof currentRound === "number" &&
      currentRound >= 0 &&
      currentRound <= 5 &&
      selectedRound === null
    ) {
      setSelectedRound(currentRound);
    }
  }, [currentRound, selectedRound]);

  const load = async (round: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ round: String(round), room });
      const res = await fetch(`/api/gm/mafia/round-state?${params.toString()}`);
      const json = (await res.json().catch(() => null)) as
        | {
            round: number;
            players: RoundPlayerSummary[];
            stockSummary: RoundStockSummary[];
            voteTally: RoundVoteTally[];
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
    if (selectedRound == null) return;
    void load(selectedRound);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRound, room]);

  const roundLabel =
    selectedRound === 0
      ? "튜토리얼"
      : typeof selectedRound === "number"
      ? `${selectedRound}라운드`
      : "-";

  return (
    <section className="space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">라운드별 상황 요약</h2>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-sm text-zinc-400">라운드 선택:</span>
          {[0, 1, 2, 3, 4, 5].map((round) => (
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
              {round === 0 ? "튜토리얼" : `${round}라운드`}
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
        <div className="space-y-4 text-sm">
          {/* 플레이어별 카드 */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-zinc-300">
              플레이어별 요약
            </h3>
            {data.players.length === 0 ? (
              <p className="text-sm text-zinc-500">
                해당 라운드의 스냅샷이 없습니다.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {data.players.map((p) => (
                  <div
                    key={p.player_id}
                    className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">
                          {p.nickname ?? "(이름 없음)"}
                        </p>
                      </div>
                      <div className="text-right text-sm">
                        <p>
                          직업:{" "}
                          <span className="font-semibold">
                            {p.job ?? "월급쟁이"}
                          </span>
                        </p>
                        <p>
                          마피아:{" "}
                          <span className="font-semibold">
                            {p.is_mafia ? "예" : "아니오"}
                          </span>
                        </p>
                        <p>
                          현금:{" "}
                          <span className="font-semibold">
                            {p.cash ?? "-"}원
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* 경매 베팅 */}
                    <div>
                      <p className="mb-1 text-sm text-zinc-400">
                        경매 베팅
                      </p>
                      {p.auction_bets.length === 0 ? (
                        <p className="text-sm text-zinc-600">
                          베팅 내역이 없습니다.
                        </p>
                      ) : (
                        <ul className="space-y-0.5 text-sm">
                          {p.auction_bets.map((b, idx) => (
                            <li key={idx}>
                              {b.give_up
                                ? "포기"
                                : `${b.job ?? "직업 선택"}에 ${b.amount}원`}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* 능력 사용 */}
                    <div>
                      <p className="mb-1 text-sm text-zinc-400">
                        능력 사용
                      </p>
                      {p.abilities.length === 0 ? (
                        <p className="text-sm text-zinc-600">
                          능력 사용 내역이 없습니다.
                        </p>
                      ) : (
                        <ul className="space-y-0.5 text-sm">
                          {p.abilities.map((a, idx) => (
                            <li key={idx}>
                              {a.job ?? "능력"}{" "}
                              {typeof a.payload === "object"
                                ? JSON.stringify(a.payload)
                                : ""}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* 매수/매도 */}
                    <div>
                      <p className="mb-1 text-sm text-zinc-400">
                        매수 / 매도
                      </p>
                      {p.trades.length === 0 ? (
                        <p className="text-sm text-zinc-600">
                          거래 내역이 없습니다.
                        </p>
                      ) : (
                        <ul className="space-y-0.5 text-sm">
                          {p.trades.map((t) => (
                            <li key={t.stock_key}>
                              {t.stock_key}: 매수 {t.buy} / 매도 {t.sell}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* 투표 */}
                    <div>
                      <p className="mb-1 text-sm text-zinc-400">투표</p>
                      {p.votes.length === 0 ? (
                        <p className="text-sm text-zinc-600">
                          투표 내역이 없습니다.
                        </p>
                      ) : (
                        <ul className="space-y-0.5 text-sm">
                          {p.votes.map((v, idx) => (
                            <li key={idx}>
                              {v.target_nickname ?? "알 수 없음"}
                              에게 {v.vote_count}표 (표당 {v.unit_price}원)
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

          {/* 주가 변동 요약 */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-zinc-300">
              주가 변동 요인
            </h3>
            {data.stockSummary.length === 0 ? (
              <p className="text-sm text-zinc-500">
                해당 라운드의 주가 히스토리가 없습니다.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {data.stockSummary.map((s, idx) => (
                  <div
                    key={`${s.stock_key}-${idx}`}
                    className="space-y-1 rounded-lg border border-zinc-800 bg-zinc-900 p-3"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold">{s.stock_key}</span>
                      <span className="text-zinc-300">
                        {s.price_before ?? "-"} →{" "}
                        <span className="font-semibold text-amber-300">
                          {s.price_after ?? "-"}
                        </span>
                      </span>
                    </div>
                    <p className="text-sm text-zinc-400">
                      매수량 {s.buy_volume} / 매도량 {s.sell_volume}
                    </p>
                    {s.up_manipulators.length > 0 && (
                      <p className="text-sm text-emerald-300">
                        상승 조작자:{" "}
                        {s.up_manipulators
                          .map((m) => m.nickname ?? "(이름 없음)")
                          .join(", ")}
                      </p>
                    )}
                    {s.down_manipulators.length > 0 && (
                      <p className="text-sm text-red-300">
                        하락 조작자:{" "}
                        {s.down_manipulators
                          .map((m) => m.nickname ?? "(이름 없음)")
                          .join(", ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 투표 집계 */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-zinc-300">
              투표 집계 결과
            </h3>
            {data.voteTally.length === 0 ? (
              <p className="text-sm text-zinc-500">
                해당 라운드의 투표 기록이 없습니다.
              </p>
            ) : (
              <div className="space-y-1">
                {data.voteTally.map((t) => (
                  <div
                    key={t.target_id ?? "none"}
                    className="flex justify-between rounded-md bg-zinc-900 px-3 py-1.5 text-sm"
                  >
                    <span>
                      {t.target_nickname ?? "알 수 없음"}
                    </span>
                    <span className="font-semibold">{t.total_votes}표</span>
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
