"use client";

import { useRef, useState } from "react";

const TRACKS = [
  { id: "opening", name: "오프닝", src: "/bgm/opening.mp3" },
  { id: "subway", name: "이상교통", src: "/bgm/subway.mp3" },
  { id: "mafia", name: "자본주의 마피아", src: "/bgm/mafia.mp3" },
  { id: "quiz", name: "부엉퀴즈쇼", src: "/bgm/quiz.mp3" },
];

export default function DashboardBgmPage() {
  const [currentId, setCurrentId] = useState<string | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});

  const handlePlay = (id: string) => {
    // 다른 트랙 정지
    Object.entries(audioRefs.current).forEach(([key, audio]) => {
      if (audio && key !== id) {
        audio.pause();
        audio.currentTime = 0;
      }
    });

    const audio = audioRefs.current[id];
    if (audio) {
      void audio.play();
      setCurrentId(id);
    }
  };

  const handleStop = (id: string) => {
    const audio = audioRefs.current[id];
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    if (currentId === id) {
      setCurrentId(null);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4 text-sm">
      <h2 className="text-base font-semibold">BGM 제어</h2>
      <p className="text-xs text-zinc-400">
        각 트랙은 서버 public 디렉터리(`/public/bgm`)에 있는 파일을 사용합니다.
      </p>
      <div className="space-y-2 text-xs">
        {TRACKS.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between rounded bg-zinc-900 px-3 py-2"
          >
            <div>
              <p className="font-medium text-zinc-100">{t.name}</p>
              <p className="text-[10px] text-zinc-500">{t.src}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="h-8 rounded bg-amber-400 px-3 text-[11px] font-semibold text-zinc-950 hover:bg-amber-300"
                onClick={() => handlePlay(t.id)}
              >
                재생
              </button>
              <button
                className="h-8 rounded bg-zinc-700 px-3 text-[11px] text-zinc-100 hover:bg-zinc-600"
                onClick={() => handleStop(t.id)}
              >
                정지
              </button>
              <audio
                ref={(el) => {
                  audioRefs.current[t.id] = el;
                }}
                src={t.src}
              />
            </div>
          </div>
        ))}
        {TRACKS.length === 0 && (
          <p className="text-zinc-400">등록된 BGM 트랙이 없습니다.</p>
        )}
      </div>
    </div>
  );
}
