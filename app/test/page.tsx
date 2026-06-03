"use client";

import { useCallback, useEffect, useState } from "react";
import type { Player } from "@/lib/types";

// 1인 다역 테스트 콘솔.
// - 플레이어 생성/삭제(초기화)
// - 각 플레이어 입장 화면을 ?as=<닉네임> 으로 새 탭에서 열기 (탭마다 독립 플레이어)
// - GM 대시보드 바로가기
// - 게임 시작 / DB 초기화
//
// 주의: 파괴적 API 들은 서버에서 ENABLE_TEST_CONSOLE=1 일 때만 동작한다.

const PLAYER_GAMES: { key: string; label: string; href: (n: string) => string }[] =
  [
    { key: "intro", label: "인트로", href: (n) => `/intro?as=${n}` },
    { key: "subway", label: "1게임 이상교통", href: (n) => `/subway?as=${n}` },
    { key: "defense", label: "2게임 디펜스", href: (n) => `/defense?as=${n}` },
    { key: "mafia", label: "3게임 마피아", href: (n) => `/mafia?as=${n}` },
    { key: "vote", label: "투표", href: (n) => `/vote?as=${n}` },
  ];

// GM 대시보드로 가는 링크 하나. 게임 전환·규칙 공개·페이즈 진행 등은 모두 여기서.
const GM_DASHBOARD_HREF = "/dashboard/x9a2k7/main";

const enabled = process.env.NEXT_PUBLIC_ENABLE_TEST_CONSOLE === "1";

