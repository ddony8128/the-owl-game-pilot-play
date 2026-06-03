"use client";

import { useEffect, useState } from "react";
import type { Player } from "@/lib/types";

const NICKNAME_KEY = "owlgame:nickname";

// 테스트 플레이용 탭별 정체성 지원.
// - URL 에 ?as=<닉네임> 이 있으면 그 닉네임을 그 탭 전용으로 사용한다.
//   (sessionStorage 는 탭마다 분리되므로, 여러 탭을 서로 다른 플레이어로 띄울 수 있다.)
// - 파라미터가 없으면 기존과 동일하게 localStorage(전 탭 공유)를 사용한다.
//   → 실제 이벤트 동작에는 영향이 없다.
function readInitialNickname(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const asParam = new URLSearchParams(window.location.search).get("as");
    if (asParam && asParam.trim()) {
      const value = asParam.trim();
      // 탭 단위로 고정시켜, 같은 탭 내 클라이언트 네비게이션(쿼리 유실)에도 유지되게 한다.
      window.sessionStorage.setItem(NICKNAME_KEY, value);
      return value;
    }

    const fromSession = window.sessionStorage.getItem(NICKNAME_KEY);
    if (fromSession) return fromSession;

    return window.localStorage.getItem(NICKNAME_KEY);
  } catch {
    return null;
  }
}

// 현재 탭이 ?as= / sessionStorage 기반(테스트 모드)인지 여부.
function isTabScoped(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const asParam = new URLSearchParams(window.location.search).get("as");
    if (asParam && asParam.trim()) return true;
    return window.sessionStorage.getItem(NICKNAME_KEY) != null;
  } catch {
    return false;
  }
}

export function usePlayerAuth() {
  const [nickname, setNicknameState] = useState<string | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initial = readInitialNickname();
    const timeoutId = setTimeout(() => {
      if (initial) {
        setNicknameState(initial);
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
            // 저장된 닉네임을 비우고 다시 로그인하도록 유도한다.
            if (res.status === 403) {
              setNicknameState(null);
              setPlayer(null);
              if (typeof window !== "undefined") {
                window.sessionStorage.removeItem(NICKNAME_KEY);
                window.localStorage.removeItem(NICKNAME_KEY);
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
      // 탭 전용(테스트) 모드면 sessionStorage 에만, 아니면 기존처럼 localStorage 에 저장한다.
      if (isTabScoped()) {
        window.sessionStorage.setItem(NICKNAME_KEY, value);
      } else {
        window.localStorage.setItem(NICKNAME_KEY, value);
      }
    }
  };

  const clearNickname = () => {
    setNicknameState(null);
    setPlayer(null);
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(NICKNAME_KEY);
      window.localStorage.removeItem(NICKNAME_KEY);
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
