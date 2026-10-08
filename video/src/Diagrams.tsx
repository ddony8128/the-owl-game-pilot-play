// 룰 영상 도식 — 검정 배경 위에 큰 글자·카드·표·화살표. 그림·사진·이모지 없음.
// 올림포스 마피아 video/src/Diagrams.tsx의 방식(useClock으로 장면 안 초를 재고 at()으로
// 요소를 순차 등장)을 옮겨 왔고, 그 게임 전용 도식(좌석·캐릭터)은 뺐다.
//
// 화면 글자는 scenes.ts의 screen(정본 「」 글자 그대로)에서 온다. 나누어 그릴 때는
// 정본의 구분자(' / ' · ' → ' · ' · ')로만 나누고, 구분자 자체도 화면에 다시 그린다.
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { CSSProperties, ReactNode } from 'react';
import type { Scene } from './scenes';

const TXT = '#f4f4f5';
const MUT = '#a1a1aa';
const DIM = '#52525b';
const GOLD = '#fbbf24';
const RED = '#f87171';
const BLUE = '#7dd3fc';
const GREEN = '#4ade80';
const PANEL = 'rgba(39,39,42,0.55)';

type Props = { scene: Scene; frames: number; narrSec: number; label: string; gameTitle: string };

/** 장면 안 시간 도우미 + 나레이션 문구가 들리는 시점(cue) */
function useClock(scene: Scene, narrSec: number) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = frame / fps;
  /** t초에 등장(스프링 0→1) */
  const at = (t: number) => spring({ frame: frame - t * fps, fps, config: { damping: 200 } });
  /** 나레이션에서 phrase가 시작되는 초(약간 앞당김). 없으면 fallback 비율. */
  const cue = (phrase: string | undefined, fallback = 0) => {
    const n = scene.narration;
    const idx = phrase ? n.indexOf(phrase) : -1;
    const frac = idx >= 0 ? idx / n.length : fallback;
    return Math.max(0.3, narrSec * frac - 0.2);
  };
  const cues = (scene.data?.cues as string[] | undefined) ?? [];
  return { sec, at, cue, cues, fps };
}

// ── 공용 조각 ──────────────────────────────────────────

const Label = ({ text, game }: { text: string; game: string }) => (
  <div style={{ position: 'absolute', left: 110, top: 56, display: 'flex', gap: 24, alignItems: 'baseline' }}>
    <span style={{ fontSize: 50, fontWeight: 900, color: GOLD }}>{text}</span>
    <span style={{ fontSize: 30, color: DIM, fontWeight: 500 }}>{game}</span>
  </div>
);

const Stage = ({ children, top = 170, gap = 36 }: { children: ReactNode; top?: number; gap?: number }) => (
  <AbsoluteFill
    style={{
      padding: `${top}px 110px 70px`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap,
    }}
  >
    {children}
  </AbsoluteFill>
);

const Pop = ({ p, children, style }: { p: number; children: ReactNode; style?: CSSProperties }) => (
  <div style={{ opacity: p, transform: `translateY(${(1 - p) * 18}px)`, ...style }}>{children}</div>
);

const Box = ({
  children,
  accent = '#3f3f46',
  style,
}: {
  children: ReactNode;
  accent?: string;
  style?: CSSProperties;
}) => (
  <div
    style={{
      border: `3px solid ${accent}`,
      borderRadius: 24,
      background: PANEL,
      padding: '22px 34px',
      wordBreak: 'keep-all',
      lineHeight: 1.35,
      ...style,
    }}
  >
    {children}
  </div>
);

const Arrow = ({ dir = 'right', size = 56, color = MUT }: { dir?: 'right' | 'down'; size?: number; color?: string }) => (
  <span style={{ fontSize: size, color, fontWeight: 700, lineHeight: 1 }}>{dir === 'right' ? '→' : '↓'}</span>
);

