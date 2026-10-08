import CHAPTERS from "@/video/generated/chapters.json";
import type { RoomGame } from "@/lib/types";

/**
 * 룰 영상 안의 **장(章)** — GM이 "여기부터" 재생할 때 쓰는 이동 지점.
 * 손으로 적지 않는다: video/src/scenes.ts의 chapter 이름에서 video/build.mjs가
 * 실제 장면 길이로 시작 초를 계산해 video/generated/chapters.json에 쓴다.
 * 마지막 항목 "끝"은 이동 지점이 아니라 영상 전체 길이다.
 */
export interface RuleVideoChapter {
  label: string;
  atSec: number;
}

export type RuleVideoId = "defense" | "mafia";

export interface RuleVideoDef {
  id: RuleVideoId;
  name: string;
  /** public/video/<id>.mp4 */
  src: string;
  /** 언제 트는 영상인지 한 줄 */
  hint: string;
  /** 이 영상을 틀 수 있는 방의 게임 */
  game: Extract<RoomGame, "defense" | "mafia">;
}

export const RULE_VIDEOS: readonly RuleVideoDef[] = [
  {
    id: "defense",
    name: "디펜스 딜레마 · 규칙",
    src: "/video/defense.mp4",
    hint: "참가자 입장 후, 튜토리얼 1라운드 직전",
    game: "defense",
  },
  {
    id: "mafia",
    name: "자본주의 마피아 · 규칙",
    src: "/video/mafia.mp4",
    hint: "참가자 입장 후, 튜토리얼 직전",
    game: "mafia",
  },
];

const BY_ID = new Map(RULE_VIDEOS.map((v) => [v.id, v]));

export function isRuleVideoId(v: unknown): v is RuleVideoId {
  return typeof v === "string" && BY_ID.has(v as RuleVideoId);
}

export function ruleVideoOf(id: RuleVideoId): RuleVideoDef {
  const v = BY_ID.get(id);
  if (!v) throw new Error(`알 수 없는 룰 영상: ${id}`);
  return v;
}

/** 그 영상의 장 목록("끝" 포함, 없으면 빈 배열) */
export function chaptersOf(id: RuleVideoId): readonly RuleVideoChapter[] {
  return (CHAPTERS as Record<string, RuleVideoChapter[]>)[id] ?? [];
}

/** 이동 지점인 장만("끝" 제외) */
export function jumpChaptersOf(id: RuleVideoId): readonly RuleVideoChapter[] {
  return chaptersOf(id).filter((c) => c.label !== "끝");
}

/** 영상 전체 길이(초) — chapters.json의 "끝" */
export function durationOf(id: RuleVideoId): number {
  return chaptersOf(id).find((c) => c.label === "끝")?.atSec ?? 0;
}

/** sec 위치가 속한 장 이름(첫 장 전이면 null) */
export function chapterAt(id: RuleVideoId, sec: number): string | null {
  let label: string | null = null;
  for (const c of jumpChaptersOf(id)) if (sec >= c.atSec - 0.5) label = c.label;
  return label;
}

export function fmtMinSec(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
