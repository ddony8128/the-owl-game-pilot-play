"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlayerAuth } from "@/lib/hooks/usePlayerAuth";
import { LoadingScreen } from "@/components/LoadingScreen";
import type { RoomGame } from "@/lib/types";
import { gamePath } from "@/lib/gamePath";

const GAME_LABEL: Record<RoomGame, string> = {
  mafia: "자본주의 마피아",
  defense: "디펜스 딜레마",
  subway: "이상교통",
};

const GAME_DESCRIPTION: Record<"mafia" | "defense", string> = {
  mafia: "경매 · 주식 거래 · 직업 능력 · 최종 투표",
  defense: "카드 선택 · 전투 · 훈련 · 휴식",
};

// 입장 화면 — bluecode674 포크 구성: 게임 카드 선택 → 방 코드 + 닉네임.
//  방 코드(5자리)가 채워지면(QR /?code= 포함) 그 방의 게임을 조회해 카드를 자동으로 고른다.
//  고른 게임과 방의 게임이 다르면 로그인(셀프 입장 등록) 전에 막는다 — 엉뚱한 방에 닉네임이 등록되지 않게.
export default function EntryPage() {
  const router = useRouter();
  const {
    player,
    roomCode,
    roomGame,
    enterRoom,
    isLoading: authLoading,
    error: authError,
  } = usePlayerAuth();

  const [inputRoom, setInputRoom] = useState("");
  const [inputNickname, setInputNickname] = useState("");
  const [selectedGame, setSelectedGame] = useState<"mafia" | "defense" | null>(null);
  const [roomGameHint, setRoomGameHint] = useState<{ code: string; game: RoomGame } | null>(null);
  const [mismatch, setMismatch] = useState<string | null>(null);
  // 루트(/)는 자동 이동하지 않는다. 사용자가 '입장' 또는 '이 방으로 계속'을
  // 눌렀을 때(attempted)만, 방+닉네임 검증이 끝나면 해당 게임으로 이동한다.
  const [attempted, setAttempted] = useState(false);

  // 참가 QR(/?code=)로 들어오면 주소의 ?code= 로 방 코드를 미리 채운다(마운트 뒤 window에서 읽어
  // hydration 불일치를 피한다). 닉네임만 적고 [입장]을 누르면 된다.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("code");
    if (!fromUrl) return;
    const code = fromUrl.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
    if (!code) return;
    // 동기 setState 금지 규칙(react-hooks/set-state-in-effect) — 마이크로태스크로 미룬다.
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) setInputRoom(code);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // 방 코드가 5자리가 되면 그 방의 게임을 조회해 카드를 자동 선택한다(QR로 들어온 경우 포함).
  useEffect(() => {
    const code = inputRoom.trim().toUpperCase();
    if (code.length !== 5) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/gm/rooms?code=${encodeURIComponent(code)}`, { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as { room?: { code: string; game: RoomGame } | null } | null;
        const game = json?.room?.game;
        if (cancelled || !game) return;
        setRoomGameHint({ code, game });
        if (game === "mafia" || game === "defense") {
          setSelectedGame(game);
          setMismatch(null);
        }
      } catch {
        /* 조회 실패는 무시 — 수동 선택으로 진행 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inputRoom]);

  // ITER6 C1 — 방금 입장한 방의 플레이어로 확인된 뒤에만 이동한다(이전 방 세션의 player·roomGame 으로 다른 게임 화면에 가지 않게).
  const playerInRoom = !!player && !!roomCode && player.room_code === roomCode;
  useEffect(() => {
    if (!attempted || authLoading) return;
    const path = gamePath(roomGame);
    if (playerInRoom && path) router.replace(path);
  }, [attempted, authLoading, playerInRoom, roomGame, router]);

  const handleSubmit = () => {
    const room = inputRoom.trim();
    const nick = inputNickname.trim();
    if (!selectedGame || !room || !nick) return;
    const known = roomGameHint && roomGameHint.code === room.toUpperCase() ? roomGameHint.game : null;
    if (known && known !== selectedGame) {
      setMismatch(`이 방은 ${GAME_LABEL[known]} 방입니다. 게임 선택을 확인해 주세요.`);
      return;
    }
    setMismatch(null);
    setAttempted(true);
    enterRoom(room, nick);
  };

  const handleContinue = () => {
    if (player && gamePath(roomGame)) setAttempted(true);
  };

  // 입장/계속 진행 중에만 로딩 화면. 그냥 들어오면 항상 폼이 보인다.
  if (attempted && (authLoading || (player && gamePath(roomGame)))) {
    return <LoadingScreen />;
  }

  const hasPriorSession = !!player && !!gamePath(roomGame);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-linear-to-b from-sky-600 via-sky-700 to-sky-600 px-4 text-zinc-50">
      <div className="w-full max-w-sm rounded-2xl bg-zinc-950/85 p-6 shadow-xl ring-1 ring-zinc-800/60 backdrop-blur-sm">
        <p className="mb-4 text-center text-xs font-black tracking-[0.3em] text-amber-400">부엉이게임</p>
        {hasPriorSession && (
          <div className="mb-5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="text-xs text-zinc-300">
              이전에 입장한 방{" "}
              <b className="font-mono text-amber-300">{roomCode}</b>
              {roomGame ? ` (${GAME_LABEL[roomGame]})` : ""}
            </p>
            <button
              className="mt-2 h-9 w-full rounded-lg bg-amber-400 text-sm font-semibold text-zinc-950 hover:bg-amber-300"
              onClick={handleContinue}
            >
              이 방으로 계속하기 →
            </button>
            <p className="mt-2 text-center text-[11px] text-zinc-500">
              다른 방에 들어가려면 아래에 새 방 코드를 입력하세요.
            </p>
          </div>
        )}

        <h1 className="mb-1 text-xl font-semibold">
          {hasPriorSession ? "다른 게임 입장" : "게임 선택"}
        </h1>
        <p className="mb-5 text-xs text-zinc-400">
          참여할 게임을 먼저 선택하세요.
        </p>

        <div className="mb-5 grid gap-2">
          {(["mafia", "defense"] as const).map((game) => {
            const selected = selectedGame === game;
            return (
              <button
                key={game}
                type="button"
                aria-pressed={selected}
                data-testid={`entry-game-${game}`}
                onClick={() => {
                  setSelectedGame(game);
                  setMismatch(null);
                  setAttempted(false);
                }}
                className={`rounded-xl border p-4 text-left transition ${
                  selected
                    ? "border-amber-300 bg-amber-400/15 ring-1 ring-amber-300"
                    : "border-zinc-700 bg-zinc-900 hover:border-zinc-500"
                }`}
              >
                <span className="block font-semibold text-zinc-50">{GAME_LABEL[game]}</span>
                <span className="mt-1 block text-xs text-zinc-400">{GAME_DESCRIPTION[game]}</span>
              </button>
            );
          })}
        </div>

        {selectedGame && (
          <p className="mb-3 text-sm font-semibold text-amber-300">{GAME_LABEL[selectedGame]} 입장</p>
        )}

        <input
          className="mb-2 h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm outline-none focus:border-zinc-400"
          placeholder="방 코드 (예: A3F82)"
          value={inputRoom}
          onChange={(e) => setInputRoom(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />
        <input
          className="mb-2 h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm outline-none focus:border-zinc-400"
          placeholder="닉네임을 입력하세요"
          value={inputNickname}
          onChange={(e) => setInputNickname(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />

        {(mismatch || (attempted && authError)) && (
          <p className="mb-2 text-xs text-red-400">{mismatch ?? authError}</p>
        )}

        <button
          className="mt-2 h-11 w-full rounded-lg bg-amber-400 text-sm font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-40"
          onClick={handleSubmit}
          disabled={!selectedGame || !inputRoom.trim() || !inputNickname.trim()}
        >
          {selectedGame ? `${GAME_LABEL[selectedGame]} 입장하기` : "게임을 선택하세요"}
        </button>
      </div>
    </div>
  );
}
