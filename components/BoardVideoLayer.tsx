"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isRuleVideoId, ruleVideoOf, type RuleVideoId } from "@/lib/ruleVideos";

/**
 * 보드 페이지(page.tsx)에 그대로 얹는 버전 — room을 URL(?room=)에서 마운트 후에 읽는다
 * (하이드레이션 안전). 보드 클라이언트 코드는 건드리지 않는다.
 */
export function BoardVideoFromUrl() {
  const [room, setRoom] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- URL 은 마운트 후에만 읽을 수 있다
    setRoom(new URLSearchParams(window.location.search).get("room")?.trim().toUpperCase() || null);
  }, []);
  return room ? <BoardVideoLayer room={room} /> : null;
}

/** 보드 폴링 주기 — GM이 [▶ 보드에서 재생]을 누른 뒤 이 안에 영상이 뜬다 */
export const BOARD_VIDEO_POLL_MS = 2000;
/** 영상을 못 불러오면 이만큼 안내를 보인 뒤 서버에 알려 GM 패널의 "재생 중"을 푼다 */
export const VIDEO_FAIL_REPORT_MS = 5000;
/** 마우스가 이만큼 멈추면 커서를 숨긴다 */
const CURSOR_IDLE_MS = 2500;

type Remote = { video: RuleVideoId | null; seekSec: number | null };

/**
 * 보드(빔) 룰 영상 레이어 — /defense-board · /mafia-board에 얹는다.
 * GM 대시보드 [룰 영상] 패널이 rooms.board_video를 바꾸면 2초 안에 전체 화면 검정
 * 오버레이로 재생하고, 끝나면 서버에 알려 GM 표시를 되돌린다.
 * (올림포스 마피아 BoardVideoOverlay를 옮겨 왔다.)
 */
export function BoardVideoLayer({ room }: { room: string }) {
  const [remote, setRemote] = useState<Remote>({ video: null, seekSec: null });
  // 이 보드에서 끝까지 본(또는 실패한) 재생 — 서버가 아직 null로 안 바뀌어도 다시 띄우지 않는다.
  const [doneFor, setDoneFor] = useState<string | null>(null);
  // 서버 값이 null → 영상으로 바뀔 때마다 새 재생(같은 영상을 다시 틀어도 처음부터).
  const [session, setSession] = useState(0);
  const lastVideoRef = useRef<RuleVideoId | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/board-video?room=${encodeURIComponent(room)}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = (await res.json()) as { video?: unknown; seekSec?: unknown };
        if (cancelled) return;
        const video = isRuleVideoId(json.video) ? json.video : null;
        const seekSec = typeof json.seekSec === "number" ? json.seekSec : null;
        if (video !== lastVideoRef.current) {
          lastVideoRef.current = video;
          setSession((s) => s + 1);
          setDoneFor(null);
        }
        setRemote((prev) =>
          prev.video === video && prev.seekSec === seekSec ? prev : { video, seekSec },
        );
      } catch {
        // 네트워크 오류는 다음 폴링에서 다시
      }
    };
    void load();
    const id = window.setInterval(() => void load(), BOARD_VIDEO_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [room]);

  const key = remote.video ? `${session}:${remote.video}` : null;
  const report = useCallback(
    (video: RuleVideoId, k: string) => {
      setDoneFor(k);
      void fetch("/api/board-video/ended", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: room, video }),
      }).catch(() => {});
    },
    [room],
  );

  if (!remote.video || !key || doneFor === key) return null;
  const video = remote.video;
  return (
    <BoardVideoOverlay
      key={key}
      videoId={video}
      seekSec={remote.seekSec}
      onEnded={() => report(video, key)}
      onFailed={() => report(video, key)}
    />
  );
}

function BoardVideoOverlay({
  videoId,
  seekSec,
  onEnded,
  onFailed,
}: {
  videoId: RuleVideoId;
  seekSec: number | null;
  onEnded: () => void;
  onFailed: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const [cursor, setCursor] = useState(true);
  const idleRef = useRef<number | null>(null);
  const onFailedRef = useRef(onFailed);
  useEffect(() => {
    onFailedRef.current = onFailed;
  }, [onFailed]);

  useEffect(() => {
    if (!failed) return;
    const t = window.setTimeout(() => onFailedRef.current(), VIDEO_FAIL_REPORT_MS);
    return () => window.clearTimeout(t);
  }, [failed]);

  const play = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    void el.play().then(
      () => setBlocked(false),
      () => {
        // 소리 있는 자동 재생이 막힘(로드 실패는 onError가 따로 처리)
        if (!el.error) setBlocked(true);
      },
    );
  }, []);

  // 처음 + GM이 장을 옮길 때(seekSec 변경) 그 위치로
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const target = Math.max(0, seekSec ?? 0);
    const apply = () => {
      if (Math.abs(el.currentTime - target) > 0.5) el.currentTime = target;
    };
    if (el.readyState >= 1) apply();
    else el.addEventListener("loadedmetadata", apply, { once: true });
    play();
    return () => el.removeEventListener("loadedmetadata", apply);
  }, [seekSec, play]);

  const wake = useCallback(() => {
    setCursor(true);
    if (idleRef.current) window.clearTimeout(idleRef.current);
    idleRef.current = window.setTimeout(() => setCursor(false), CURSOR_IDLE_MS);
  }, []);
  useEffect(() => {
    // 처음에는 커서가 보이고(초기값), 움직임이 없으면 숨긴다.
    idleRef.current = window.setTimeout(() => setCursor(false), CURSOR_IDLE_MS);
    return () => {
      if (idleRef.current) window.clearTimeout(idleRef.current);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black"
      style={{ cursor: cursor ? "default" : "none" }}
      onMouseMove={wake}
      onPointerDown={wake}
      data-testid="board-video-stage"
    >
      <video
        ref={videoRef}
        src={ruleVideoOf(videoId).src}
        className="h-full w-full object-contain"
        onEnded={onEnded}
        onError={() => {
          setBlocked(false);
          setFailed(true);
        }}
        playsInline
        preload="auto"
        data-testid="board-video"
        data-video-id={videoId}
      />
      {failed ? (
        <div
          role="alert"
          data-testid="board-video-failed"
          className="absolute max-w-3xl rounded-2xl border border-red-500 bg-black/80 px-10 py-8 text-center text-4xl font-black text-red-300"
        >
          룰 영상을 불러오지 못했습니다.
          <p className="mt-4 text-2xl font-bold text-zinc-400">
            GM 대시보드에서 다시 재생하거나, 보드 컴퓨터의 네트워크를 확인해 주세요.
          </p>
        </div>
      ) : null}
      {blocked && !failed ? (
        <button
          type="button"
          onClick={play}
          aria-label="영상 재생"
          data-testid="board-video-play"
          className="absolute flex h-32 w-32 items-center justify-center rounded-full bg-amber-400/90 text-6xl text-zinc-950"
        >
          ▶
        </button>
      ) : null}
    </div>
  );
}