export default function TestConsolePage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [activeGame, setActiveGame] = useState<string>("-");
  const [newName, setNewName] = useState("");
  const [bulkCount, setBulkCount] = useState(6);
  const [bulkPrefix, setBulkPrefix] = useState("테스터");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [pRes, gRes] = await Promise.all([
        fetch("/api/gm/players").then((r) => r.json()),
        fetch("/api/state/game").then((r) => r.json()),
      ]);
      setPlayers((pRes?.players ?? []) as Player[]);
      setActiveGame(gRes?.gameState?.active_game ?? "-");
    } catch {
      setMsg("상태를 불러오지 못했습니다. (Supabase 연결 확인)");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const call = useCallback(
    async (url: string, body: unknown, okMsg: string) => {
      setBusy(true);
      setMsg(null);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          setMsg(
            `실패: ${json?.error ?? res.status} ${
              json?.errors ? JSON.stringify(json.errors) : ""
            }`
          );
        } else {
          setMsg(okMsg);
          await refresh();
        }
      } catch (e) {
        setMsg(`오류: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );

  const open = (href: string) => window.open(href, "_blank", "noopener");

  return (
    <div className="mx-auto max-w-4xl p-6 text-sm">
      <h1 className="text-xl font-bold">🦉 테스트 콘솔</h1>
      <p className="mt-1 text-gray-500">
        현재 active_game: <b>{activeGame}</b> · 플레이어 {players.length}명
      </p>

      {!enabled && (
        <div className="mt-3 rounded border border-amber-400 bg-amber-50 p-3 text-amber-800">
          NEXT_PUBLIC_ENABLE_TEST_CONSOLE 가 1이 아닙니다. 화면은 보이지만 생성/초기화
          API 는 서버에서 차단될 수 있습니다(ENABLE_TEST_CONSOLE=1 필요).
        </div>
      )}

      {msg && (
        <div className="mt-3 rounded border bg-gray-50 p-3 text-gray-700">
          {msg}
        </div>
      )}

      {/* 플레이어 생성 */}
      <section className="mt-6">
        <h2 className="font-semibold">① 플레이어 생성</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="닉네임"
            className="rounded border px-2 py-1"
          />
          <button
            disabled={busy || !newName.trim()}
            onClick={() =>
              call(
                "/api/test/players",
                { nickname: newName.trim() },
                `생성: ${newName.trim()}`
              ).then(() => setNewName(""))
            }
            className="rounded border px-3 py-1 hover:bg-gray-100 disabled:opacity-50"
          >
            단건 생성
          </button>
          <span className="mx-2 text-gray-300">|</span>
          <input
            value={bulkPrefix}
            onChange={(e) => setBulkPrefix(e.target.value)}
            className="w-24 rounded border px-2 py-1"
          />
          <input
            type="number"
            min={1}
            max={30}
            value={bulkCount}
            onChange={(e) => setBulkCount(Number(e.target.value))}
            className="w-16 rounded border px-2 py-1"
          />
          <button
            disabled={busy}
            onClick={() =>
              call(
                "/api/test/players",
                { count: bulkCount, prefix: bulkPrefix },
                `${bulkPrefix}1~${bulkPrefix}${bulkCount} 생성`
              )
            }
            className="rounded border px-3 py-1 hover:bg-gray-100 disabled:opacity-50"
          >
            일괄 생성
          </button>
        </div>
      </section>

      {/* 플레이어 목록 + 입장 링크 */}
      <section className="mt-6">
        <h2 className="font-semibold">② 플레이어 입장 (각 버튼 = 새 탭 = 독립 플레이어)</h2>
        {players.length === 0 ? (
          <p className="mt-2 text-gray-400">플레이어가 없습니다.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {players.map((p) => {
              const n = encodeURIComponent(p.nickname);
              return (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center gap-2 rounded border p-2"
                >
                  <b className="w-28 shrink-0">{p.nickname}</b>
                  {PLAYER_GAMES.map((g) => (
                    <button
                      key={g.key}
                      onClick={() => open(g.href(n))}
                      className="rounded bg-gray-100 px-2 py-0.5 text-xs hover:bg-gray-200"
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* GM 대시보드 */}
      <section className="mt-6">
        <h2 className="font-semibold">③ GM 대시보드</h2>
        <div className="mt-2">
          <button
            onClick={() => open(GM_DASHBOARD_HREF)}
            className="rounded border px-4 py-2 font-medium hover:bg-gray-100"
          >
            GM 대시보드 열기 →
          </button>
          <p className="mt-1 text-xs text-gray-400">
            게임 전환·규칙 공개·페이즈/라운드 진행은 모두 GM 대시보드에서 합니다.
          </p>
        </div>
      </section>

      {/* 초기화 */}
      <section className="mt-6">
        <h2 className="font-semibold text-red-600">④ DB 초기화</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {(["subway", "defense", "mafia", "vote"] as const).map((g) => (
            <button
              key={g}
              disabled={busy}
              onClick={() =>
                call(
                  "/api/test/reset",
                  { scope: "game", game: g },
                  `${g} 런타임 초기화`
                )
              }
              className="rounded border px-3 py-1 hover:bg-gray-100 disabled:opacity-50"
            >
              {g} 게임만 초기화
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            disabled={busy}
            onClick={() =>
              call(
                "/api/test/reset",
                { scope: "runtime" },
                "전체 런타임 초기화(플레이어 유지)"
              )
            }
            className="rounded border border-orange-400 px-3 py-1 text-orange-700 hover:bg-orange-50 disabled:opacity-50"
          >
            전체 런타임 초기화 (플레이어 유지)
          </button>
          <button
            disabled={busy}
            onClick={() => {
              if (
                !window.confirm(
                  "플레이어를 포함해 전부 초기화합니다(설정값은 초기 상태로 복원). 진행할까요?"
                )
              )
                return;
              void call(
                "/api/test/reset",
                { scope: "all" },
                "전체 초기화 완료 (플레이어 포함)"
              );
            }}
            className="rounded bg-red-600 px-3 py-1 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            ⚠ 전체 초기화 (플레이어 포함)
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-400">
          설정/시드(game_state·phase·rules·주가·몬스터수)는 삭제되지 않고 초기값으로
          복원됩니다 — 곧바로 다시 게임 시작 가능.
        </p>
      </section>
    </div>
  );
}
