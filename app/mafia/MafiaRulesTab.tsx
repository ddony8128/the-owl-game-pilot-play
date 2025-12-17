"use client";

export function MafiaRulesTab() {
  return (
    <div className="space-y-2 text-xs leading-relaxed text-zinc-200">
      <p>자본주의 마피아의 핵심 규칙을 간단히 정리한 요약입니다.</p>

      <div className="space-y-1">
        <p className="font-semibold text-zinc-100">페이즈 요약</p>
        <ul className="list-disc pl-4">
          <li>
            <span className="font-semibold">라운드 준비(prepare)</span>: GM이
            라운드를 설정하고, 지하철 게임 결과에 따른 시작 현금이 정해집니다.
          </li>
          <li>
            <span className="font-semibold">직업 경매(auction)</span>: 받고 싶은
            직업 하나를 고르고, 그 직업에 베팅합니다. 낙찰에 실패하거나 베팅을
            포기/미참여하면 월급쟁이가 됩니다.
          </li>
          <li>
            <span className="font-semibold">주식 거래(trade)</span>: 네 종류
            주식을 매수/매도합니다. 같은 주식을 한 라운드에 매수와 매도를 둘 다
            할 수는 없습니다.
          </li>
          <li>
            <span className="font-semibold">능력 사용(trade 페이즈 내)</span>:
            각 직업의 특수 능력을 사용합니다. GM 안내에 따라 정해진 대상과
            주식만 선택할 수 있습니다.
          </li>
          <li>
            <span className="font-semibold">주가 변동(apply)</span>: 거래량과
            마피아 능력에 따라 주가가 변동되고, 직업별 월급·보너스·강도 피해
            등이 정산됩니다.
          </li>
          <li>
            <span className="font-semibold">투표(vote)</span>: 이번 라운드의 표
            가격을 기준으로, 경제사범일 것 같은 사람에게 원하는 만큼 표를
            행사합니다.
          </li>
          <li>
            <span className="font-semibold">라운드 종료(end)</span>: 표 결과로
            경제사범이 정해지면 벌금과 보상(국채)이 처리되고, 다음 라운드로
            넘어갑니다.
          </li>
        </ul>
      </div>

      <div className="space-y-1">
        <p className="font-semibold text-zinc-100">직업 능력 요약</p>
        <ul className="list-disc pl-4">
          <li>
            <span className="font-semibold">상승 주가조작범</span>: 선택한
            주식(국채 제외)의 주가를 추가로 올립니다.
          </li>
          <li>
            <span className="font-semibold">하락 주가조작범</span>: 선택한
            주식(국채 제외)의 주가를 크게 떨어뜨립니다.
          </li>
          <li>
            <span className="font-semibold">증권사 직원</span>: 선택한 한
            종목(국채 제외)의 총 거래금액에 따라 추가 수익을 얻습니다.
          </li>
          <li>
            <span className="font-semibold">강도</span>: 서로 다른 두 명을
            대상으로 지정해, 그 라운드 수익의 절반을 빼앗습니다. 시장은 강도에
            면역입니다.
          </li>
          <li>
            <span className="font-semibold">경찰</span>: 한 명을 조사해
            마피아인지 아닌지 확인합니다.
          </li>
          <li>
            <span className="font-semibold">세무조사원</span>: 한 명의 보유
            주식과 이번 라운드 매수/매도 내역을 확인합니다.
          </li>
          <li>
            <span className="font-semibold">시장</span>: 이번 라운드의 표 가격을
            1·2·3원 중에서 선택합니다. 자신은 강도와 벌금에 면역입니다.
          </li>
          <li>
            <span className="font-semibold">CEO / 월급쟁이</span>: 매 라운드
            고정 월급을 받습니다. 액수는 GM 안내에 따릅니다.
          </li>
        </ul>
      </div>

      <p className="text-[11px] text-zinc-400">
        세부 수치는 GM이 현장에서 최종 안내하는 내용을 우선으로 합니다.
      </p>
    </div>
  );
}
