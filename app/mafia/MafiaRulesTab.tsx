"use client";

export function MafiaRulesTab() {
  return (
    <div className="space-y-2 text-xs leading-relaxed text-zinc-200">
      <p>자본주의 마피아의 상세 규칙은 현장에서 GM이 설명합니다.</p>
      <p>여기서는 현재 페이즈와 가능한 행동만 간단히 요약합니다.</p>
      <ul className="list-disc pl-4">
        <li>경매 페이즈: 주가에 영향을 줄 수 있는 베팅을 진행합니다.</li>
        <li>거래 페이즈: 다른 플레이어나 은행과 주식/현금을 교환합니다.</li>
        <li>능력 사용: 역할에 따라 부여된 능력을 사용합니다.</li>
        <li>투표 페이즈: 마피아로 의심되는 사람에게 표를 던집니다.</li>
      </ul>
    </div>
  );
}
