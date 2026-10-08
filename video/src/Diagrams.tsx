// 룰 영상 도식 — 검정 배경 위에 큰 글자·카드·표·화살표 + **앱이 쓰는 기능 그림**.
// 올림포스 마피아 video/src/Diagrams.tsx의 방식(useClock으로 장면 안 초를 재고 at()으로
// 요소를 순차 등장)을 옮겨 왔고, 그 게임 전용 도식(좌석·캐릭터)은 뺐다.
//
// 화면 글자는 scenes.ts의 screen(정본 「」 글자 그대로)에서 온다. 나누어 그릴 때는
// 정본의 구분자(' / ' · ' → ' · ' · ')로만 나누고, 구분자 자체도 화면에 다시 그린다.
//
// Iteration 3 — 그림은 플레이어 휴대폰과 같은 것만 쓴다(직업 뱃지·회사 로고·몬스터·휴대폰 캡처).
// 세계관 그림(포스터·캐릭터·배경 일러스트)은 쓰지 않는다. 그림 경로는 scenes.ts의 images에
// 적고(check:video가 파일 존재를 확인) build.mjs가 video/public/으로 매번 복사한다.
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import type { CSSProperties, ReactNode } from 'react';
import type { Scene } from './scenes';

const TXT = '#f4f4f5';
const MUT = '#a1a1aa';
const DIM = '#52525b';
const GOLD = '#fbbf24';
const AMBER = '#fcd34d';
const RED = '#f87171';
const BLUE = '#7dd3fc';
const GREEN = '#4ade80';
const EMERALD = 'rgba(16,185,129,0.6)';
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

// ── 앱 그림 ───────────────────────────────────────────

/** 몬스터 6종 — lib/defense/monsters.ts와 같은 번호·수치(표 S5와 같다) */
const MONSTER: Record<string, { id: number; hp: number; rounds: number; points: number }> = {
  '스컬 스파이더': { id: 1, hp: 1, rounds: 2, points: 2 },
  '종이 연구원': { id: 2, hp: 5, rounds: 5, points: 3 },
  '복싱 팩맨': { id: 3, hp: 9, rounds: 5, points: 9 },
  슬렌더맨: { id: 4, hp: 11, rounds: 3, points: 12 },
  '문어의 악마': { id: 5, hp: 13, rounds: 2, points: 16 },
  서브웨이맨: { id: 6, hp: 15, rounds: 6, points: 21 },
};
const monsterImg = (name: string, variant: '' | '_damaged' | '_dead' | '_expired' = '') =>
  `monster/monster_${MONSTER[name]?.id ?? 1}${variant}.png`;

/** 직업 이름 → 뱃지 파일 (app/mafia/MafiaAuctionTab.tsx와 같은 매핑) */
const JOB_IMG: Record<string, string> = {
  '상승 주가조작범': 'job/up_manip.png',
  '하락 주가조작범': 'job/down_manip.png',
  강도: 'job/robber.png',
  경찰: 'job/police.png',
  세무조사원: 'job/investor.png',
  '증권사 직원': 'job/financial.png',
  사장: 'job/ceo.png',
  시장: 'job/mayor.png',
  월급쟁이: 'job/salaryman.png',
};

/** 종목 이름 → 로고 (app/mafia/MafiaStocksTab.tsx와 같은 매핑) */
const STOCK_IMG: Record<string, string> = {
  부엉교육: 'company/edu.png',
  번쩍전기: 'company/electricity.png',
  국채: 'company/owl_flag.png',
  이상교통: 'company/vehicle.png',
};

/** video/public의 그림. 흰 바탕 그림(몬스터·로고)은 tile로 둥근 칸에 담는다. */
const Pic = ({
  src,
  size,
  round = false,
  tile = false,
  style,
}: {
  src: string;
  size: number;
  round?: boolean;
  tile?: boolean;
  style?: CSSProperties;
}) => (
  <Img
    src={staticFile(src)}
    style={{
      width: size,
      height: size,
      objectFit: 'contain',
      borderRadius: round ? 999 : tile ? Math.round(size * 0.14) : 0,
      background: tile ? '#fafafa' : undefined,
      flexShrink: 0,
      ...style,
    }}
  />
);

/** 휴대폰 화면 캡처(430×880) 인셋 */
const Phone = ({ src, h, p = 1, caption }: { src: string; h: number; p?: number; caption?: string }) => (
  <div
    style={{
      opacity: p,
      transform: `translateY(${(1 - p) * 18}px)`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 10,
      flexShrink: 0,
    }}
  >
    <div
      style={{
        border: '6px solid #3f3f46',
        borderRadius: 30,
        overflow: 'hidden',
        background: '#09090b',
        boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
      }}
    >
      <Img src={staticFile(src)} style={{ height: h, width: (h * 430) / 880, display: 'block', objectFit: 'cover', objectPosition: 'top' }} />
    </div>
    {caption ? <div style={{ fontSize: 30, color: MUT, fontWeight: 500 }}>{caption}</div> : null}
  </div>
);

