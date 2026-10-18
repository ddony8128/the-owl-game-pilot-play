// 규칙 탭 — 참가자용 요약. 룰지(v11)·코드(lib/defense/*)와 한 문장씩 맞춘다.
// 참가자 자료에는 게임 규칙만 적는다(화면 전환·입장·탭 같은 앱 사용 설명은 넣지 않는다 — 2026-10-18 또니).
const ROUND_STEPS = [
  ["01", "행동 선택 · 5분", "전투, 휴식, 훈련 중 하나를 선택합니다. 제출한 행동은 바꿀 수 없습니다."],
  ["02", "전투 처리", "같은 몬스터에 제출된 카드 숫자를 합산해 피해를 주고, 체력이 0이 되면 처치합니다."],
  ["03", "라운드 종료", "모든 몬스터의 잔여 시간이 1 줄어들고, 0이 된 몬스터는 도망칩니다."],
  ["04", "다음 라운드", "대기열의 빈 칸을 남은 몬스터로 채운 뒤 다음 라운드를 시작합니다."],
] as const;

const ACTIONS = [
  ["⚔", "전투", "대기열의 몬스터 하나와 활성 숫자 카드 한 장을 선택해 제출합니다. 사용한 카드는 비활성화됩니다."],
  ["✦", "휴식", "비활성 카드 중 최대 3장을 골라 다시 활성화합니다."],
  ["↑", "훈련", "활성 카드 한 장을 비활성화하고, 아무 카드 한 장의 숫자를 영구적으로 1 올립니다."],
] as const;

export function DefenseRulesTab() {
  return (
    <div className="space-y-4 text-sm text-zinc-200">
      <section className="rounded-2xl border border-amber-400/25 bg-gradient-to-br from-zinc-900 to-amber-950/20 p-4">
        <p className="text-[11px] font-black tracking-[0.18em] text-amber-400">QUICK GUIDE</p>
        <h2 className="mt-1 text-xl font-black text-white">라운드 진행 순서</h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">튜토리얼 2라운드 뒤 본 게임은 최대 12라운드입니다.</p>
        <div className="mt-4 space-y-2">
          {ROUND_STEPS.map(([number, title, text]) => (
            <div key={number} className="grid grid-cols-[2.25rem_1fr] gap-3 rounded-xl bg-black/20 p-3">
              <span className="font-mono text-lg font-black text-amber-400">{number}</span>
              <div>
                <p className="font-black text-zinc-100">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-black text-white">행동 규칙</h2>
        </div>
        {ACTIONS.map(([icon, title, description]) => (
          <details key={title} className="group overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
            <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-xl">{icon}</span>
              <span className="flex-1 font-black text-zinc-100">{title}</span>
              <span className="text-zinc-600 transition group-open:rotate-180">⌄</span>
            </summary>
            <p className="border-t border-zinc-800 px-4 py-3 text-xs leading-relaxed text-zinc-400">{description}</p>
          </details>
        ))}
      </section>

      <details className="group overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900" open>
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-4 font-black text-white">
          <span>전투와 몬스터</span>
          <span className="text-zinc-500 transition group-open:rotate-180">⌄</span>
        </summary>
        <div className="space-y-2 border-t border-zinc-800 px-4 py-3 text-xs leading-relaxed text-zinc-400">
          <p><b className="text-rose-300">처치</b> · 제출된 숫자의 합이 남은 체력 이상이면 처치되어 대기열에서 사라집니다. 몬스터의 포인트를 전투에 참여한 인원 수로 나눠 받고, 나머지는 버립니다. 예: 4점을 3명이 나누면 1점씩 받고 1점은 사라집니다.</p>
          <p><b className="text-amber-300">생존</b> · 제출된 숫자의 합만큼 체력이 줄고 대기열에 남습니다.</p>
          <p><b className="text-sky-300">도망</b> · 잔여 시간이 0이 되면 대기열에서 사라지고, 도망친 몬스터가 있으면 모든 플레이어의 가장 큰 활성 카드 한 장이 비활성화됩니다.</p>
          <p><b className="text-zinc-200">비공개</b> · 누가 어떤 행동을 했는지, 어느 카드를 어느 몬스터에 제출했는지는 공개되지 않습니다. 처치에 성공했을 때 내가 얻은 점수만 알 수 있습니다.</p>
        </div>
      </details>

      <details className="group overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-4 font-black text-white">
          <span>게임 구성</span>
          <span className="text-zinc-500 transition group-open:rotate-180">⌄</span>
        </summary>
        <div className="space-y-2 border-t border-zinc-800 px-4 py-3 text-xs leading-relaxed text-zinc-400">
          <p><b className="text-zinc-200">숫자 카드</b> · 모든 플레이어는 활성 상태의 1 / 2 / 3 / 4 카드를 한 장씩 가지고 시작합니다.</p>
          <p><b className="text-zinc-200">몬스터</b> · 총 6종류이며, 마릿수는 참가 인원에 맞춰 조정됩니다.</p>
          <p><b className="text-zinc-200">대기열</b> · 6~9명은 4칸, 10~12명은 5칸입니다. 빈 칸은 다음 라운드 시작 때 남은 몬스터로 채워집니다. 대기열에는 같은 종류의 몬스터가 최대한 겹치지 않게 나옵니다.</p>
        </div>
      </details>

      <details className="group overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900" open>
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-4 font-black text-white">
          <span>점수 공개·종료·순위</span>
          <span className="text-zinc-500 transition group-open:rotate-180">⌄</span>
        </summary>
        <div className="space-y-2 border-t border-zinc-800 px-4 py-3 text-xs leading-relaxed text-zinc-400">
          <p><b className="text-zinc-200">중간 공개</b> · 본 게임 4라운드와 8라운드가 끝나면 모든 플레이어의 점수를 공개합니다.</p>
          <p><b className="text-zinc-200">게임 종료</b> · 대기열과 남은 몬스터가 모두 쓰러지거나 도망치면 바로 종료하고, 그렇지 않으면 본 게임 12라운드가 끝나면 종료합니다.</p>
          <p><b className="text-zinc-200">순위 결정</b> · 포인트가 높은 순서입니다. 동점이면 더 많은 피해(전투에 사용한 숫자 카드의 합)를 입힌 플레이어가 앞서고, 그래도 같으면 공동 순위입니다.</p>
        </div>
      </details>

      <p className="px-1 pb-2 text-xs leading-relaxed text-zinc-600">몬스터별 체력·잔여 시간·점수는 ‘몬스터 도감’ 탭에서 확인할 수 있습니다.</p>
    </div>
  );
}
