export function DefenseRulesTab() {
  return (
    <div className="space-y-3 text-base leading-relaxed text-zinc-300">
      <p>디펜스 딜레마 규칙 요약이다부엉! (임시 더미 텍스트)</p>

      <div className="space-y-3">
        <p className="font-semibold text-zinc-100">기본 진행 흐름</p>
        <ul className="list-disc pl-4">
          <li>
            <span className="font-semibold">튜토리얼 라운드 (0라운드)</span>:
            규칙 설명과 연습을 진행하는 라운드입니다.
          </li>
          <br />
          <li>
            <span className="font-semibold">본 게임 라운드 (1~10라운드)</span>:
            각 라운드마다 주어진 상황에서 방어 전략을 선택하고, 선택에 따라
            점수가 변동됩니다.
          </li>
          <br />
          <li>
            <span className="font-semibold">라운드 종료</span>: GM이 다음
            라운드로 넘기면 현재 라운드는 더 이상 수정할 수 없습니다.
          </li>
        </ul>
      </div>

      <div className="space-y-1">
        <p className="font-semibold text-zinc-100">세부 규칙</p>
        <p className="text-sm text-zinc-400">
          실제 디펜스 딜레마의 상세 규칙, 점수 계산 방식 등은 추후 추가될
          예정입니다. 지금은 GM이 구두로 안내하는 규칙을 기준으로 플레이하면
          됩니다.
        </p>
      </div>
    </div>
  );
}


