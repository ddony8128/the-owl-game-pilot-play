"use client";

export function MafiaRulesTab() {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-zinc-300">
      <p>자본주의 마피아 규칙 요약이다부엉!</p>

      <div className="space-y-3">
        <p className="font-semibold text-zinc-100"> 단계 요약 </p>
        <ul className="list-disc pl-4">
          <li>
            <span className="font-semibold">라운드 준비</span>: 대기 상태입니다.
            첫 라운드에서는 현금이 초기화됩니다.
          </li>
          <br />
          <li>
            <span className="font-semibold">직업 경매</span>: 얻고 싶은 직업
            하나를 고르고, 그 직업에 베팅합니다. 낙찰에 실패하거나 베팅을
            포기하면 자동으로 월급쟁이가 됩니다.
          </li>
          <br />
          <li>
            <span className="font-semibold">주식 거래</span>: 4종류 주식 중
            원하는 만큼 매수/매도합니다. 같은 주식을 한 라운드에 매수 매도 둘 다
            할 수는 없습니다. 또한 각 직업의 특수 능력을 사용합니다.
          </li>
          <br />
          <li>
            <span className="font-semibold">주가 변동</span>: 거래량과 마피아
            능력에 따라 주가가 변동되고, 직업별 월급이 지급됩니다. 각 직업의
            능력이 적용됩니다.
          </li>
          <br />
          <li>
            <span className="font-semibold">투표</span>: 경제사범으로 뽑고자
            하는 사람에게 원하는 만큼 표를 행사합니다. 표의 가격은 시장에 의해
            1~3원 중 하나로 결정됩니다. 기본적으로는 1원입니다.
          </li>
          <br />
          <li>
            <span className="font-semibold">라운드 종료</span>: 투표에서 뽑힌
            사람은 5원의 벌금을 지불합니다. 마피아가 경제사범으로 뽑히면 시민은
            국채 1개씩 얻습니다. 다음 라운드로 넘어가거나 게임을 종료합니다. 총
            5라운드입니다.
          </li>
        </ul>
      </div>

      <div className="space-y-1">
        <p className="font-semibold text-zinc-100">직업 능력 요약</p>
        <ul className="list-disc pl-4">
          <li>
            <span className="font-semibold">상승 주가조작범 (마피아)</span>:
            선택한 한 종목(국채 제외)의 주가를 2원 올립니다.
          </li>
          <br />
          <li>
            <span className="font-semibold">하락 주가조작범 (마피아)</span>:
            선택한 한 종목(국채 제외)의 주가를 3원 떨어뜨립니다.
          </li>
          <br />
          <li>
            <span className="font-semibold">강도 (마피아) </span>: 자신을 제외한
            두 명을 대상으로 지정해, 그 라운드 수익의 절반을 빼앗습니다. 라운드
            수익은 월급과 주식 매도 금액의 합입니다.
          </li>
          <br />
          <li>
            <span className="font-semibold">증권사 직원</span>: 선택한 한
            종목(국채 제외)의 총 거래금액 10%를 얻습니다.
          </li>
          <br />
          <li>
            <span className="font-semibold">경찰</span>: 5 원의 월급을 받습니다.
            자신을 제외한 한 명을 조사해 마피아인지 아닌지 확인합니다.
          </li>
          <br />
          <li>
            <span className="font-semibold">세무조사원</span>: 5 원의 월급을
            받습니다. 자신을 제외한 한 명을 선택합니다. 그 사람이 보유한 주식과
            이번 라운드 매수/매도 내역을 확인합니다.
          </li>
          <br />
          <li>
            <span className="font-semibold">시장</span>: 강도와 벌금에
            면역입니다. 이번 라운드의 표 가격을 1, 2, 3원 중 선택합니다.
          </li>
          <br />
          <li>
            <span className="font-semibold">CEO</span>: 10 원의 월급을 받습니다.
          </li>
          <br />
          <li>
            <span className="font-semibold">월급쟁이</span>: 3 원의 월급을
            받는다부엉! 그것 말고는 없다부엉. 불쌍해부엉...
          </li>
        </ul>
      </div>
    </div>
  );
}
