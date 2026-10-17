// 닉네임 정규화(반면교사 1-17): NFC + 제로폭/서식 문자 제거 + 연속 공백 1칸.
// 제로폭 문자나 NBSP 가 섞인 닉네임이 "다른 사람"으로 등록되는 사고를 막는다.
export const NICKNAME_MAX_LENGTH = 20;

export function normalizeNickname(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/[​-‍⁠﻿­]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
