"use client";

import { useCallback, useEffect, useState } from "react";
import {
  chapterAt,
  durationOf,
  fmtMinSec,
  isRuleVideoId,
  jumpChaptersOf,
  ruleVideoOf,
  type RuleVideoId,
} from "@/lib/ruleVideos";
import { BOARD_VIDEO_MIGRATION } from "@/lib/boardVideo";

const POLL_MS = 3000;

type Remote = {
  video: RuleVideoId | null;
  seekSec: number | null;
  columnMissing: boolean;
  status: string | null;
};

/**
 * GM 대시보드 상단 [룰 영상] 패널 — 보드(/defense-board · /mafia-board)에서 룰 영상을 켜고 끈다.
 * 장 버튼은 그 장의 시작 초로 이동(재생 중이 아니면 그 초부터 재생).
 * 방이 종료됐거나 DB에 board_video 컬럼이 없으면 버튼을 막고 이유를 보여 준다.
 */
export function RuleVideoPanel({ room, video }: { room: string; video: RuleVideoId }) {
  const def = ruleVideoOf(video);
  const chapters = jumpChaptersOf(video);
  const [remote, setRemote] = useState<Remote | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/board-video?room=${encodeURIComponent(room)}`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as
        | { video?: unknown; seekSec?: unknown; columnMissing?: boolean; status?: string }
        | null;
      if (!res.ok || !json) return;
      setRemote({
        video: isRuleVideoId(json.video) ? json.video : null,
        seekSec: typeof json.seekSec === "number" ? json.seekSec : null,
        columnMissing: !!json.columnMissing,
        status: json.status ?? null,
      });
    } catch {
      // 다음 폴링에서 다시
    }
  }, [room]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const send = async (next: RuleVideoId | null, seekSec?: number) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/gm/rooms/video", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: room, video: next, seekSec }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) setMsg(json?.error ?? "요청이 실패했습니다.");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const ended = remote?.status === "ended";
  const missing = !!remote?.columnMissing;
  const disabled = busy || !remote || ended || missing;
  const playing = remote?.video === video;
  const playingChapter = playing ? chapterAt(video, remote?.seekSec ?? 0) : null;

  return (
    <section
      className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900 p-4"
      data-testid="rule-video-panel"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold text-zinc-100">룰 영상</h2>
        <span className="text-sm text-zinc-300">
          {def.name} · {fmtMinSec(durationOf(video))}
        </span>
        <span className="text-xs text-zinc-500">{def.hint}</span>
        {playing ? (
          <span
            className="ml-auto rounded bg-emerald-900/60 px-2 py-0.5 text-xs font-semibold text-emerald-300"
            data-testid="rule-video-playing"
          >
            보드에서 재생 중{playingChapter ? ` · ${playingChapter}` : ""}
          </span>
        ) : null}
      </div>

      {ended ? (
        <p className="text-xs text-red-300" data-testid="rule-video-ended">
          종료된 방이라 룰 영상을 재생할 수 없습니다.
        </p>
      ) : null}
      {missing ? (
        <p className="text-xs text-amber-300" data-testid="rule-video-column-missing">
          DB에 board_video 컬럼이 없습니다 — {BOARD_VIDEO_MIGRATION} 실행
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void send(video, 0)}
          disabled={disabled}
          className="rounded bg-amber-500 px-3 py-1.5 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-40"
        >
          ▶ 보드에서 재생
        </button>
        <button
          type="button"
          onClick={() => void send(null)}
          disabled={disabled || !playing}
          className="rounded bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-40"
        >
          ■ 정지
        </button>
        <span className="ml-2 text-xs text-zinc-500">장으로 이동:</span>
        {chapters.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => void send(video, Math.floor(c.atSec))}
            disabled={disabled}
            title={`${fmtMinSec(c.atSec)}부터`}
            className={`rounded-full px-2.5 py-1 text-xs disabled:opacity-40 ${
              playingChapter === c.label
                ? "bg-amber-400 text-zinc-950"
                : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      {msg ? <p className="text-xs text-red-300">{msg}</p> : null}
    </section>
  );
}
