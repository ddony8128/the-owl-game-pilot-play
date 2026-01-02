export type MafiaAbilityPayload =
  | { job: "up_manipulator"; stock_key: string } // 국채 제외 종목 1개
  | { job: "down_manipulator"; stock_key: string } // 국채 제외 종목 1개
  | { job: "robber"; targets: [string, string] } // 대상 player 닉네임 또는 ID 2명
  | { job: "police"; targets: [string, string] } // 조사 대상 2명
  | { job: "tax_auditor"; targets: [string, string] } // 세무조사 대상 2명
  | { job: "broker"; stock_key: string } // 국채 제외 종목 1개
  | { job: "ceo"; target: string } // 자신을 제외한 1명
  | { job: "mayor"; ticket_price: 1 | 2 | 3 } // 해당 라운드 표 가격
  | { job: "salaryman" };
