import { describe, expect, it, vi } from "vitest";
import { fetchWithTimeout } from "@/lib/hooks/usePolling";

// Iteration 5 — 공용 폴링 훅의 순수 부분. 요청은 유한 시간 안에 반드시 끝나야 in-flight 가드가 영구히 잠기지 않는다.
describe("fetchWithTimeout", () => {
  it("timeoutMs 안에 응답이 없으면 AbortError로 끝난다", async () => {
    const never: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("timeout", "TimeoutError")));
      });
    await expect(fetchWithTimeout("/x", 20, never)).rejects.toBeInstanceOf(DOMException);
  });

  it("cache: no-store 로 요청한다", async () => {
    const impl = vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
    await fetchWithTimeout("/y", 1000, impl);
    expect(impl).toHaveBeenCalledWith("/y", expect.objectContaining({ cache: "no-store" }));
  });
});
