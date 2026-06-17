"use client";

import { useCallback, useEffect, useState } from "react";
import type { Player } from "@/lib/types";

export function PlayerAdminSection() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/gm/players");
      const json = (await res.json().catch(() => null)) as
        | { players: Player[] }
        | { error: string }
        | null;
      if (!res.ok || !json || "error" in json) {
        throw new Error(
          (json as { error?: string })?.error ??
            "플레이어 목록을 불러오지 못했습니다."
        );
      }
      setPlayers(json.players ?? []);
      setError(null);
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "플레이어 목록을 불러오지 못했습니다."
      );
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addPlayer = async () => {
    const nickname = newName.trim();
    if (!nickname) return;
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/gm/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        created?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "플레이어를 추가하지 못했습니다.");
      }
      setMsg(
        json.created ? `등록: ${nickname}` : `이미 등록된 닉네임: ${nickname}`
      );
      setNewName("");
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "참가자를 등록하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const deletePlayer = async (player: Player) => {
    if (!window.confirm(`참가자 '${player.nickname}'을(를) 제거할까요?`)) return;
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/gm/players", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: player.id }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? "플레이어를 삭제하지 못했습니다.");
      }
      setMsg(`제거: ${player.nickname}`);
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "참가자를 제거하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const reset = async (scope: "runtime" | "all") => {
    const confirmMsg =
      scope === "all"
        ? "이번 나폴리탄 카지노 세션의 참가자 목록과 8번출구 진행 상태를 초기화합니다.\n다음 팀을 받기 전 사용하는 기능입니다. 계속하시겠습니까?"
        : "참가자 목록은 유지하고 8번출구 진행 상태만 초기화합니다. 계속하시겠습니까?";
    if (!window.confirm(confirmMsg)) return;
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/gm/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        errors?: string[];
        warnings?: string[];
      } | null;
      if (!res.ok || !json?.ok) {
        throw new Error(
          json?.error ??
            (json?.errors ? json.errors.join(", ") : "초기화에 실패했습니다.")
        );
      }
      // 보존 경고(예: 아카이브 테이블 미생성)가 있으면 새로고침 전에 알린다.
      if (json.warnings?.length) {
        window.alert(
          `초기화는 완료됐지만 주의가 필요합니다:\n\n${json.warnings.join("\n")}`
        );
      }
      // 초기화 후 게임상태/규칙 등 전체 화면을 다시 동기화
      window.location.reload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "초기화에 실패했습니다.");
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3 text-sm">
      <h2 className="text-base font-semibold">나폴리탄 카지노 참가자 관리</h2>

      {msg && <p className="text-xs text-emerald-400">{msg}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* 추가 */}
      <div className="flex items-center gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void addPlayer();
          }}
          placeholder="닉네임 입력"
          className="h-8 w-44 rounded border border-zinc-700 bg-zinc-900 px-2 text-xs outline-none focus:border-zinc-400"
        />
        <button
          type="button"
          disabled={busy || !newName.trim()}
          onClick={() => void addPlayer()}
          className="h-8 rounded bg-amber-400 px-3 text-xs font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
        >
          참가자 등록
        </button>
        <span className="text-xs text-zinc-500">총 {players.length}명</span>
      </div>

      {/* 목록 */}
      <div className="space-y-1 rounded-lg border border-zinc-800 bg-zinc-900 p-2">
        {players.length === 0 ? (
          <p className="px-1 py-2 text-xs text-zinc-400">
            등록된 참가자가 없습니다.
          </p>
        ) : (
          players.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded bg-zinc-950 px-3 py-1.5"
            >
              <span className="text-xs">{p.nickname}</span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void deletePlayer(p)}
                className="h-6 rounded border border-red-500/40 px-2 text-[11px] text-red-300 hover:bg-red-500/10 disabled:opacity-40"
              >
                제거
              </button>
            </div>
          ))
        )}
      </div>

      {/* 초기화 */}
      <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
        <h3 className="text-xs font-semibold text-zinc-300">세션 종료 / 다음 팀 준비</h3>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void reset("runtime")}
            className="h-8 rounded border border-orange-400/60 px-3 text-xs text-orange-300 hover:bg-orange-500/10 disabled:opacity-40"
          >
            진행 상태만 초기화 (참가자 유지)
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void reset("all")}
            className="h-8 rounded bg-red-600 px-3 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-40"
          >
            ⚠ 세션 종료 / 다음 팀 준비 (참가자 포함 초기화)
          </button>
        </div>
        <p className="text-[11px] text-zinc-500">
          설정/시드(game_state·규칙)는 삭제되지 않고 초기값으로 복원됩니다 — 곧바로
          다시 게임 시작 가능.
        </p>
      </div>
    </section>
  );
}
