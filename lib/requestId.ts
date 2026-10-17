// 폰 → 서버 변경 요청의 멱등 키. 응답이 유실돼 폰이 같은 요청을 다시 보내도 두 번 반영되지 않게 한다
// (증권가 §43 "2주 매수가 5주 체결" 반면교사). 서버는 (방, 플레이어, request_id)로 중복을 거른다.
const REQUEST_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

/** body.request_id 를 검사해 유효하면 그대로, 없거나 형식이 틀리면 null (형식 오류는 호출자가 400으로 돌려도 되고 무시해도 된다). */
export function parseRequestId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  return REQUEST_ID_RE.test(raw) ? raw : null;
}

export function isRequestIdShaped(raw: unknown): boolean {
  return typeof raw === "string" && REQUEST_ID_RE.test(raw);
}

/** 브라우저/노드 공용 requestId 생성 */
export function newRequestId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto && typeof g.crypto.randomUUID === "function") {
    return g.crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}