/** ' → '로 나뉜 글을 칩·화살표로 */
const Chain = ({
  text,
  size = 46,
  accent = '#3f3f46',
  color = TXT,
  vertical = false,
}: {
  text: string;
  size?: number;
  accent?: string;
  color?: string;
  vertical?: boolean;
}) => {
  const parts = text.split(' → ');
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: vertical ? 'column' : 'row',
        alignItems: 'center',
        gap: vertical ? 10 : 22,
        flexWrap: vertical ? 'nowrap' : 'wrap',
        justifyContent: 'center',
      }}
    >
      {parts.map((t, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: vertical ? 'column' : 'row', alignItems: 'center', gap: vertical ? 10 : 22 }}>
          {i > 0 ? <Arrow dir={vertical ? 'down' : 'right'} size={size} /> : null}
          <Box accent={accent} style={{ fontSize: size, fontWeight: 700, color, padding: '14px 28px', textAlign: 'center' }}>
            {t}
          </Box>
        </div>
      ))}
    </div>
  );
};

/** 숫자 카드 (활성 = 밝음, 비활성 = 어둡고 점선) */
const NumCard = ({ n, active = true, size = 1 }: { n: string; active?: boolean; size?: number }) => (
  <div
    style={{
      width: 150 * size,
      height: 210 * size,
      borderRadius: 22 * size,
      border: `${5 * size}px ${active ? 'solid' : 'dashed'} ${active ? GOLD : DIM}`,
      background: active ? '#fafaf9' : '#18181b',
      color: active ? '#18181b' : DIM,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 110 * size,
      fontWeight: 900,
    }}
  >
    {n}
  </div>
);

const MonsterBox = ({ name, hp, sub, dim }: { name: string; hp: string; sub?: ReactNode; dim?: boolean }) => (
  <Box accent={dim ? DIM : RED} style={{ textAlign: 'center', minWidth: 360, opacity: dim ? 0.5 : 1 }}>
    <div style={{ fontSize: 44, fontWeight: 700, color: MUT }}>{name}</div>
    <div style={{ fontSize: 72, fontWeight: 900, color: RED }}>{hp}</div>
    {sub}
  </Box>
);

const Note = ({ text, p, color = MUT, size = 38 }: { text: string; p: number; color?: string; size?: number }) => (
  <Pop p={p} style={{ fontSize: size, color, fontWeight: 500, textAlign: 'center', wordBreak: 'keep-all' }}>
    {text}
  </Pop>
);

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const strs = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);

// ── 장면 ──────────────────────────────────────────────

const Title = ({ scene }: Props) => {
  const { at } = useClock(scene, 0);
  const p = at(0.2);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 160, height: 5, background: GOLD, marginBottom: 46, opacity: p }} />
      <div style={{ fontSize: 120, fontWeight: 900, color: TXT, opacity: p, transform: `scale(${0.94 + 0.06 * p})` }}>
        {scene.screen[0]}
      </div>
      <div style={{ width: 160, height: 5, background: GOLD, marginTop: 50, opacity: p }} />
    </AbsoluteFill>
  );
};

