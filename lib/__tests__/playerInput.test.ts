import { describe, expect, it } from "vitest";
import { isValidNickname, normalizeNickname } from "@/lib/nickname";
import { isRequestIdShaped, newRequestId, parseRequestId } from "@/lib/requestId";
import { isUniqueViolation, isUuid, parsePositiveInt } from "@/lib/player/roomGuard";

// Iteration 5 WS-B — 입력 형식(반면교사 1-17·1-18): 닉네임 변형, requestId, uuid, 정수 검사.
describe("normalizeNickname", () => {
  it("NFC 정규화: 조합형 한글이 완성형과 같은 사람이 된다", () => {
    const decomposed = "철수".normalize("NFD");
    expect(decomposed).not.toBe("철수");
    expect(normalizeNickname(decomposed)).toBe("철수");
  });
  it("제로폭·BOM·soft hyphen 제거, NBSP·전각 공백은 보통 공백으로, 연속 공백 하나로", () => {
    expect(normalizeNickname("철​수")).toBe("철수");
    expect(normalizeNickname("﻿철수")).toBe("철수");
    expect(normalizeNickname("철  수")).toBe("철 수");
    expect(normalizeNickname("  철수　")).toBe("철수");
  });
  it("문자열이 아니면 빈 문자열", () => {
    expect(normalizeNickname(null)).toBe("");
    expect(normalizeNickname(12)).toBe("");
  });
  it("길이 상한 20", () => {
    expect(isValidNickname("a".repeat(20))).toBe(true);
    expect(isValidNickname("a".repeat(21))).toBe(false);
    expect(isValidNickname("")).toBe(false);
  });
});

describe("requestId", () => {
  it("8~64자 [A-Za-z0-9_-] 만 통과", () => {
    expect(parseRequestId("abcd1234")).toBe("abcd1234");
    expect(parseRequestId("short")).toBeNull();
    expect(parseRequestId("has space!")).toBeNull();
    expect(parseRequestId(123)).toBeNull();
    expect(isRequestIdShaped("x".repeat(65))).toBe(false);
  });
  it("newRequestId 는 형식에 맞고 매번 다르다", () => {
    const a = newRequestId();
    const b = newRequestId();
    expect(isRequestIdShaped(a)).toBe(true);
    expect(a).not.toBe(b);
  });
});

describe("roomGuard helpers", () => {
  it("uuid 형식", () => {
    expect(isUuid("11111111-1111-1111-1111-111111111111")).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid(1)).toBe(false);
  });
  it("양의 정수(상한 포함)", () => {
    expect(parsePositiveInt(3, 10)).toBe(3);
    expect(parsePositiveInt(0, 10)).toBeNull();
    expect(parsePositiveInt(1.5, 10)).toBeNull();
    expect(parsePositiveInt("3", 10)).toBeNull();
    expect(parsePositiveInt(11, 10)).toBeNull();
    expect(parsePositiveInt(Infinity, 10)).toBeNull();
  });
  it("유니크 위반 판정", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(isUniqueViolation({ message: "duplicate key value violates unique constraint" })).toBe(true);
    expect(isUniqueViolation({ code: "42P01" })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});
