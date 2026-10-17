import { AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { loadFont } from '@remotion/google-fonts/NotoSansKR';
import { Diagram, THEMES } from './Diagrams';
import type { Scene, VideoScript } from './scenes';

const sans = loadFont('normal', {
  weights: ['400', '500', '700', '900'],
  subsets: ['korean', 'latin'],
  ignoreTooManyRequestsWarning: true,
}).fontFamily;

type SceneTiming = { frames: number; audio?: string | null; narrSec?: number };
export type RuleVideoProps = { script: VideoScript; timings: SceneTiming[] };

/**
 * Iteration 4(2026-10-17 또니) — 검정 배경 대신 테마 배경 그림(video/assets/bg, gen-bg.mjs) 위에 도식.
 * 디펜스 = 극장 무대·괴수 도시(커튼 레드·골드), 마피아 = 누아르 세피아 도시. 장면 id별 배경.
 */
const BG: Record<VideoScript['id'], Record<string, string>> = {
  defense: {
    S1: 'bg/stage-defense.png',
    S2: 'bg/stage-defense.png',
    S3: 'bg/stage-defense.png',
    S4: 'bg/stage-defense.png',
    S5: 'bg/alley-defense.png',
    S6: 'bg/alley-defense.png',
    S7: 'bg/city-defense.png',
    S8: 'bg/city-defense.png',
    S9: 'bg/city-defense.png',
    S10: 'bg/alley-defense.png',
    S11: 'bg/stage-defense.png',
    S12: 'bg/stage-defense.png',
    S13: 'bg/stage-defense.png',
  },
  mafia: {
    S1: 'bg/skyline-mafia.png',
    S2: 'bg/skyline-mafia.png',
    S3: 'bg/hall-mafia.png',
    S4: 'bg/hall-mafia.png',
    S5: 'bg/skyline-mafia.png',
    S6: 'bg/skyline-mafia.png',
    S7: 'bg/floor-mafia.png',
    S8: 'bg/floor-mafia.png',
    S9: 'bg/hall-mafia.png',
    S10: 'bg/hall-mafia.png',
    S11: 'bg/floor-mafia.png',
    S12: 'bg/skyline-mafia.png',
    S13: 'bg/skyline-mafia.png',
  },
};

/** 룰 영상 — 테마 배경 + 큰 자막 + 도식. 장면 길이는 build.mjs가 나레이션 길이로 정한다. */
export const RuleVideo = ({ script, timings }: RuleVideoProps) => {
  const theme = THEMES[script.id];
  const frames = script.scenes.map((_, i) => timings[i]?.frames ?? 5 * 30);
  const starts = frames.reduce<number[]>((acc, f, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1]! + frames[i - 1]!);
    return acc;
  }, []);
  // 장 이름은 다음 장이 나올 때까지 이어진다(왼쪽 위 표시용).
  let label = '';
  const labels = script.scenes.map((s) => {
    if (s.chapter) label = s.chapter;
    return label;
  });
  return (
    <AbsoluteFill style={{ background: theme.bg, fontFamily: sans, color: theme.text }}>
      {script.scenes.map((scene, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={frames[i]}>
          <SceneView
            scene={scene}
            bg={BG[script.id][scene.id] ?? Object.values(BG[script.id])[0]!}
            frames={frames[i]!}
            narrSec={timings[i]?.narrSec ?? frames[i]! / 30}
            label={labels[i]!}
            gameTitle={script.title}
            gameId={script.id}
          />
          {timings[i]?.audio ? <Audio src={staticFile(timings[i].audio!)} volume={1} /> : null}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

/** 배경 그림 — 천천히 확대(살아 있는 느낌) + 테마색 어둡게 + 가장자리 비네트. 글자가 읽히도록 중앙은 더 어둡다. */
const Backdrop = ({ src, frames, gameId }: { src: string; frames: number; gameId: VideoScript['id'] }) => {
  const frame = useCurrentFrame();
  const theme = THEMES[gameId];
  const scale = interpolate(frame, [0, Math.max(frames, 1)], [1.04, 1.12]);
  const rgb = theme.bgRgb;
  return (
    <AbsoluteFill>
      <Img
        src={staticFile(src)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale})`, filter: 'blur(1.5px) saturate(0.9)' }}
      />
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, rgba(${rgb},0.80) 0%, rgba(${rgb},0.66) 45%, rgba(${rgb},0.80) 100%)`,
        }}
      />
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at center, rgba(${rgb},0) 45%, rgba(${rgb},0.55) 100%)` }} />
    </AbsoluteFill>
  );
};

const SceneView = ({
  scene,
  bg,
  frames,
  narrSec,
  label,
  gameTitle,
  gameId,
}: {
  scene: Scene;
  bg: string;
  frames: number;
  narrSec: number;
  label: string;
  gameTitle: string;
  gameId: VideoScript['id'];
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = interpolate(frame, [0, fps * 0.5, frames - fps * 0.5, frames], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <Backdrop src={bg} frames={frames} gameId={gameId} />
      <Diagram scene={scene} frames={frames} narrSec={narrSec} label={label} gameTitle={gameTitle} />
    </AbsoluteFill>
  );
};