/** 두 그림 사이 짧은 전환(처치·피해·도망 순간) */
const Swap = ({ a, b, t, size, sec }: { a: string; b: string; t: number; size: number; sec: number }) => {
  const k = interpolate(sec, [t, t + 0.35], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <Pic src={a} size={size} tile style={{ position: 'absolute', inset: 0, opacity: 1 - k }} />
      <Pic src={b} size={size} tile style={{ position: 'absolute', inset: 0, opacity: k, transform: `scale(${1.08 - 0.08 * k})` }} />
    </div>
  );
};

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
}: {
  text: string;
  size?: number;
  accent?: string;
  color?: string;
}) => {
  const parts = text.split(' → ');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap', justifyContent: 'center' }}>
      {parts.map((t, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          {i > 0 ? <Arrow size={size} /> : null}
          <Box accent={accent} style={{ fontSize: size, fontWeight: 700, color, padding: '14px 28px', textAlign: 'center' }}>
            {t}
          </Box>
        </div>
      ))}
    </div>
  );
};

/**
 * 숫자 카드 — 앱 정보/행동 탭과 같은 모양:
 * 활성 = 에메랄드 테두리 + 호박색 숫자, 비활성 = 회색 테두리 + 흐림(60%).
 */
const NumCard = ({ n, active = true, size = 1, bare = false }: { n: string; active?: boolean; size?: number; bare?: boolean }) => (
  <div
    style={{
      width: 160 * size,
      height: 200 * size,
      borderRadius: 18 * size,
      border: `${4 * size}px solid ${active ? EMERALD : '#3f3f46'}`,
      background: active ? '#18181b' : '#09090b',
      opacity: active ? 1 : 0.6,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: `${14 * size}px ${18 * size}px`,
    }}
  >
    <span style={{ fontSize: 96 * size, fontWeight: 900, color: AMBER, lineHeight: 1 }}>{n}</span>
    {bare ? null : <span style={{ fontSize: 30 * size, color: MUT, fontWeight: 500 }}>{active ? '활성' : '비활성'}</span>}
  </div>
);

/** 몬스터 카드 — 결과 중계 보드와 같은 구성(그림 + 이름 + 체력·남은 라운드) */
const MonsterCard = ({
  name,
  pic,
  hp,
  left,
  width = 330,
  dim = false,
  leftColor = TXT,
}: {
  name: string;
  pic: ReactNode;
  hp?: string;
  left?: ReactNode;
  width?: number;
  dim?: boolean;
  leftColor?: string;
}) => (
  <div
    style={{
      width,
      borderRadius: 20,
      border: `3px solid ${dim ? '#3f3f46' : '#27272a'}`,
      background: '#18181b',
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      opacity: dim ? 0.75 : 1,
      position: 'relative',
    }}
  >
    {pic}
    <div style={{ fontSize: 38, fontWeight: 900, color: TXT }}>{name}</div>
    <div style={{ display: 'flex', gap: 10, fontSize: 30, fontWeight: 700 }}>
      {hp ? <span style={{ background: '#3f1d1d', color: RED, borderRadius: 999, padding: '2px 14px' }}>{hp}</span> : null}
      {left !== undefined ? (
        <span style={{ background: '#27272a', color: leftColor, borderRadius: 999, padding: '2px 14px' }}>{left}</span>
      ) : null}
    </div>
  </div>
);

const Note = ({ text, p, color = MUT, size = 38 }: { text: string; p: number; color?: string; size?: number }) => (
  <Pop p={p} style={{ fontSize: size, color, fontWeight: 500, textAlign: 'center', wordBreak: 'keep-all' }}>
    {text}
  </Pop>
);

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const strs = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);
const hasImg = (scene: Scene, src: string) => (scene.images ?? []).includes(src);

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
          <Box accent={RED} style={{ fontSize: 56, fontWeight: 900, color: RED }}>
            몬스터 처치
          </Box>
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