/** 목표 — 큰 문장(들) + (디펜스) 함께 치는 그림 */
const Goal = (props: Props) => {
  const { scene, narrSec } = props;
  const { at, cue } = useClock(scene, narrSec);
  const defense = props.gameTitle.startsWith('디펜스');
  return (
    <Stage>
      {scene.screen.map((t, i) => (
        <Pop key={i} p={at(0.3 + i * 1.6)}>
          <Box accent={i === 0 ? GOLD : '#3f3f46'} style={{ fontSize: i === 0 ? 72 : 58, fontWeight: 900, textAlign: 'center' }}>
            {t}
          </Box>
        </Pop>
      ))}
      {defense ? (
        <Pop p={at(cue('같이 쳐야', 0.6))} style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
          <div style={{ display: 'flex', gap: 18 }}>
            {['A', 'B', 'C'].map((x) => (
              <div
                key={x}
                style={{
                  width: 110,
                  height: 110,
                  borderRadius: 999,
                  border: `4px solid ${BLUE}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 52,
                  fontWeight: 900,
                  color: BLUE,
                }}
              >
                {x}
              </div>
            ))}
          </div>
          <Arrow />
          <MonsterBox name="몬스터" hp="처치" />
          <Arrow />
          <Box accent={GOLD} style={{ fontSize: 52, fontWeight: 900, color: GOLD }}>
            점수 ÷ 3
          </Box>
        </Pop>
      ) : null}
      {str(scene.data?.note) ? <Note text={str(scene.data?.note)} p={at(cue('모두 현금', 0.8))} /> : null}
    </Stage>
  );
};

/** 카드 4장 + 활성/비활성 */
const Cards = ({ scene, narrSec }: Props) => {
  const { sec, at, cue } = useClock(scene, narrSec);
  const nums = scene.screen[0]!.split(' ');
  const [onLabel, offLabel] = scene.screen[1]!.split(' / ');
  const offAt = cue('전투에 쓴', 0.6);
  const backAt = cue('휴식으로', 0.8);
  const off = sec >= offAt && sec < backAt;
  return (
    <Stage gap={60}>
      <div style={{ display: 'flex', gap: 40 }}>
        {nums.map((n, i) => (
          <Pop key={n} p={at(0.3 + i * 0.25)}>
            <NumCard n={n} active={!(off && i === 2)} />
          </Pop>
        ))}
      </div>
      <Pop p={at(cue('두 상태', 0.35))} style={{ display: 'flex', gap: 60, alignItems: 'center', fontSize: 56, fontWeight: 700 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <NumCard n="" active size={0.32} />
          <span style={{ color: GOLD }}>{onLabel}</span>
        </span>
        <span style={{ color: MUT }}>/</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <NumCard n="" active={false} size={0.32} />
          <span style={{ color: MUT }}>{offLabel}</span>
        </span>
      </Pop>
      <Note
        text={off ? '전투에 쓴 카드 → 비활성' : sec >= backAt ? '휴식 → 다시 활성' : ' '}
        p={sec >= offAt ? 1 : 0}
        size={44}
      />
    </Stage>
  );
};

/** 세 가지 행동 */
const Actions = ({ scene, narrSec }: Props) => {
  const { at, cue, cues } = useClock(scene, narrSec);
  const names = scene.screen[0]!.split(' / ');
  const sums = strs(scene.data?.summaries);
  const [exA, exB] = scene.screen[1]!.split(' + ');
  const colors = [RED, GREEN, BLUE];
  return (
    <Stage gap={40}>
      <div style={{ display: 'flex', gap: 34, width: '100%' }}>
        {names.map((n, i) => (
          <Pop key={n} p={at(cue(cues[i], 0.1 + i * 0.25))} style={{ flex: 1 }}>
            <Box accent={colors[i]} style={{ height: 470, display: 'flex', flexDirection: 'column', gap: 22 }}>
              <div style={{ fontSize: 66, fontWeight: 900, color: colors[i] }}>{n}</div>
              <div style={{ fontSize: 42, fontWeight: 500 }}>{sums[i]}</div>
              {i === 2 ? (
                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 46, fontWeight: 900, color: GOLD, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span>{exA}</span>
                    <span style={{ color: MUT }}>+</span>
                    <span>{exB}</span>
                  </div>
                  <div style={{ fontSize: 36, color: MUT }}>{str(scene.data?.note)}</div>
                </div>
              ) : null}
            </Box>
          </Pop>
        ))}
      </div>
      <Note text={str(scene.data?.secret)} p={at(cue(cues[3], 0.9))} color={TXT} size={42} />
    </Stage>
  );
};

/** 몬스터 표 6행 */
const Monsters = ({ scene, narrSec }: Props) => {
  const { at, cue } = useClock(scene, narrSec);
  const head = scene.screen[0]!.split(' / ');
  const rows = (scene.data?.rows as string[][]) ?? [];
  const cell = (t: string, i: number, headRow = false): CSSProperties => ({
    flex: i === 0 ? 2.2 : 1,
    textAlign: i === 0 ? 'left' : 'center',
    fontSize: headRow ? 42 : 50,
    fontWeight: headRow ? 700 : i === 0 ? 700 : 900,
    color: headRow ? MUT : i === 1 ? RED : i === 3 ? GOLD : TXT,
  });
  return (
    <Stage gap={26}>
      <div style={{ width: 1400 }}>
        <div style={{ display: 'flex', padding: '10px 30px', borderBottom: `3px solid ${DIM}` }}>
          {head.map((h, i) => (
            <div key={h} style={cell(h, i, true)}>
              {h}
            </div>
          ))}
        </div>
        {rows.map((r, ri) => (
          <Pop key={r[0]} p={at(cue('여섯 종류', 0.05) + ri * 0.45)}>
            <div style={{ display: 'flex', padding: '14px 30px', borderBottom: `1px solid #27272a` }}>
              {r.map((c, i) => (
                <div key={i} style={cell(c, i)}>
                  {c}
                </div>
              ))}
            </div>
          </Pop>
        ))}
      </div>
      <Note text={str(scene.data?.note)} p={at(cue('자세한 수치', 0.8))} />
    </Stage>
  );
};

/** 대기열 칸 */
const Queue = ({ scene, narrSec }: Props) => {
  const { at, cue } = useClock(scene, narrSec);
  const sizes = scene.screen[0]!.split(' / ');
  const fill = strs(scene.data?.fill);
  const fillAt = cue('대기열에 올라온', 0.1);
  return (
    <Stage gap={44}>
      <div style={{ display: 'flex', gap: 26 }}>
        {fill.map((m, i) => {
          const p = at(fillAt + 0.6 + i * 0.5);
          return (
            <div
              key={i}
              style={{
                width: 330,
                height: 200,
                borderRadius: 22,
                border: `4px dashed ${DIM}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{ opacity: p, transform: `scale(${0.8 + 0.2 * p})`, fontSize: 44, fontWeight: 900, color: RED, textAlign: 'center' }}>
                {m}
              </div>
            </div>
          );
        })}
      </div>
      <Pop p={at(cue('대기열 칸 수는', 0.3))} style={{ display: 'flex', gap: 30, alignItems: 'center' }}>
        <Box accent={GOLD} style={{ fontSize: 54, fontWeight: 900 }}>
          {sizes[0]}
        </Box>
        <span style={{ fontSize: 54, color: MUT }}>/</span>
        <Box accent={GOLD} style={{ fontSize: 54, fontWeight: 900 }}>
          {sizes[1]}
        </Box>
      </Pop>
      <Pop p={at(cue('총 마릿수', 0.6))}>
        <Box style={{ fontSize: 54, fontWeight: 900 }}>{scene.screen[1]}</Box>
      </Pop>
      <Note text={str(scene.data?.note)} p={at(cue('인원에 따라', 0.8))} />
    </Stage>
  );
};

/** 전투 처리(처치) */
const Combat = ({ scene, narrSec }: Props) => {
  const { at, cue } = useClock(scene, narrSec);
  const cards = strs(scene.data?.cards);
  const sumAt = cue('모두 더합니다', 0.35);
  const killAt = cue('처치입니다', 0.5);
  const shareAt = cue('점수는', 0.65);
  return (
    <Stage gap={46}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 50 }}>
        <div style={{ display: 'flex', gap: 22 }}>
          {cards.map((c, i) => (
            <Pop key={i} p={at(0.6 + i * 0.5)}>
              <NumCard n={c} size={0.85} />
            </Pop>
          ))}
        </div>
        <Arrow size={80} />
        <MonsterBox
          name={str(scene.data?.monster)}
          hp={scene.screen[0]!}
          sub={
            <div style={{ fontSize: 72, fontWeight: 900, color: GREEN, opacity: at(killAt) }}>{scene.screen[1]}</div>
          }
        />
      </div>
      <Pop p={at(sumAt)}>
        <Box accent={GOLD} style={{ fontSize: 60, fontWeight: 900, color: GOLD }}>
          {str(scene.data?.sum)}
        </Box>
      </Pop>
      <Pop p={at(shareAt)}>
        <Box style={{ fontSize: 56, fontWeight: 900 }}>{str(scene.data?.share)}</Box>
      </Pop>
      <Note text={str(scene.data?.note)} p={at(cue('나누어떨어지지', 0.85))} />
    </Stage>
  );
};

/** 나머지 버림 예시 */
const Remainder = ({ scene, narrSec }: Props) => {
  const { at, cue } = useClock(scene, narrSec);
  return (
    <Stage gap={50}>
      <Pop p={at(cue('예를 들어', 0.05))}>
        <Chain text={scene.screen[0]!} size={58} accent={GOLD} />
      </Pop>
      <Pop p={at(cue('2점짜리', 0.45))}>
        <Chain text={scene.screen[1]!} size={58} accent={RED} />
      </Pop>
      <Note text={str(scene.data?.foot)} p={at(cue('누구와 같이', 0.75))} color={TXT} size={46} />
    </Stage>
  );
};

/** 처치 실패 */
const Fail = ({ scene, narrSec }: Props) => {
  const { at, cue } = useClock(scene, narrSec);
  const cards = strs(scene.data?.cards);
  return (
    <Stage gap={46}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 50 }}>
        <Pop p={at(0.5)}>
          <NumCard n={cards[0] ?? ''} size={0.85} />
        </Pop>
        <Arrow size={80} />
        <MonsterBox name={str(scene.data?.monster)} hp={scene.screen[0]!} />
        <Pop p={at(cue('깎인 체력', 0.4))} style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
          <Arrow size={80} />
          <Box accent={RED} style={{ fontSize: 58, fontWeight: 900, color: RED }}>
            {scene.screen[1]}
          </Box>
        </Pop>
      </div>
      <Pop p={at(cue('못 미치면', 0.1))}>
        <Box accent={GOLD} style={{ fontSize: 58, fontWeight: 900, color: GOLD }}>
          {str(scene.data?.sum)}
        </Box>
      </Pop>
      <Note text={str(scene.data?.note)} p={at(cue('낸 카드는', 0.75))} size={44} />
    </Stage>
  );
};

/** 라운드 종료와 도망 */
const Escape = ({ scene, narrSec }: Props) => {
  const { sec, at, cue, cues } = useClock(scene, narrSec);
  const mons = (scene.data?.monsters as string[][]) ?? [];
  const cards = strs(scene.data?.cards);
  const decAt = cue(cues[0], 0.15);
  const runAt = cue(cues[1], 0.3);
  const penAt = cue(cues[2], 0.55);
  const refillAt = cue(cues[3], 0.85);
  const [remLabel, runLabel, penalty] = scene.screen;
  return (
    <Stage gap={40}>
      <div style={{ display: 'flex', gap: 24 }}>
        {mons.map(([name, left], i) => {
          const n = Number(left) - (sec >= decAt ? 1 : 0);
          const gone = n <= 0 && sec >= runAt;
          const refilled = gone && sec >= refillAt;
          return (
            <Box
              key={i}
              accent={gone ? DIM : RED}
              style={{ width: 360, textAlign: 'center', position: 'relative', opacity: gone && !refilled ? 0.55 : 1 }}
            >
              <div style={{ fontSize: 44, fontWeight: 900, color: refilled ? MUT : RED }}>{refilled ? '새 몬스터' : name}</div>
              <div style={{ fontSize: 36, color: MUT, marginTop: 8 }}>{remLabel}</div>
              <div style={{ fontSize: 76, fontWeight: 900, color: n <= 0 && !refilled ? RED : TXT }}>{refilled ? '?' : Math.max(0, n)}</div>
              {gone && !refilled ? (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 80,
                    fontWeight: 900,
                    color: RED,
                    transform: 'rotate(-12deg)',
                  }}
                >
                  {runLabel}
                </div>
              ) : null}
            </Box>
          );
        })}
      </div>
      <Pop p={at(penAt)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
        <div style={{ display: 'flex', gap: 22 }}>
          {cards.map((c, i) => (
            <NumCard key={c} n={c} size={0.55} active={!(i === cards.length - 1 && sec >= penAt + 0.8)} />
          ))}
        </div>
        <Box accent={RED} style={{ fontSize: 46, fontWeight: 900 }}>
          {penalty}
        </Box>
      </Pop>
      <Note text={str(scene.data?.refill)} p={at(refillAt)} size={40} />
    </Stage>
  );
};

/** 라운드 흐름 띠 (× 반복) */
const Flow = ({ scene, narrSec }: Props) => {
  const { at, cue } = useClock(scene, narrSec);
  const steps = scene.screen[0]!.split(' → ');
  return (
    <Stage gap={56}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
        {steps.map((s, i) => (
          <Pop key={i} p={at(0.4 + i * 0.45)} style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            {i > 0 ? <Arrow size={52} /> : null}
            <Box accent={i === 0 ? DIM : GOLD} style={{ fontSize: 50, fontWeight: 900, padding: '20px 26px' }}>
              {s}
            </Box>
          </Pop>
        ))}
        <Pop p={at(0.4 + steps.length * 0.45)}>
          <span style={{ fontSize: 80, fontWeight: 900, color: GOLD, marginLeft: 20 }}>{str(scene.data?.times)}</span>
        </Pop>
      </div>
      {scene.screen[1] ? (
        <Pop p={at(cue('4라운드와', 0.6))}>
          <Box accent={BLUE} style={{ fontSize: 54, fontWeight: 900, color: BLUE }}>
            {scene.screen[1]}
          </Box>
        </Pop>
      ) : null}
      {str(scene.data?.note) ? <Note text={str(scene.data?.note)} p={at(cue('', 0.45))} size={42} /> : null}
    </Stage>
  );
};

/** 종료와 순위 — 줄마다 상자, ': '는 머리말, ' → '는 칩 사슬 */
const Ending = ({ scene, narrSec }: Props) => {
  const { at } = useClock(scene, narrSec);
  const step = narrSec / (scene.screen.length + 0.5);
  return (
    <Stage gap={50}>
      {scene.screen.map((line, i) => {
        const colon = line.indexOf(': ');
        const head = colon >= 0 ? line.slice(0, colon + 1) : null;
        const body = colon >= 0 ? line.slice(colon + 2) : line;
        return (
          <Pop key={i} p={at(0.4 + i * step)} style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
            {head ? <span style={{ fontSize: 60, fontWeight: 900, color: GOLD }}>{head}</span> : null}
            <Chain text={body} size={54} accent={i === 0 ? GOLD : '#3f3f46'} />
          </Pop>
        );
      })}
    </Stage>
  );
};

/** 정리 — 네 줄 요약 */
const Summary = ({ scene, narrSec }: Props) => {
  const { at } = useClock(scene, narrSec);
  const lines = strs(scene.data?.lines);
  const step = (narrSec * 0.8) / lines.length;
  return (
    <Stage gap={30}>
      {lines.map((l, i) => (
        <Pop key={i} p={at(0.8 + i * step)} style={{ width: 1500 }}>
          <Box style={{ fontSize: 50, fontWeight: 700, display: 'flex', gap: 30, alignItems: 'center' }}>
            <span style={{ color: GOLD, fontWeight: 900, fontSize: 58 }}>{i + 1}</span>
            <span>{l}</span>
          </Box>
        </Pop>
      ))}
      <Note text={str(scene.data?.foot)} p={at(narrSec * 0.88)} size={42} />
    </Stage>
  );
};

/** 직업 경매 */
const Auction = ({ scene, narrSec }: Props) => {
  const { at, cue, cues } = useClock(scene, narrSec);
  const jobs = strs(scene.data?.jobs);
  const pick = str(scene.data?.pick);
  return (
    <Stage gap={30}>
      <div style={{ display: 'flex', gap: 50, width: '100%', alignItems: 'center' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 250px)', gap: 16 }}>
          {jobs.map((j, i) => (
            <Pop key={j} p={at(0.3 + i * 0.15)}>
              <Box
                accent={j === pick ? GOLD : '#3f3f46'}
                style={{ fontSize: 38, fontWeight: 700, textAlign: 'center', padding: '22px 10px', position: 'relative', color: j === pick ? GOLD : TXT }}
              >
                {j}
                {j === pick ? (
                  <div style={{ fontSize: 40, fontWeight: 900, marginTop: 6, opacity: at(cue('현금을 겁니다', 0.1)) }}>
                    {str(scene.data?.bet)}
                  </div>
                ) : null}
              </Box>
            </Pop>
          ))}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {scene.screen.map((t, i) => (
            <Pop key={i} p={at(cue(cues[i], 0.2 + i * 0.2))}>
              <Box accent={i === 0 ? GOLD : i === 3 ? BLUE : '#3f3f46'} style={{ fontSize: 42, fontWeight: 700 }}>
                {t.includes(' → ') ? <Chain text={t} size={40} /> : t}
              </Box>
            </Pop>
          ))}
        </div>
      </div>
      <Note text={str(scene.data?.limits)} p={at(cue('라운드에 한 번', 0.2))} size={40} color={TXT} />
    </Stage>
  );
};

/** 직업 카드 — 「이름 · 수치 · 수치」 */
const Jobs = ({ scene, narrSec }: Props) => {
  const { at, cue, cues } = useClock(scene, narrSec);
  const mafia = scene.data?.accent === 'mafia';
  const accent = mafia ? RED : BLUE;
  const [header, ...cards] = scene.screen;
  const many = cards.length > 3;
  return (
    <AbsoluteFill style={{ padding: '150px 90px 50px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Pop p={at(0.3)}>
        <div style={{ fontSize: 54, fontWeight: 900, color: accent, textAlign: 'center' }}>{header}</div>
      </Pop>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: many ? 18 : 28,
          flex: 1,
          alignContent: 'start',
        }}
      >
        {cards.map((c, i) => {
          const [name, ...rest] = c.split(' · ');
          return (
            <Pop key={i} p={at(cue(cues[i], 0.2 + i * 0.12))}>
              <Box accent={accent} style={{ padding: many ? '16px 24px' : '26px 30px', height: '100%' }}>
                <div style={{ fontSize: many ? 46 : 58, fontWeight: 900, color: accent, marginBottom: 8 }}>{name}</div>
                {rest.map((r, k) => (
                  <div key={k} style={{ fontSize: many ? 34 : 44, fontWeight: 500, marginTop: 4, display: 'flex', gap: 10 }}>
                    <span style={{ color: DIM, flexShrink: 0 }}>·</span>
                    <span>{r}</span>
                  </div>
                ))}
              </Box>
            </Pop>
          );
        })}
      </div>
      <Note text={str(scene.data?.note)} p={at(cue(mafia ? '경매 결과에 따라' : '능력은', 0.85))} size={many ? 34 : 40} color={TXT} />
    </AbsoluteFill>
  );
};

/** 주식 4종목 */
const Stocks = ({ scene, narrSec }: Props) => {
  const { at, cue } = useClock(scene, narrSec);
  const names = scene.screen[0]!.split(' · ');
  return (
    <Stage gap={50}>
      <div style={{ display: 'flex', gap: 30 }}>
        {names.map((n, i) => (
          <Pop key={n} p={at(0.4 + i * 0.35)}>
            <Box accent={GOLD} style={{ width: 360, textAlign: 'center' }}>
              <div style={{ fontSize: 50, fontWeight: 900 }}>{n}</div>
              <div style={{ fontSize: 76, fontWeight: 900, color: GOLD, marginTop: 6 }}>{scene.screen[1]}</div>
            </Box>
          </Pop>
        ))}
      </div>
      <Pop p={at(cue('거래 단계에서는', 0.35))}>
        <Box accent={GREEN} style={{ fontSize: 54, fontWeight: 900 }}>
          {scene.screen[2]}
        </Box>
      </Pop>
      <Pop p={at(cue('단, 한 라운드에', 0.75))}>
        <Box accent={RED} style={{ fontSize: 54, fontWeight: 900 }}>
          {scene.screen[3]}
        </Box>
      </Pop>
    </Stage>
  );
};

/** 처리 순서 ①~④ (세로) */
const Steps = ({ scene, narrSec }: Props) => {
  const { at, cue, cues } = useClock(scene, narrSec);
  return (
    <Stage gap={12} top={150}>
      {scene.screen.map((t, i) => (
        <Pop key={i} p={at(cue(cues[i], 0.1 + i * 0.25))} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          {i > 0 ? <Arrow dir="down" size={46} /> : null}
          <Box accent={i === 0 ? GOLD : i === 1 ? RED : i === 3 ? RED : BLUE} style={{ fontSize: i < 2 ? 46 : 52, fontWeight: 800, width: 1550, textAlign: 'center' }}>
            {t.includes(' → ') ? <Chain text={t} size={44} /> : t}
          </Box>
        </Pop>
      ))}
    </Stage>
  );
};

/** 투표 */
const Vote = ({ scene, narrSec }: Props) => {
  const { at, cue, cues } = useClock(scene, narrSec);
  const [win, none] = scene.screen[2]!.split(' / ');
  return (
    <Stage gap={44}>
      <Pop p={at(cue(cues[0], 0.15))}>
        <Box accent={GOLD} style={{ fontSize: 58, fontWeight: 900, color: GOLD }}>
          {scene.screen[0]}
        </Box>
      </Pop>
      <Pop p={at(cue(cues[1], 0.45))}>
        <Box style={{ fontSize: 54, fontWeight: 800 }}>{scene.screen[1]}</Box>
      </Pop>
      <Pop p={at(cue(cues[2], 0.65))} style={{ display: 'flex', gap: 30, alignItems: 'center' }}>
        <Chain text={win!} size={52} accent={RED} />
        <span style={{ fontSize: 52, color: MUT }}>/</span>
        <Chain text={none!} size={52} />
      </Pop>
    </Stage>
  );
};

/** 경제사범 결과 — 두 갈래 세로 도식 + 공통 */
const Criminal = ({ scene, narrSec }: Props) => {
  const { at, cue, cues } = useClock(scene, narrSec);
  const [left, right, common] = scene.screen;
  const col = (text: string, accent: string, p: number) => (
    <Pop p={p} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      {text.split(' → ').map((t, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: '100%' }}>
          {i > 0 ? <Arrow dir="down" size={40} /> : null}
          <Box accent={i === 0 ? accent : '#3f3f46'} style={{ fontSize: i === 0 ? 46 : 40, fontWeight: i === 0 ? 900 : 700, textAlign: 'center', width: '100%', padding: '12px 20px', color: i === 0 ? accent : TXT }}>
            {t}
          </Box>
        </div>
      ))}
    </Pop>
  );
  return (
    <AbsoluteFill style={{ padding: '150px 100px 50px', display: 'flex', flexDirection: 'column', gap: 26 }}>
      <div style={{ display: 'flex', gap: 60, flex: 1 }}>
        {col(left!, BLUE, at(cue(cues[0], 0.3)))}
        {col(right!, RED, at(cue(cues[1], 0.65)))}
      </div>
      <Pop p={at(0.4)}>
        <Box accent={GOLD} style={{ fontSize: 46, fontWeight: 900, textAlign: 'center', color: GOLD }}>
          {common}
        </Box>
      </Pop>
      <Note text={str(scene.data?.foot)} p={at(cue(cues[2], 0.9))} size={38} color={TXT} />
    </AbsoluteFill>
  );
};

/** 정보 공개 범위 */
const Info = ({ scene, narrSec }: Props) => {
  const { at, cue } = useClock(scene, narrSec);
  const panel = (line: string, accent: string, p: number) => {
    const [head, body] = line.split(': ');
    return (
      <Pop p={p} style={{ flex: 1 }}>
        <Box accent={accent} style={{ height: 470 }}>
          <div style={{ fontSize: 70, fontWeight: 900, color: accent }}>{head}:</div>
          {body!.split(', ').map((b, i) => (
            <div key={i} style={{ fontSize: 50, fontWeight: 700, marginTop: 18, display: 'flex', gap: 12 }}>
              <span style={{ color: DIM, flexShrink: 0 }}>·</span>
              <span>{b}</span>
            </div>
          ))}
        </Box>
      </Pop>
    );
  };
  return (
    <Stage gap={40}>
      <div style={{ display: 'flex', gap: 50, width: '100%' }}>
        {panel(scene.screen[0]!, GREEN, at(0.4))}
        {panel(scene.screen[1]!, RED, at(cue('하지만', 0.3)))}
      </div>
      <Note text={str(scene.data?.note)} p={at(cue('경찰의 조사', 0.7))} size={40} color={TXT} />
    </Stage>
  );
};

const VIEWS: Record<Scene['variant'], (p: Props) => ReactNode> = {
  title: Title,
  goal: Goal,
  cards: Cards,
  actions: Actions,
  monsters: Monsters,
  queue: Queue,
  combat: Combat,
  remainder: Remainder,
  fail: Fail,
  escape: Escape,
  flow: Flow,
  ending: Ending,
  summary: Summary,
  auction: Auction,
  jobs: Jobs,
  stocks: Stocks,
  steps: Steps,
  vote: Vote,
  criminal: Criminal,
  info: Info,
};

export const Diagram = (props: Props) => {
  const View = VIEWS[props.scene.variant];
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lp = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill>
      {props.scene.variant !== 'title' && props.label ? (
        <div style={{ opacity: lp }}>
          <Label text={props.label} game={props.gameTitle} />
        </div>
      ) : null}
      <View {...props} />
    </AbsoluteFill>
  );
};
