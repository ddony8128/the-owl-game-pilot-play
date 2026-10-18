type Props = {
  round: number | null;
  resultPending: boolean;
  scorePending: boolean;
  onAdvanceRound: (nextRound: number) => Promise<void>;
};

export function DefenseRoundSection({ round, resultPending, scorePending, onAdvanceRound }: Props) {
  const currentRound = typeof round === "number" ? round : 0;
  const nextRound = currentRound < 16 ? currentRound + 1 : null;
  const mainRound = currentRound >= 4 && currentRound <= 15 ? currentRound - 3 : null;
  const progress = currentRound === 16 ? 100 : mainRound ? Math.round((mainRound / 12) * 100) : 0;

  const getRoundLabel = (r: number) => {
    if (r === 0) return "준비";
    if (r === 1) return "튜토리얼 1라운드";
    if (r === 2) return "튜토리얼 2라운드";
    if (r === 3) return "튜토리얼 결과";
    if (r >= 4 && r <= 15) {
      const gameRound = r - 3; // 4~15 -> 1~12라운드
      return `${gameRound}라운드`;
    }
    if (r === 16) return "게임 종료";
    return `알 수 없음 (DB round ${r})`;
  };

  return (
    <section className="flex h-full flex-col space-y-5 text-base">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">현재 라운드</p>
        <p className="mt-1 text-4xl font-black text-white">{getRoundLabel(currentRound)}</p>
        {mainRound && <p className="mt-2 text-sm text-zinc-400">본 게임 전체 12라운드 중 <b className="text-emerald-300">{mainRound}라운드</b></p>}
      </div>
      <div><div className="mb-2 flex justify-between text-xs text-zinc-500"><span>준비</span><span>본 게임 진행률 {progress}%</span><span>종료</span></div><div className="h-2.5 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-all" style={{ width: `${progress}%` }} /></div></div>
      {nextRound != null && (
        <button
          type="button"
          className="mt-auto min-h-16 w-full rounded-2xl bg-amber-400 px-5 text-lg font-black text-zinc-950 shadow-xl shadow-amber-950/40 transition hover:bg-amber-300 active:scale-[0.99]"
          onClick={() => void onAdvanceRound(nextRound)}
        >
          {scorePending ? (
            <>점수 확인 완료 · {getRoundLabel(nextRound)} 시작 →</>
          ) : resultPending && currentRound === 15 ? (
            <>12라운드 결과 확인 완료 · 최종 점수 보기 →</>
          ) : resultPending && (currentRound === 7 || currentRound === 11) ? (
            <>전투 결과 확인 완료 · 전체 점수 보기 →</>
          ) : resultPending ? (
            <>결과 확인 완료 · {getRoundLabel(nextRound)} 시작 →</>
          ) : (
            <>현재 라운드 종료 · 전투 결과 보기 →</>
          )}
        </button>
      )}
      {nextRound == null && (
        <p className="mt-auto text-center text-sm text-zinc-400">
          최종 점수가 공개되었습니다. 상단의 게임 종료 버튼으로 마무리하세요.
        </p>
      )}
    </section>
  );
}


