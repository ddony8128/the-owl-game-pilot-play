"use client";

import { useEffect, useState } from "react";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "../supabase/server";
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
    const supabase = createServerSupabaseClient();

    const timeoutId = setTimeout(() => {
      const load = async () => {
        setIsLoading(true);
        const response: PostgrestSingleResponse<Player | null> = await supabase
          .from("players")
          .select("id, nickname, is_finalist, created_at")
          .eq("nickname", nickname)
          .maybeSingle();

        if (cancelled) return;
        if (response.error) {
          setError(response.error.message);
          setPlayer(null);
        } else {
          setError(null);
          setPlayer(response.data ?? null);
        }

        if (!cancelled) {
          setIsLoading(false);
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
