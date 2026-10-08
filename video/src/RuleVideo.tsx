import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { loadFont } from '@remotion/google-fonts/NotoSansKR';
import { Diagram } from './Diagrams';
import type { Scene, VideoScript } from './scenes';

const sans = loadFont('normal', {
  weights: ['400', '500', '700', '900'],
  subsets: ['korean', 'latin'],
  ignoreTooManyRequestsWarning: true,
}).fontFamily;

type SceneTiming = { frames: number; audio?: string | null; narrSec?: number };
export type RuleVideoProps = { script: VideoScript; timings: SceneTiming[] };

/** 룰 영상 — 검정 배경 + 큰 자막 + 도식. 장면 길이는 build.mjs가 나레이션 길이로 정한다. */
export const RuleVideo = ({ script, timings }: RuleVideoProps) => {
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
    <AbsoluteFill style={{ background: '#000', fontFamily: sans, color: '#f4f4f5' }}>
      {script.scenes.map((scene, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={frames[i]}>
          <SceneView
            scene={scene}
            frames={frames[i]!}
            narrSec={timings[i]?.narrSec ?? frames[i]! / 30}
            label={labels[i]!}
            gameTitle={script.title}
          />
          {timings[i]?.audio ? <Audio src={staticFile(timings[i].audio!)} volume={1} /> : null}
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

const SceneView = ({
  scene,
  frames,
  narrSec,
  label,
  gameTitle,
}: {
  scene: Scene;
  frames: number;
  narrSec: number;
  label: string;
  gameTitle: string;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = interpolate(frame, [0, fps * 0.5, frames - fps * 0.5, frames], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <Diagram scene={scene} frames={frames} narrSec={narrSec} label={label} gameTitle={gameTitle} />
    </AbsoluteFill>
  );
};
