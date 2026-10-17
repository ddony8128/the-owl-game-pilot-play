import type { MafiaPhase } from "@/lib/types";

export const JOB_LABEL: Record<string, string> = {
  up_manipulator: "상승 조작범",
  down_manipulator: "하락 조작범",
  robber: "강도",
  police: "경찰",
  tax_auditor: "세무조사원",
  mayor: "시장",
  broker: "증권사 직원",
  ceo: "CEO",
  salaryman: "월급쟁이",
};

export function jobLabel(job: string | null): string {
  if (!job) return "월급쟁이";
  return JOB_LABEL[job] ?? job;
}

export const PHASE_LABEL: Record<MafiaPhase, string> = {
  prepare: "준비",
  auction: "직업 경매",
  trade: "주식 거래",
  apply: "정산",
  vote: "경제사범 투표",
  end: "라운드 종료",
};

export const PHASE_TIMER_LABEL: Partial<Record<MafiaPhase, string>> = {
  auction: "경매 시간",
  trade: "거래 시간",
  vote: "투표 시간",
};

export function mafiaRoundLabel(round: number): string {
  return round <= 0 ? "튜토리얼" : `${round}라운드`;
}

/** 종목 로고(폰 MafiaStocksTab 과 같은 파일) */
export function stockLogoSrc(key: string): string | null {
  switch (key) {
    case "부엉교육":
      return "/mafia/company/edu.png";
    case "번쩍전기":
      return "/mafia/company/electricity.png";
    case "국채":
      return "/mafia/company/owl_flag.png";
    case "이상교통":
      return "/mafia/company/vehicle.png";
    default:
      return null;
  }
}
