"use client";

import { useEffect, useState } from "react";
import type { Player } from "@/lib/types";

const NICKNAME_KEY = "owlgame:nickname";

export function usePlayerAuth() {
  const [nickname, setNicknameState] = useState<string | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored =
      typeof window !== "undefined" ? localStorage.getItem(NICKNAME_KEY) : null;
    const timeoutId = setTimeout(() => {
      if (stored) {
        setNicknameState(stored);
      } else {
        setIsLoading(false);
      }
    }, 0);

    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!nickname) return;
    let cancelled = false;

    const timeoutId = setTimeout(() => {
      const load = async () => {
        setIsLoading(true);
        try {
          const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ nickname }),
          });
          const json = (await res.json().catch(() => null)) as
            | { player: Player; error?: undefined }
            | { error: string }
            | null;

          if (cancelled) return;

          if (!res.ok || !json || "error" in json || !("player" in json)) {
            const message =
              (json as { error?: string } | null)?.error ??
              "플레이어 정보를 불러오지 못했습니다.";

            // 서버에 확인했을 때 닉네임이 존재하지 않는 경우(403)이면
            // 로컬스토리지에 저장된 닉네임을 비우고 다시 로그인하도록 유도한다.
            if (res.status === 403) {
              setNicknameState(null);
              setPlayer(null);
              if (typeof window !== "undefined") {
                localStorage.removeItem(NICKNAME_KEY);
              }
            } else {
              setPlayer(null);
            }

            setError(message);
          } else {
            setError(null);
            setPlayer(json.player ?? null);
          }
        } catch (e: unknown) {
          if (!cancelled) {
            const message =
              e instanceof Error
                ? e.message
                : "플레이어 정보를 불러오지 못했습니다.";
            setError(message);
            setPlayer(null);
          }
        } finally {
          if (!cancelled) {
            setIsLoading(false);
          }
        }
      };

      void load();
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [nickname]);

  const setNickname = (value: string) => {
    setNicknameState(value);
    if (typeof window !== "undefined") {
      localStorage.setItem(NICKNAME_KEY, value);
    }
  };

  const clearNickname = () => {
    setNicknameState(null);
    setPlayer(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(NICKNAME_KEY);
    }
  };

  return {
    nickname,
    player,
    isLoading,
    error,
    setNickname,
    clearNickname,
  } as const;
}
