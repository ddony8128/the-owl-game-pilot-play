"use client";

import { useRef, useState } from "react";

const TRACKS = [
  { id: "rest_1", name: "휴식 1", src: "/bgm/rest_bgm_01.mp3" },
  { id: "rest_2", name: "휴식 2", src: "/bgm/rest_bgm_02.mp3" },
  { id: "mafia_1", name: "자본주의 마피아", src: "/bgm/mafia_bgm_01.mp3" },
  { id: "defense_1", name: "디펜스 딜레마 1", src: "/bgm/defense_bgm_01.mp3" },
  { id: "defense_2", name: "디펜스 딜레마 2", src: "/bgm/defense_bgm_02.mp3" },
  { id: "defense_3", name: "디펜스 딜레마 3", src: "/bgm/defense_bgm_03.mp3" },
  { id: "defense_4", name: "디펜스 딜레마 4", src: "/bgm/defense_bgm_04.mp3" },
  { id: "defense_5", name: "디펜스 딜레마 5", src: "/bgm/defense_bgm_05.mp3" },
  { id: "defense_6", name: "디펜스 딜레마 6", src: "/bgm/defense_bgm_06.mp3" },
];

export default function DashboardBgmPage() {
  const [playing, setPlaying] = useState<Record<string, boolean>>({});
  const [volumes, setVolumes] = useState<Record<string, number>>({});
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});

  const handlePlay = (id: string) => {
    const audio = audioRefs.current[id];
    if (audio) {
      void audio.play();
      setPlaying((prev) => ({ ...prev, [id]: true }));
    }
  };

  const handleStop = (id: string) => {
    const audio = audioRefs.current[id];
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setPlaying((prev) => ({ ...prev, [id]: false }));
  };

  const handleVolumeChange = (id: string, value: number) => {
    setVolumes((prev) => ({ ...prev, [id]: value }));
    const audio = audioRefs.current[id];
    if (audio) {
      audio.volume = value;
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4 text-sm">
      <h2 className="text-2xl font-semibold">BGM 제어</h2>
      <div className="space-y-2 text-base">
        {TRACKS.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between rounded bg-zinc-900 px-3 py-2"
          >
            <div>
              <p className="font-medium text-zinc-100">{t.name}</p>
              <p className="text-[10px] text-zinc-500">{t.src}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volumes[t.id] ?? 1}
                  className="h-1 w-32 cursor-pointer accent-amber-400"
                  onChange={(e) =>
                    handleVolumeChange(t.id, Number(e.target.value))
                  }
                />
                <span className="w-10 text-right text-[10px] text-zinc-400">
                  {Math.round((volumes[t.id] ?? 1) * 100)}%
                </span>
              </div>
              <button
                className={`h-8 w-24 rounded px-4 text-base font-semibold text-zinc-950 ${
                  playing[t.id]
                    ? "bg-emerald-500 hover:bg-emerald-400"
                    : "bg-amber-400 hover:bg-amber-300"
                }`}
                onClick={() => handlePlay(t.id)}
              >
                {playing[t.id] ? "재생 중" : "재생"}
              </button>
              <button
                className="h-8 w-24 rounded bg-zinc-700 px-4 text-base text-zinc-100 hover:bg-zinc-600"
                onClick={() => handleStop(t.id)}
              >
                정지
              </button>
              <audio
                ref={(el) => {
                  audioRefs.current[t.id] = el;
                  if (el) {
                    el.volume = volumes[t.id] ?? 1;
                  }
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
