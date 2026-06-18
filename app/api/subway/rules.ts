export type SubwayRule = {
  id: number;
  title: string;
  body: string;
  conditionDescription: string;
  alwaysVisible: boolean;
};

export const SUBWAY_RULES: SubwayRule[] = [
  {
    id: 0,
    title: "규칙 0.",
    body:
      "안녕하세요. 이곳은 이상교통 파일럿역입니다.\n" +
      "보수 공사 중 발생한 오류로 인해 복도 구조가 비정상적으로 반복되고 있습니다.\n" +
      "또한 각 복도에는 이상 현상이 지속적으로 발생하고 있습니다.\n" +
      "침착하게 8번 출구를 향해 이동하십시오.\n" +
      "본 시설에 고립된 지 35분 이내로 탈출하지 못할 경우, 더 이상 안전을 보장해드릴 수 없습니다.",
    conditionDescription: "",
    alwaysVisible: true,
  },
  {
    id: 1,
    title: "규칙 1.",
    body:
      "베타형 이상 현상이 지속적으로 발생하여 시공간이 안정되지 않고 있습니다. " +
      "특히 0번 출구에서는 시공간 좌표가 고정된 이후에야 이동이 성립하므로, 10초 이상 머무르시기 바랍니다. " +
      "이를 지키지 않으면 어느 시간대에서도 존재할 수 없게 됩니다.",
    conditionDescription: "한 장소에서 30초 이상 머무른다.",
    alwaysVisible: false,
  },
  {
    id: 2,
    title: "규칙 2.",
    body:
      "이곳에는 문이 존재하지 않습니다. 시공간 이상이 문의 형태로 인식되는 것으로 추정됩니다. " +
      "절대 문을 열지 마십시오. 그곳은 출구가 아닙니다. 통로가 막혀 있고 문이 보인다면 뒤로 돌아가십시오.",
    conditionDescription: "창고에 입장한다.",
    alwaysVisible: false,
  },
  {
    id: 3,
    title: "규칙 3.",
    body:
      "역 내부에는 사람의 음식을 반입할 수 없습니다. 사람의 음식처럼 보이는 무언가가 있다면, " +
      "알 수 없는 존재가 당신을 유인하고 있는 것입니다. 절대 음식을 향해 나아가지 말고 뒤로 돌아가십시오. " +
      "운이 좋아 음식을 챙겼더라도 섭취하지 마십시오. 섭취 시 다음 증상이 보고되었습니다 : " +
      "환각, 정신분열, 급속 노화, 사지 뒤틀림, 통로와의 일체화",
    conditionDescription: "간식을 챙긴다.",
    alwaysVisible: false,
  },
  {
    id: 4,
    title: "규칙 4.",
    body:
      "역 내부에는 흉악한 범죄를 저지르고 6개월 이상 검거되지 않은 수배범들이 배회하고 있습니다. " +
      "그들은 이상현상과 동화되어 더 이상 인간이 아닙니다. 그들을 마주친다면 뒤로 돌아가십시오.",
    conditionDescription: "수배범 신고를 성공적으로 처리한다.",
    alwaysVisible: false,
  },
  {
    id: 5,
    title: "규칙 5.",
    body:
      "이 공간은 현실을 모방하려는 경향이 있습니다. 그러나 항상 이상 현상, 괴생명체, 물리 법칙 위배 등 " +
      "위화감을 느낄 수 있는 요소가 존재합니다. 만약 위화감 없이 현실에서 본 적 있는 장소가 동일하게 나타난다면 " +
      "뒤돌아가십시오. 당신의 기억을 실체화하는 무언가가 그곳에 있는 것입니다.",
    conditionDescription: "같은 장소를 3번 마주한다.",
    alwaysVisible: false,
  },
  {
    id: 6,
    title: "규칙 6.",
    body: "6 번 출 구 에 서 는 앞\n으 로 나 아 가\n지 말 것.",
    conditionDescription: "6번 출구까지 도달한 후 0번 출구로 되돌아간다.",
    alwaysVisible: false,
  },
  {
    id: 7,
    title: "규칙 7.",
    body:
      "규칙 1부터 규칙 6까지에 해당하지 않는 경우, 용기 내어 앞으로 나아가십시오. 행운을 빕니다.\n" +
      "추가 안내 : 최근 안내문이 알 수 없는 존재에 의해 간섭되는 현상이 보고되었습니다. " +
      "혼란을 최소화하기 위해 명확히 안내합니다. 이 안내문에는 '규칙 8'이 존재하지 않습니다. " +
      "이 규칙이 마지막 규칙입니다.",
    conditionDescription: "규칙 1부터 규칙 6까지를 모두 발견한다.",
    alwaysVisible: false,
  },
  {
    id: 8,
    title: "규칙 8.",
    body:
      "다른 사람을 믿지 마십시오.\n" +
      "규칙 내용을 다른 누구와도 공유하지 마십시오.\n" +
      "그가 과연 사람일까요?",
    conditionDescription: "",
    alwaysVisible: true,
  },
];

export function getSubwayRuleById(id: number): SubwayRule | undefined {
  return SUBWAY_RULES.find((r) => r.id === id);
}
