// 닉네임 정규화 — 제로폭·NBSP·조합형 한글 차이로 "다른 사람"이 되는 일을 막는다(증권가 D150·수산시장 Iter17 반면교사).
//  - NFC 정규화(조합형 → 완성형)
//  - 보이지 않는 문자 제거(ZWSP·ZWNJ·ZWJ·BOM·WORD JOINER·soft hyphen)
//  - NBSP 등 특수 공백은 보통 공백으로, 연속 공백은 하나로, 양끝 공백 제거
const INVISIBLE = /[​-‍⁠﻿­]/g;
const ODD_SPACES = /[  -   　]/g;

export function normalizeNickname(input: unknown): string {
  if (typeof input !== "string") return "";
  return input
    .normalize("NFC")
    .replace(INVISIBLE, "")
    .replace(ODD_SPACES, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 닉네임 길이 상한(DB·화면 보호). 넘으면 입구에서 400. */
export const NICKNAME_MAX_LENGTH = 20;

export function isValidNickname(nick: string): boolean {
  return nick.length > 0 && nick.length <= NICKNAME_MAX_LENGTH;
}