/** 카드 4장 + 활성/비활성 (앱 카드 모양) */
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
            <NumCard n={n} active={!(off && i === 2)} size={1.2} />
          </Pop>
        ))}
      </div>
      <Pop p={at(cue('두 상태', 0.35))} style={{ display: 'flex', gap: 60, alignItems: 'center', fontSize: 56, fontWeight: 700 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <NumCard n="" active size={0.4} bare />
          <span style={{ color: GREEN }}>{onLabel}</span>
        </span>
        <span style={{ color: MUT }}>/</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <NumCard n="" active={false} size={0.4} bare />
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

/** 세 가지 행동 + 휴대폰 행동 탭 */
const Actions = ({ scene, narrSec }: Props) => {
  const { at, cue, cues } = useClock(scene, narrSec);
  const names = scene.screen[0]!.split(' / ');
  const sums = strs(scene.data?.summaries);
  const [exA, exB] = scene.screen[1]!.split(' + ');
  const colors = [GREEN, MUT, '#a5b4fc'];
  return (
    <Stage gap={34}>
      <div style={{ display: 'flex', gap: 30, width: '100%', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 24, flex: 1 }}>
          {names.map((n, i) => (
            <Pop key={n} p={at(cue(cues[i], 0.1 + i * 0.25))} style={{ flex: 1 }}>
              <Box accent={colors[i]} style={{ height: 560, display: 'flex', flexDirection: 'column', gap: 20, padding: '22px 26px' }}>
                <div style={{ fontSize: 62, fontWeight: 900, color: colors[i] }}>{n}</div>
                <div style={{ fontSize: 38, fontWeight: 500 }}>{sums[i]}</div>
                {i === 2 ? (
                  <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 42, fontWeight: 900, color: GOLD, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span>{exA}</span>
                      <span style={{ color: MUT }}>+</span>
                      <span>{exB}</span>
                    </div>
                    <div style={{ fontSize: 32, color: MUT }}>{str(scene.data?.note)}</div>
                  </div>
                ) : null}
              </Box>
            </Pop>
          ))}
        </div>
        {hasImg(scene, 'shots/defense-action.png') ? (
          <Phone src="shots/defense-action.png" h={640} p={at(0.6)} caption="휴대폰 [행동] 탭" />
        ) : null}
      </div>
      <Note text={str(scene.data?.secret)} p={at(cue(cues[3], 0.9))} color={TXT} size={40} />
    </Stage>
  );
};

/** 몬스터 표 6행 — 행 앞에 몬스터 그림 */
const Monsters = ({ scene, narrSec }: Props) => {
  const { at, cue } = useClock(scene, narrSec);
  const head = scene.screen[0]!.split(' / ');
  const rows = (scene.data?.rows as string[][]) ?? [];
  const THUMB = 84;
  const cell = (i: number, headRow = false): CSSProperties => ({
    flex: i === 0 ? 2.2 : 1,
    textAlign: i === 0 ? 'left' : 'center',
    fontSize: headRow ? 40 : 48,
    fontWeight: headRow ? 700 : i === 0 ? 700 : 900,
    color: headRow ? MUT : i === 1 ? RED : i === 3 ? GOLD : TXT,
  });
  return (
    <Stage gap={22} top={150}>
      <div style={{ width: 1500 }}>
        <div style={{ display: 'flex', padding: '8px 24px', borderBottom: `3px solid ${DIM}`, alignItems: 'center' }}>
          <div style={{ width: THUMB + 24 }} />
          {head.map((h, i) => (
            <div key={h} style={cell(i, true)}>
              {h}
            </div>
          ))}
        </div>
        {rows.map((r, ri) => (
          <Pop key={r[0]} p={at(cue('여섯 종류', 0.05) + ri * 0.45)}>
            <div style={{ display: 'flex', padding: '6px 24px', borderBottom: '1px solid #27272a', alignItems: 'center' }}>
              <div style={{ width: THUMB + 24 }}>
                <Pic src={monsterImg(r[0]!)} size={THUMB} tile />
              </div>
              {r.map((c, i) => (
                <div key={i} style={cell(i)}>
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

/** 대기열 칸 — 몬스터 카드(보드와 같은 구성) */
const Queue = ({ scene, narrSec }: Props) => {
  const { at, cue } = useClock(scene, narrSec);
  const sizes = scene.screen[0]!.split(' / ');
  const fill = strs(scene.data?.fill);
  const fillAt = cue('대기열에 올라온', 0.1);
  return (
    <Stage gap={30} top={150}>
      <div style={{ display: 'flex', gap: 24 }}>
        {fill.map((m, i) => {
          const p = at(fillAt + 0.6 + i * 0.5);
          const info = MONSTER[m]!;
          return (
            <div
              key={i}
              style={{ width: 340, height: 400, borderRadius: 24, border: `4px dashed ${DIM}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <div style={{ opacity: p, transform: `scale(${0.85 + 0.15 * p})` }}>
                <MonsterCard
                  name={m}
                  pic={<Pic src={monsterImg(m)} size={210} tile />}
                  hp={`체력 ${info.hp}`}
                  left={`남은 ${info.rounds}`}
                  width={310}
                />
              </div>
            </div>
          );
        })}
      </div>
      <Pop p={at(cue('대기열 칸 수는', 0.3))} style={{ display: 'flex', gap: 30, alignItems: 'center' }}>
        <Box accent={GOLD} style={{ fontSize: 50, fontWeight: 900, padding: '14px 30px' }}>
          {sizes[0]}
        </Box>
        <span style={{ fontSize: 50, color: MUT }}>/</span>
        <Box accent={GOLD} style={{ fontSize: 50, fontWeight: 900, padding: '14px 30px' }}>
          {sizes[1]}
        </Box>
        <Box style={{ fontSize: 50, fontWeight: 900, padding: '14px 30px', marginLeft: 20, opacity: at(cue('총 마릿수', 0.6)) }}>
          {scene.screen[1]}
        </Box>
      </Pop>
      <Note text={str(scene.data?.note)} p={at(cue('인원에 따라', 0.8))} />
    </Stage>
  );
};

/** 전투 처리(처치) — 처치 순간 쓰러진 그림으로 */
const Combat = ({ scene, narrSec }: Props) => {
  const { sec, at, cue } = useClock(scene, narrSec);
  const cards = strs(scene.data?.cards);
  const name = str(scene.data?.monster);
  const sumAt = cue('모두 더합니다', 0.35);
  const killAt = cue('처치입니다', 0.5);
  const shareAt = cue('점수는', 0.65);
  return (
    <Stage gap={34} top={150}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 46 }}>
        <div style={{ display: 'flex', gap: 20 }}>
          {cards.map((c, i) => (
            <Pop key={i} p={at(0.6 + i * 0.5)}>
              <NumCard n={c} />
            </Pop>
          ))}
        </div>
        <Arrow size={80} />
        <MonsterCard
          name={name}
          pic={<Swap a={monsterImg(name)} b={monsterImg(name, '_dead')} t={killAt} size={300} sec={sec} />}
          hp={scene.screen[0]!}
          width={340}
        />
        <Pop p={at(killAt)}>
          <div style={{ fontSize: 96, fontWeight: 900, color: GREEN }}>{scene.screen[1]}</div>
        </Pop>
      </div>
      <div style={{ display: 'flex', gap: 30, alignItems: 'center' }}>
        <Pop p={at(sumAt)}>
          <Box accent={GOLD} style={{ fontSize: 56, fontWeight: 900, color: GOLD }}>
            {str(scene.data?.sum)}
          </Box>
        </Pop>
        <Pop p={at(shareAt)}>
          <Box style={{ fontSize: 52, fontWeight: 900 }}>{str(scene.data?.share)}</Box>
        </Pop>
      </div>
      <Note text={str(scene.data?.note)} p={at(cue('나누어떨어지지', 0.85))} />
    </Stage>
  );
};

/** 나머지 버림 예시 */
const Remainder = ({ scene, narrSec }: Props) => {
  const { at, cue } = useClock(scene, narrSec);
  const thumb = (scene.images ?? [])[0];
  return (
    <Stage gap={50}>
      {thumb ? <Pop p={at(0.3)}>{<Pic src={thumb} size={150} tile />}</Pop> : null}
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

/** 처치 실패 — 다친 그림, 체력 9 → 5 */
const Fail = ({ scene, narrSec }: Props) => {
  const { sec, at, cue } = useClock(scene, narrSec);
  const cards = strs(scene.data?.cards);
  const name = str(scene.data?.monster);
  const hurtAt = cue('깎인 체력', 0.4);
  return (
    <Stage gap={40} top={150}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 46 }}>
        <Pop p={at(0.5)}>
          <NumCard n={cards[0] ?? ''} />
        </Pop>
        <Arrow size={80} />
        <MonsterCard
          name={name}
          pic={<Swap a={monsterImg(name)} b={monsterImg(name, '_damaged')} t={cue('못 미치면', 0.15)} size={300} sec={sec} />}
          hp={scene.screen[0]!}
          width={340}
        />
        <Pop p={at(hurtAt)} style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
          <Arrow size={80} />
          <Box accent={RED} style={{ fontSize: 56, fontWeight: 900, color: RED }}>
            {scene.screen[1]}
          </Box>
        </Pop>
      </div>
      <Pop p={at(cue('못 미치면', 0.1))}>
        <Box accent={GOLD} style={{ fontSize: 56, fontWeight: 900, color: GOLD }}>
          {str(scene.data?.sum)}
        </Box>
      </Pop>
      <Note text={str(scene.data?.note)} p={at(cue('낸 카드는', 0.75))} size={44} />
    </Stage>
  );
};

/** 라운드 종료와 도망 — 대기열 카드, 0이 되면 도망 그림 */
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
    <Stage gap={26} top={140}>
      <div style={{ display: 'flex', gap: 22 }}>
        {mons.map(([name, left], i) => {
          const n = Number(left) - (sec >= decAt ? 1 : 0);
          const gone = n <= 0 && sec >= runAt;
          const refilled = gone && sec >= refillAt;
          const pic = refilled ? (
            <div
              style={{ width: 210, height: 210, borderRadius: 30, border: `4px dashed ${DIM}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 90, color: DIM, fontWeight: 900 }}
            >
              ?
            </div>
          ) : (
            <Swap a={monsterImg(name!)} b={monsterImg(name!, '_expired')} t={runAt} size={210} sec={n <= 0 ? sec : 0} />
          );
          return (
            <div key={i} style={{ position: 'relative' }}>
              <MonsterCard
                name={refilled ? '새 몬스터' : name!}
                pic={pic}
                left={
                  refilled ? (
                    '다음 라운드 공개'
                  ) : (
                    <>
                      {remLabel} <b style={{ fontSize: 40 }}>{Math.max(0, n)}</b>
                    </>
                  )
                }
                leftColor={n <= 0 && !refilled ? RED : TXT}
                width={350}
                dim={gone && !refilled}
              />
              {gone && !refilled ? (
                <div
                  style={{ position: 'absolute', top: 70, left: 0, right: 0, textAlign: 'center', fontSize: 92, fontWeight: 900, color: RED, transform: 'rotate(-12deg)', textShadow: '0 4px 20px #000' }}
                >
                  {runLabel}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <Pop p={at(penAt)} style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
        <div style={{ display: 'flex', gap: 14 }}>
          {cards.map((c, i) => (
            <NumCard key={c} n={c} size={0.62} active={!(i === cards.length - 1 && sec >= penAt + 0.8)} />
          ))}
        </div>
        <Box accent={RED} style={{ fontSize: 42, fontWeight: 900 }}>
          {penalty}
        </Box>
      </Pop>
      <Note text={str(scene.data?.refill)} p={at(refillAt)} size={38} />
    </Stage>
  );
};

/** 마피아 S3 — 단계 이름 → 그 단계에 쓰는 휴대폰 탭 */
const STEP_SHOT: Record<string, string> = {
  '직업 경매': 'shots/mafia-auction.png',
  '주식 거래': 'shots/mafia-trade.png',
  '주가 변동': 'shots/mafia-stocks.png',
  투표: 'shots/mafia-vote.png',
};

/** 라운드 흐름 띠 (× 반복) — 마피아는 단계 아래 휴대폰 탭 */
const Flow = ({ scene, narrSec }: Props) => {
  const { at, cue } = useClock(scene, narrSec);
  const steps = scene.screen[0]!.split(' → ');
  const withShots = steps.some((s) => STEP_SHOT[s] && hasImg(scene, STEP_SHOT[s]!));
  const fs = withShots ? 40 : 50;
  return (
    <Stage gap={withShots ? 30 : 56} top={150}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, justifyContent: 'center', flexWrap: withShots ? 'nowrap' : 'wrap' }}>
        {steps.map((s, i) => {
          const shot = STEP_SHOT[s];
          return (
            <Pop key={i} p={at(0.4 + i * 0.45)} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              {i > 0 ? (
                <div style={{ height: withShots ? 86 : 'auto', display: 'flex', alignItems: 'center' }}>
                  <Arrow size={44} />
                </div>
              ) : null}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <Box accent={i === 0 ? DIM : GOLD} style={{ fontSize: fs, fontWeight: 900, padding: '16px 22px', whiteSpace: 'nowrap' }}>
                  {s}
                </Box>
                {withShots && shot && hasImg(scene, shot) ? <Phone src={shot} h={420} /> : null}
              </div>
            </Pop>
          );
        })}
        <Pop p={at(0.4 + steps.length * 0.45)}>
          <span style={{ fontSize: 76, fontWeight: 900, color: GOLD, marginLeft: 14, lineHeight: withShots ? '86px' : undefined }}>
            {str(scene.data?.times)}
          </span>
        </Pop>
      </div>
      {scene.screen[1] ? (
        <Pop p={at(cue('4라운드와', 0.6))}>
          <Box accent={BLUE} style={{ fontSize: 54, fontWeight: 900, color: BLUE }}>
            {scene.screen[1]}
          </Box>
        </Pop>
      ) : null}
      {str(scene.data?.note) ? <Note text={str(scene.data?.note)} p={at(cue('', 0.45))} size={38} /> : null}
    </Stage>
  );
};

/** 종료와 순위 — 줄마다 상자, ': '는 머리말, ' → '는 칩 사슬. 결과 화면 캡처가 있으면 옆에 */
const Ending = ({ scene, narrSec }: Props) => {
  const { at } = useClock(scene, narrSec);
  const step = narrSec / (scene.screen.length + 0.5);
  const board = (scene.images ?? []).find((s) => s.startsWith('shots/'));
  const lines = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 44, alignItems: board ? 'flex-start' : 'center' }}>
      {scene.screen.map((line, i) => {
        const colon = line.indexOf(': ');
        const head = colon >= 0 ? line.slice(0, colon + 1) : null;
        const body = colon >= 0 ? line.slice(colon + 2) : line;
        return (
          <Pop key={i} p={at(0.4 + i * step)} style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
            {head ? <span style={{ fontSize: 60, fontWeight: 900, color: GOLD }}>{head}</span> : null}
            <Chain text={body} size={board ? 48 : 54} accent={i === 0 ? GOLD : '#3f3f46'} />
          </Pop>
        );
      })}
    </div>
  );
  if (!board) return <Stage gap={50}>{lines}</Stage>;
  return (
    <Stage gap={30}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 60 }}>
        {lines}
        <Pop p={at(step * 0.8)} style={{ flexShrink: 0 }}>
          <div style={{ border: '6px solid #3f3f46', borderRadius: 20, overflow: 'hidden' }}>
            <Img src={staticFile(board)} style={{ width: 760, height: (760 * 1016) / 1180, display: 'block' }} />
          </div>
          <div style={{ fontSize: 30, color: MUT, textAlign: 'center', marginTop: 10 }}>결과 화면(게임 종료 후)</div>
        </Pop>
      </div>
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

/** 직업 경매 — 실제 뱃지 9개 + 경매 탭 + 낙찰 규칙 */
const Auction = ({ scene, narrSec }: Props) => {
  const { at, cue, cues } = useClock(scene, narrSec);
  const jobs = strs(scene.data?.jobs);
  const pick = str(scene.data?.pick);
  const BADGE = 168;
  return (
    <Stage gap={26} top={150}>
      <div style={{ display: 'flex', gap: 36, width: '100%', alignItems: 'center' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(3, ${BADGE}px)`, gap: 18, flexShrink: 0 }}>
          {jobs.map((j, i) => (
            <Pop key={j} p={at(0.3 + i * 0.15)} style={{ position: 'relative' }}>
              <Pic
                src={JOB_IMG[j]!}
                size={BADGE}
                round
                style={{ boxShadow: j === pick ? `0 0 0 7px ${GOLD}` : undefined }}
              />
              {j === pick ? (
                <div
                  style={{
                    position: 'absolute',
                    right: -14,
                    top: -10,
                    background: GOLD,
                    color: '#18181b',
                    fontSize: 38,
                    fontWeight: 900,
                    borderRadius: 999,
                    padding: '2px 14px',
                    opacity: at(cue('현금을 겁니다', 0.1)),
                  }}
                >
                  {str(scene.data?.bet)}
                </div>
              ) : null}
            </Pop>
          ))}
        </div>
        {hasImg(scene, 'shots/mafia-auction.png') ? (
          <Phone src="shots/mafia-auction.png" h={600} p={at(0.8)} caption="휴대폰 [경매] 탭" />
        ) : null}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {scene.screen.map((t, i) => (
            <Pop key={i} p={at(cue(cues[i], 0.2 + i * 0.2))}>
              <Box accent={i === 0 ? GOLD : i === 3 ? BLUE : '#3f3f46'} style={{ fontSize: 38, fontWeight: 700, padding: '16px 24px' }}>
                {t}
              </Box>
            </Pop>
          ))}
        </div>
      </div>
      <Note text={str(scene.data?.limits)} p={at(cue('라운드에 한 번', 0.2))} size={38} color={TXT} />
    </Stage>
  );
};

/** 직업 카드 — 머리에 실제 뱃지, 「이름 · 수치 · 수치」 */
const Jobs = ({ scene, narrSec }: Props) => {
  const { at, cue, cues } = useClock(scene, narrSec);
  const mafia = scene.data?.accent === 'mafia';
  const accent = mafia ? RED : BLUE;
  const [header, ...cards] = scene.screen;
  const many = cards.length > 3;
  return (
    <AbsoluteFill style={{ padding: '140px 90px 44px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Pop p={at(0.3)}>
        <div style={{ fontSize: 52, fontWeight: 900, color: accent, textAlign: 'center' }}>{header}</div>
      </Pop>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: many ? 18 : 28, flex: 1, alignContent: 'start' }}>
        {cards.map((c, i) => {
          const [name, ...rest] = c.split(' · ');
          const badge = JOB_IMG[name!];
          return (
            <Pop key={i} p={at(cue(cues[i], 0.2 + i * 0.12))}>
              <Box accent={name === '월급쟁이' ? MUT : accent} style={{ padding: many ? '14px 22px' : '24px 28px', height: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
                  {badge ? <Pic src={badge} size={many ? 96 : 116} round /> : null}
                  <div style={{ fontSize: many ? 44 : 46, fontWeight: 900, color: name === '월급쟁이' ? MUT : accent }}>{name}</div>
                </div>
                {rest.map((r, k) => (
                  <div key={k} style={{ fontSize: many ? 32 : 42, fontWeight: 500, marginTop: 4, display: 'flex', gap: 10 }}>
                    <span style={{ color: DIM, flexShrink: 0 }}>·</span>
                    <span>{r}</span>
                  </div>
                ))}
              </Box>
            </Pop>
          );
        })}
      </div>
      <Note text={str(scene.data?.note)} p={at(cue(mafia ? '경매 결과에 따라' : '능력은', 0.85))} size={many ? 32 : 40} color={TXT} />
    </AbsoluteFill>
  );
};

/** 주식 4종목 — 로고 + 이름 + 5원 */
const Stocks = ({ scene, narrSec }: Props) => {
  const { at, cue } = useClock(scene, narrSec);
  const names = scene.screen[0]!.split(' · ');
  return (
    <Stage gap={40}>
      <div style={{ display: 'flex', gap: 30 }}>
        {names.map((n, i) => (
          <Pop key={n} p={at(0.4 + i * 0.35)}>
            <Box accent={GOLD} style={{ width: 360, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <Pic src={STOCK_IMG[n]!} size={220} tile />
              <div style={{ fontSize: 48, fontWeight: 900 }}>{n}</div>
              <div style={{ fontSize: 70, fontWeight: 900, color: GOLD }}>{scene.screen[1]}</div>
            </Box>
          </Pop>
        ))}
      </div>
      <Pop p={at(cue('거래 단계에서는', 0.35))}>
        <Box accent={GREEN} style={{ fontSize: 50, fontWeight: 900 }}>
          {scene.screen[2]}
        </Box>
      </Pop>
      <Pop p={at(cue('단, 한 라운드에', 0.75))}>
        <Box accent={RED} style={{ fontSize: 50, fontWeight: 900 }}>
          {scene.screen[3]}
        </Box>
      </Pop>
    </Stage>
  );
};

/** 처리 순서 ①~④ (세로) + 자연 변동 예시(로고 옆 +2/+1/−1) */
const NATURAL_EXAMPLE: { stock: string; delta: string; why: string; color: string }[] = [
  { stock: '번쩍전기', delta: '▲ +2', why: '매수량 1위', color: GREEN },
  { stock: '이상교통', delta: '▲ +1', why: '매수량 2위', color: GREEN },
  { stock: '부엉교육', delta: '▼ −1', why: '매도량 1위', color: RED },
  { stock: '국채', delta: '0', why: '변동 없음', color: MUT },
];
const Steps = ({ scene, narrSec }: Props) => {
  const { at, cue, cues } = useClock(scene, narrSec);
  return (
    <AbsoluteFill style={{ padding: '150px 90px 50px', display: 'flex', flexDirection: 'row', gap: 40, alignItems: 'center' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        {scene.screen.map((t, i) => (
          <Pop key={i} p={at(cue(cues[i], 0.1 + i * 0.25))} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: '100%' }}>
            {i > 0 ? <Arrow dir="down" size={44} /> : null}
            <Box
              accent={i === 0 ? GOLD : i === 1 ? RED : i === 3 ? RED : BLUE}
              style={{ fontSize: i < 2 ? 40 : 48, fontWeight: 800, width: '100%', textAlign: 'center', padding: '18px 24px' }}
            >
              {t}
            </Box>
          </Pop>
        ))}
      </div>
      <Pop p={at(cue(cues[0], 0.1) + 1.5)} style={{ width: 470, flexShrink: 0 }}>
        <Box accent={GOLD} style={{ padding: '18px 22px' }}>
          <div style={{ fontSize: 36, fontWeight: 900, color: GOLD, marginBottom: 12 }}>① 예시</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {NATURAL_EXAMPLE.map((e) => (
              <div key={e.stock} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <Pic src={STOCK_IMG[e.stock]!} size={96} tile />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 40, fontWeight: 900, color: e.color }}>{e.delta}</span>
                  <span style={{ fontSize: 28, color: MUT }}>
                    {e.stock} · {e.why}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Box>
      </Pop>
    </AbsoluteFill>
  );
};

/** 투표 — 표 가격은 시장 뱃지, 휴대폰 투표 탭 */
const Vote = ({ scene, narrSec }: Props) => {
  const { at, cue, cues } = useClock(scene, narrSec);
  const [win, none] = scene.screen[2]!.split(' / ');
  return (
    <Stage gap={30}>
      <div style={{ display: 'flex', gap: 50, alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 34, alignItems: 'flex-start' }}>
          <Pop p={at(cue(cues[0], 0.15))} style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            {hasImg(scene, 'job/mayor.png') ? <Pic src="job/mayor.png" size={130} round /> : null}
            <Box accent={GOLD} style={{ fontSize: 52, fontWeight: 900, color: GOLD }}>
              {scene.screen[0]}
            </Box>
          </Pop>
          <Pop p={at(cue(cues[1], 0.45))}>
            <Box style={{ fontSize: 50, fontWeight: 800 }}>{scene.screen[1]}</Box>
          </Pop>
          <Pop p={at(cue(cues[2], 0.65))} style={{ display: 'flex', gap: 22, alignItems: 'center' }}>
            <Chain text={win!} size={46} accent={RED} />
            <span style={{ fontSize: 46, color: MUT }}>/</span>
            <Chain text={none!} size={46} />
          </Pop>
        </div>
        {hasImg(scene, 'shots/mafia-vote.png') ? (
          <Phone src="shots/mafia-vote.png" h={620} p={at(0.8)} caption="휴대폰 [투표] 탭" />
        ) : null}
      </div>
    </Stage>
  );
};

/** 경제사범 결과 — 두 갈래 세로 도식 + 공통. 상자 옆에 국채 로고·경찰 뱃지·마피아 뱃지 */
const CRIMINAL_ICONS: Record<string, string[]> = {
  '국채 +1': ['company/owl_flag.png'],
  '시민 국채 1주 / 경찰 국채 2주': ['job/police.png', 'company/owl_flag.png'],
  '모든 마피아에게 가장 비싼 주식 1주 (동률이면 무작위)': ['job/up_manip.png', 'job/down_manip.png', 'job/robber.png'],
};
const Criminal = ({ scene, narrSec }: Props) => {
  const { at, cue, cues } = useClock(scene, narrSec);
  const [left, right, common] = scene.screen;
  const col = (text: string, accent: string, p: number) => (
    <Pop p={p} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      {text.split(' → ').map((t, i) => {
        const icons = (CRIMINAL_ICONS[t] ?? []).filter((s) => hasImg(scene, s));
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: '100%' }}>
            {i > 0 ? <Arrow dir="down" size={38} /> : null}
            <Box
              accent={i === 0 ? accent : '#3f3f46'}
              style={{
                fontSize: i === 0 ? 44 : 38,
                fontWeight: i === 0 ? 900 : 700,
                width: '100%',
                padding: '10px 20px',
                color: i === 0 ? accent : TXT,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 18,
                textAlign: 'center',
              }}
            >
              {icons.length ? (
                <span style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  {icons.map((s) => (
                    <Pic key={s} src={s} size={86} round={s.startsWith('job/')} tile={s.startsWith('company/')} />
                  ))}
                </span>
              ) : null}
              <span>{t}</span>
            </Box>
          </div>
        );
      })}
    </Pop>
  );
  return (
    <AbsoluteFill style={{ padding: '140px 90px 44px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', gap: 50, flex: 1 }}>
        {col(left!, BLUE, at(cue(cues[0], 0.3)))}
        {col(right!, RED, at(cue(cues[1], 0.65)))}
      </div>
      <Pop p={at(0.4)}>
        <Box accent={GOLD} style={{ fontSize: 44, fontWeight: 900, textAlign: 'center', color: GOLD, padding: '14px 24px' }}>
          {common}
        </Box>
      </Pop>
      <Note text={str(scene.data?.foot)} p={at(cue(cues[2], 0.9))} size={36} color={TXT} />
    </AbsoluteFill>
  );
};

/** 정보 공개 범위 — 공개(주가 = 종목 로고) / 비공개(직업 = 뱃지) */
const Info = ({ scene, narrSec }: Props) => {
  const { at, cue } = useClock(scene, narrSec);
  const logos = (scene.images ?? []).filter((s) => s.startsWith('company/'));
  const badges = (scene.images ?? []).filter((s) => s.startsWith('job/'));
  const panel = (line: string, accent: string, p: number, pics: string[], hidden: boolean) => {
    const [head, body] = line.split(': ');
    return (
      <Pop p={p} style={{ flex: 1 }}>
        <Box accent={accent} style={{ height: 560 }}>
          <div style={{ fontSize: 66, fontWeight: 900, color: accent }}>{head}:</div>
          {body!.split(', ').map((b, i) => (
            <div key={i} style={{ fontSize: 48, fontWeight: 700, marginTop: 14, display: 'flex', gap: 12 }}>
              <span style={{ color: DIM, flexShrink: 0 }}>·</span>
              <span>{b}</span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 14, marginTop: 26 }}>
            {pics.map((s) => (
              <div key={s} style={{ position: 'relative' }}>
                <Pic src={s} size={104} round={s.startsWith('job/')} tile={s.startsWith('company/')} style={{ filter: hidden ? 'grayscale(1) brightness(0.45)' : undefined }} />
                {hidden ? (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 58, fontWeight: 900, color: TXT }}>
                    ?
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </Box>
      </Pop>
    );
  };
  return (
    <Stage gap={36}>
      <div style={{ display: 'flex', gap: 50, width: '100%' }}>
        {panel(scene.screen[0]!, GREEN, at(0.4), logos, false)}
        {panel(scene.screen[1]!, RED, at(cue('하지만', 0.3)), badges, true)}
      </div>
      <Note text={str(scene.data?.note)} p={at(cue('경찰의 조사', 0.7))} size={38} color={TXT} />
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
