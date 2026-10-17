import { describe, expect, it } from "vitest";
import { decideAdvance, readFromIndex } from "@/lib/admin/advanceGuard";

// 반면교사 1-1·1-2: 화면이 보고 있던 단계(from)를 함께 보내고, 이미 넘어갔으면 200(멱등), 어긋나면 409.
describe("decideAdvance", () => {
  it("현재+1 로 가는 정상 요청은 진행", () => {
    expect(decideAdvance({ currentIndex: 4, targetIndex: 5, fromIndex: 4 })).toEqual({ kind: "proceed" });
    expect(decideAdvance({ currentIndex: 4, targetIndex: 5, fromIndex: null })).toEqual({ kind: "proceed" });
  });

  it("다른 창이 먼저 넘겨 서버가 이미 target 이상이면 멱등(200)", () => {
    // 화면은 4를 보고 5로 가려는데 서버는 이미 5
    expect(decideAdvance({ currentIndex: 5, targetIndex: 5, fromIndex: 4 })).toEqual({ kind: "idempotent" });
    // 두 단계 앞선 서버
    expect(decideAdvance({ currentIndex: 6, targetIndex: 5, fromIndex: 4 })).toEqual({ kind: "idempotent" });
    // from 없는 재전송
    expect(decideAdvance({ currentIndex: 5, targetIndex: 5, fromIndex: null })).toEqual({ kind: "idempotent" });
  });

  it("되돌리기 뒤의 옛 탭(from 이 서버보다 앞) → 409 stale_from", () => {
    const d = decideAdvance({ currentIndex: 3, targetIndex: 6, fromIndex: 5 });
    expect(d.kind).toBe("reject");
    if (d.kind === "reject") expect(d.reason).toBe("stale_from");
  });

  it("단계 건너뛰기 → 409 cannot_skip", () => {
    const d = decideAdvance({ currentIndex: 3, targetIndex: 6, fromIndex: 3 });
    expect(d.kind).toBe("reject");
    if (d.kind === "reject") expect(d.reason).toBe("cannot_skip");
    const d2 = decideAdvance({ currentIndex: 3, targetIndex: 6, fromIndex: null });
    expect(d2.kind).toBe("reject");
  });

  it("같은 요청 5연발은 1번만 진행하고 나머지는 멱등", () => {
    let server = 4;
    const results: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const d = decideAdvance({ currentIndex: server, targetIndex: 5, fromIndex: 4 });
      results.push(d.kind);
      if (d.kind === "proceed") server = 5;
    }
    expect(results).toEqual(["proceed", "idempotent", "idempotent", "idempotent", "idempotent"]);
  });
});

describe("readFromIndex", () => {
  it("정수·정수 문자열만 받고 나머지는 null", () => {
    expect(readFromIndex(3)).toBe(3);
    expect(readFromIndex("7")).toBe(7);
    expect(readFromIndex(2.5)).toBeNull();
    expect(readFromIndex("auction")).toBeNull();
    expect(readFromIndex(undefined)).toBeNull();
    expect(readFromIndex({})).toBeNull();
  });
});
