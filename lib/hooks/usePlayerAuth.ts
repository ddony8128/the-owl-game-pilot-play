"use client";

import { useCallback, useEffect, useState } from "react";
import type { Player, RoomGame } from "@/lib/types";
import { normalizeNickname } from "@/lib/nickname";

const NICKNAME_KEY = "owlgame:nickname";
const ROOM_KEY = "owlgame:room";
const ROOMGAME_KEY = "owlgame:roomGame";

// 방(room) 모델 플레이어 인증.
//  - 입장: 방 코드 + 닉네임 → POST /api/auth/login
//  - 성공 시 player + roomGame 보관(localStorage). 실패는 비파괴적(저장값 유지, 에러만 노출).
export function usePlayerAuth() {
  const [nickname, setNicknameState] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [roomGame, setRoomGame] = useState<RoomGame | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 최초: localStorage 에서 복원
  useEffect(() => {
    if (typeof window === "undefined") return;
    const n = localStorage.getItem(NICKNAME_KEY);
    const r = localStorage.getItem(ROOM_KEY);
    const g = localStorage.getItem(ROOMGAME_KEY) as RoomGame | null;
    if (n) setNicknameState(n);
    if (r) setRoomCode(r);
    if (g) setRoomGame(g);
    if (!n || !r) setIsLoading(false);
  }, []);

  // 닉네임+방이 있으면 서버 검증
  useEffect(() => {
    if (!nickname || !roomCode) return;
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room: roomCode, nickname }),
        });
        const json = (await res.json().catch(() => null)) as
          | { player: Player; room: { game: RoomGame } }
          | { error: string }
          | null;
        if (cancelled) return;

        if (!res.ok || !json || "error" in json || !("player" in json)) {
          // 비파괴적: 저장값은 유지하고 에러만 노출(로그인 모달이 다시 뜨도록 player만 비움)
          setPlayer(null);
          setError(
            (json as { error?: string } | null)?.error ??
              "플레이어 정보를 불러오지 못했습니다.",
          );
        } else {
          setError(null);
          setPlayer(json.player);
          if (json.room?.game) {
            setRoomGame(json.room.game);
            if (typeof window !== "undefined") {
              localStorage.setItem(ROOMGAME_KEY, json.room.game);
            }
          }
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setPlayer(null);
          setError(
            e instanceof Error
              ? e.message
              : "플레이어 정보를 불러오지 못했습니다.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [nickname, roomCode]);

  const enterRoom = useCallback((room: string, nick: string) => {
    const r = room.trim().toUpperCase();
    // 서버와 같은 규칙(NFC·제로폭 제거·공백 정리)으로 저장해, 저장된 닉네임과 서버 닉네임이 항상 같게 한다.
    const n = normalizeNickname(nick);
    if (typeof window !== "undefined") {
      // ITER6 C1 — 다른 방/닉네임으로 들어오면 이전 방 세션(player·game)을 지운다. 남겨 두면 입장 화면이
      // 옛 game 으로 이동하고(디펜스 세션이 남은 채 마피아 방 입장 → /defense) 가드가 막힌 화면을 띄웠다.
      // 같은 방·같은 닉네임 재입장이면 지우지 않는다(검증 effect 가 다시 돌지 않아 player 가 비어 버린다).
      const changed = localStorage.getItem(ROOM_KEY) !== r || localStorage.getItem(NICKNAME_KEY) !== n;
      if (changed) {
        localStorage.removeItem(ROOMGAME_KEY);
        setPlayer(null);
        setRoomGame(null);
      }
      localStorage.setItem(ROOM_KEY, r);
      localStorage.setItem(NICKNAME_KEY, n);
    }
    setError(null);
    setRoomCode(r);
    setNicknameState(n);
  }, []);

  const clearNickname = useCallback(() => {
    setNicknameState(null);
    setRoomCode(null);
    setRoomGame(null);
    setPlayer(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(NICKNAME_KEY);
      localStorage.removeItem(ROOM_KEY);
      localStorage.removeItem(ROOMGAME_KEY);
    }
  }, []);

  return {
    nickname,
    roomCode,
    roomGame,
    player,
    isLoading,
    error,
    enterRoom,
    clearNickname,
  } as const;
}
