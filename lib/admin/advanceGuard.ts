// 단계(라운드·페이즈) 전환 요청의 판정 — Iteration 5 반면교사 1-1(연타·동시 전환)·1-2(뒤처진 화면의 옛 버튼).
//
// 화면은 "자기가 보고 있던 단계(from)"와 "가려는 단계(target)"를 함께 보낸다.
//  - 서버가 이미 target 이상이면 200(멱등): 다른 창에서 먼저 넘긴 경우라 아무것도 하지 않는다.
//  - 서버가 from 보다 뒤에 있으면(되돌리기가 있었음) 409: 화면이 서버보다 앞서 있어 그대로 넘기면 단계가 건너뛰어진다.
//  - from 이 없는 옛 요청도 같은 규칙으로 판정한다(target = current+1 만 진행).
export type AdvanceDecision =
  | { kind: "proceed" }
  | { kind: "idempotent" }
  | { kind: "reject"; reason: "stale_from" | "already_advanced" | "cannot_skip"; error: string };

export function decideAdvance(params: {
  currentIndex: number;
  targetIndex: number;
  fromIndex: number | null;
  label?: (index: number) => string;
}): AdvanceDecision {
  const { currentIndex, targetIndex, fromIndex } = params;
  const label = params.label ?? ((i: number) => String(i));

  if (targetIndex === currentIndex + 1) {
    if (fromIndex != null && fromIndex !== currentIndex) {
      // 화면은 다른 단계를 보고 있었지만 결과적으로 서버의 다음 단계를 가리킨다 — 정상 진행.
      return { kind: "proceed" };
    }
    return { kind: "proceed" };
  }

  if (targetIndex <= currentIndex) {
    // 이미 그 단계(또는 그 뒤)에 있다: 다른 창·재전송이 먼저 처리됨.
    return { kind: "idempotent" };
  }

  // target > current + 1: 화면이 서버보다 앞서 있다(되돌리기 뒤의 옛 탭) 또는 단계 건너뛰기.
  if (fromIndex != null && fromIndex > currentIndex) {
    return {
      kind: "reject",
      reason: "stale_from",
      error: `화면이 보고 있던 단계(${label(fromIndex)})와 서버의 현재 단계(${label(currentIndex)})가 다릅니다. 화면을 새로 고친 뒤 다시 진행하세요.`,
    };
  }
  return {
    kind: "reject",
    reason: "cannot_skip",
    error: `현재 단계(${label(currentIndex)})에서 ${label(targetIndex)}(으)로 바로 넘어갈 수 없습니다.`,
  };
}

/** body.from 을 숫자로 안전하게 읽는다(없거나 숫자가 아니면 null). */
export function readFromIndex(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isInteger(raw)) return raw;
  if (typeof raw === "string" && /^-?\d+$/.test(raw.trim())) return Number(raw.trim());
  return null;
}
