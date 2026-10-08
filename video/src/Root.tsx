import { Composition } from 'remotion';
import { FPS, HEIGHT, SCRIPTS, WIDTH } from './scenes';
import timings from '../generated/timings.json';
import { RuleVideo } from './RuleVideo';

type Timings = Record<string, { scenes: { frames: number }[]; total: number }>;
const T = timings as Timings;

export const RemotionRoot = () => (
  <>
    {SCRIPTS.map((script) => {
      const t = T[script.id] ?? {
        scenes: script.scenes.map(() => ({ frames: 5 * FPS })),
        total: script.scenes.length * 5 * FPS,
      };
      return (
        <Composition
          key={script.id}
          id={script.id}
          component={RuleVideo}
          durationInFrames={t.total}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ script, timings: t.scenes }}
        />
      );
    })}
  </>
);
