// 룰 영상 도식 — 테마 배경 위에 큰 글자·카드·표·화살표 + **앱이 쓰는 기능 그림**(직업 뱃지·회사 로고·몬스터).
// 올림포스 마피아 video/src/Diagrams.tsx의 방식(useClock으로 장면 안 초를 재고 at()으로
// 요소를 순차 등장)을 옮겨 왔고, 그 게임 전용 도식(좌석·캐릭터)은 뺐다.
//
// 화면 글자는 scenes.ts의 screen(정본 「」 글자 그대로)에서 온다. 나누어 그릴 때는
// 정본의 구분자(' / ' · ' → ' · ' · ')로만 나누고, 구분자 자체도 화면에 다시 그린다.
//
// Iteration 4 (2026-10-17 또니) — ① 휴대폰 화면 캡처는 쓰지 않는다(없음). ② 행동은 카드·몬스터·표가
// 실제로 움직이는 도식으로 보여 준다(수산시장 영상 방식). ③ 검정 대신 테마색 — 디펜스는 극장 커튼
// 레드·골드·크림, 마피아는 누아르 세피아·골드. 배경 그림은 RuleVideo.tsx(bg/)가 깐다.
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { createContext, useContext, type CSSProperties, type ReactNode } from 'react';
import type { Scene } from './scenes';

// ── 테마 ──────────────────────────────────────────────

export type Theme = {
  id: 'defense' | 'mafia';
  /** 바탕색(배경 그림 위 오버레이·무대 밖) */
  bg: string;
  bgRgb: string;
  panel: string;
  line: string;
  text: string;
  mut: string;
  dim: string;
  gold: string;
  amber: string;
  red: string;
  blue: string;
  green: string;
  /** 활성 카드(크림 종이) · 비활성 카드(어두운 반투명) */
  cardOn: string;
  cardOff: string;
  ink: string;
};

export const THEMES: Record<'defense' | 'mafia', Theme> = {
  defense: {
    id: 'defense',
    bg: '#1b0b0e',
    bgRgb: '27,11,14',
    panel: 'rgba(30,10,14,0.74)',
    line: 'rgba(242,178,74,0.5)',
    text: '#fff4dc',
    mut: '#dcc9ad',
    dim: '#9a8569',
    gold: '#f2b24a',
    amber: '#ffd27a',
    red: '#ff8a7a',
    blue: '#8fd3ff',
    green: '#9be7a5',
    cardOn: 'rgba(255,244,220,0.96)',
    cardOff: 'rgba(255,244,220,0.10)',
    ink: '#2a1014',
  },
  mafia: {
    id: 'mafia',
    bg: '#120d08',
    bgRgb: '18,13,8',
    panel: 'rgba(22,15,9,0.76)',
    line: 'rgba(214,170,90,0.5)',
    text: '#f3e7cf',
    mut: '#cdb58f',
    dim: '#8a7352',
    gold: '#d6aa5a',
    amber: '#f0c878',
    red: '#ff8a7a',
    blue: '#9cc9ff',
    green: '#9be7a5',
    cardOn: 'rgba(243,231,207,0.96)',
    cardOff: 'rgba(243,231,207,0.10)',
    ink: '#1c130a',
  },
};
const ThemeCtx = createContext<Theme>(THEMES.defense);
const useT = () => useContext(ThemeCtx);

type Props = { scene: Scene; frames: number; narrSec: number; label: string; gameTitle: string };

/** 장면 안 시간 도우미 + 나레이션 문구가 들리는 시점(cue) */
function useClock(scene: Scene, narrSec: number) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = frame / fps;
  /** t초에 등장(스프링 0→1) */
  const at = (t: number) => spring({ frame: frame - t * fps, fps, config: { damping: 200 } });
  /** from~to초 사이 0→1 (ease-out) — 이동·채움에 쓴다 */
  const seg = (from: number, to: number) => {
    const x = interpolate(sec, [from, to], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    return 1 - Math.pow(1 - x, 3);
  };
  /** 나레이션에서 phrase가 시작되는 초(약간 앞당김). 없으면 fallback 비율. */
  const cue = (phrase: string | undefined, fallback = 0) => {
    const n = scene.narration;
    const idx = phrase ? n.indexOf(phrase) : -1;
    const frac = idx >= 0 ? idx / n.length : fallback;
    return Math.max(0.3, narrSec * frac - 0.2);
  };
  const cues = (scene.data?.cues as string[] | undefined) ?? [];
  return { sec, at, seg, cue, cues, fps };
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
      boxShadow: tile || round ? '0 8px 22px rgba(0,0,0,0.45)' : undefined,
      flexShrink: 0,
      ...style,
    }}
  />
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

const Label = ({ text, game }: { text: string; game: string }) => {
  const T = useT();
  return (
    <div style={{ position: 'absolute', left: 110, top: 56, display: 'flex', gap: 24, alignItems: 'baseline' }}>
      <span style={{ fontSize: 50, fontWeight: 900, color: T.gold, textShadow: '0 2px 18px rgba(0,0,0,0.6)' }}>{text}</span>
      <span style={{ fontSize: 30, color: T.mut, fontWeight: 500 }}>{game}</span>
    </div>
  );
};

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

/** 반투명 패널 — 테두리 색(accent)으로 강조. 바탕은 테마색이라 배경 그림 위에서도 읽힌다. */
const Box = ({ children, accent, style }: { children: ReactNode; accent?: string; style?: CSSProperties }) => {
  const T = useT();
  return (
    <div
      style={{
        border: `3px solid ${accent ?? T.line}`,
        borderRadius: 24,
        background: T.panel,
        padding: '22px 34px',
        wordBreak: 'keep-all',
        lineHeight: 1.35,
        boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

const Arrow = ({ dir = 'right', size = 56, color }: { dir?: 'right' | 'down'; size?: number; color?: string }) => {
  const T = useT();
  return <span style={{ fontSize: size, color: color ?? T.mut, fontWeight: 700, lineHeight: 1 }}>{dir === 'right' ? '→' : '↓'}</span>;
};

/** ' → '로 나뉜 글을 칩·화살표로 */
const Chain = ({ text, size = 46, accent, color }: { text: string; size?: number; accent?: string; color?: string }) => {
  const T = useT();
  const parts = text.split(' → ');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap', justifyContent: 'center' }}>
      {parts.map((t, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          {i > 0 ? <Arrow size={size} /> : null}
          <Box accent={accent} style={{ fontSize: size, fontWeight: 700, color: color ?? T.text, padding: '14px 28px', textAlign: 'center' }}>
            {t}
          </Box>
        </div>
      ))}
    </div>
  );
};

/**
 * 숫자 카드 — 활성 = 크림색 종이 카드에 진한 숫자, 비활성 = 어두운 반투명 카드에 흐린 숫자(잠김).
 * (앱 화면을 베끼지 않고, 규칙의 두 상태가 한눈에 갈리게.)
 */
const NumCard = ({ n, active = true, size = 1, bare = false, style }: { n: string; active?: boolean; size?: number; bare?: boolean; style?: CSSProperties }) => {
  const T = useT();
  return (
    <div
      style={{
        width: 160 * size,
        height: 200 * size,
        borderRadius: 18 * size,
        border: `${3 * size}px solid ${active ? T.gold : 'rgba(255,255,255,0.18)'}`,
        background: active ? T.cardOn : T.cardOff,
        boxShadow: active ? `0 10px 26px rgba(0,0,0,0.45)` : 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: `${14 * size}px ${18 * size}px`,
        flexShrink: 0,
        ...style,
      }}
    >
      <span style={{ fontSize: 96 * size, fontWeight: 900, color: active ? T.ink : T.dim, lineHeight: 1 }}>{n}</span>
      {bare ? null : (
        <span style={{ fontSize: 30 * size, color: active ? T.ink : T.dim, fontWeight: 700, opacity: active ? 0.75 : 1 }}>
          {active ? '활성' : '비활성'}
        </span>
      )}
    </div>
  );
};

/** 몬스터 카드 — 결과 중계 보드와 같은 구성(그림 + 이름 + 체력·남은 라운드) */
const MonsterCard = ({
  name,
  pic,
  hp,
  left,
  width = 330,
  dim = false,
  leftColor,
}: {
  name: string;
  pic: ReactNode;
  hp?: string;
  left?: ReactNode;
  width?: number;
  dim?: boolean;
  leftColor?: string;
}) => {
  const T = useT();
  return (
    <div
      style={{
        width,
        borderRadius: 20,
        border: `3px solid ${dim ? 'rgba(255,255,255,0.15)' : T.line}`,
        background: T.panel,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        opacity: dim ? 0.7 : 1,
        position: 'relative',
        boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
      }}
    >
      {pic}
      <div style={{ fontSize: 38, fontWeight: 900, color: T.text }}>{name}</div>
      <div style={{ display: 'flex', gap: 10, fontSize: 30, fontWeight: 700 }}>
        {hp ? <span style={{ background: 'rgba(255,138,122,0.18)', color: T.red, borderRadius: 999, padding: '2px 14px' }}>{hp}</span> : null}
        {left !== undefined ? (
          <span style={{ background: 'rgba(255,255,255,0.10)', color: leftColor ?? T.text, borderRadius: 999, padding: '2px 14px' }}>{left}</span>
        ) : null}
      </div>
    </div>
  );
};

const Note = ({ text, p, color, size = 38 }: { text: string; p: number; color?: string; size?: number }) => {
  const T = useT();
  return (
    <Pop p={p} style={{ fontSize: size, color: color ?? T.mut, fontWeight: 500, textAlign: 'center', wordBreak: 'keep-all', textShadow: '0 2px 14px rgba(0,0,0,0.7)' }}>
      {text}
    </Pop>
  );
};

/** 참가자 — 머리글자 동그라미 */
const Avatar = ({ name, size = 110, color, p = 1, sub }: { name: string; size?: number; color?: string; p?: number; sub?: ReactNode }) => {
  const T = useT();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, opacity: p, transform: `scale(${0.85 + 0.15 * p})`, flexShrink: 0 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 999,
          border: `4px solid ${color ?? T.blue}`,
          background: T.panel,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.48,
          fontWeight: 900,
          color: color ?? T.blue,
          boxShadow: '0 8px 22px rgba(0,0,0,0.45)',
        }}
      >
        {name}
      </div>
      {sub !== undefined ? <div style={{ fontSize: 28, color: T.mut, fontWeight: 700, whiteSpace: 'nowrap' }}>{sub}</div> : null}
    </div>
  );
};

/** 동전(원) */
const Coin = ({ text, size = 64, style }: { text: ReactNode; size?: number; style?: CSSProperties }) => {
  const T = useT();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: `radial-gradient(circle at 35% 30%, ${T.amber}, ${T.gold} 60%, #8a6420)`,
        border: '3px solid rgba(255,255,255,0.35)',
        color: T.ink,
        fontWeight: 900,
        fontSize: size * 0.4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 6px 16px rgba(0,0,0,0.5)',
        flexShrink: 0,
        ...style,
      }}
    >
      {text}
    </div>
  );
};

/** 투표지 */
const Ballot = ({ p = 1, style }: { p?: number; style?: CSSProperties }) => {
  const T = useT();
  return (
    <div
      style={{
        width: 54,
        height: 70,
        borderRadius: 8,
        background: T.cardOn,
        border: `2px solid ${T.gold}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: T.red,
        fontWeight: 900,
        fontSize: 34,
        opacity: p,
        boxShadow: '0 6px 14px rgba(0,0,0,0.45)',
        ...style,
      }}
    >
      ✓
    </div>
  );
};

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const strs = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);
const hasImg = (scene: Scene, src: string) => (scene.images ?? []).includes(src);

// ── 장면 ──────────────────────────────────────────────

const Title = ({ scene }: Props) => {
  const T = useT();
  const { at } = useClock(scene, 0);
  const p = at(0.2);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 160, height: 5, background: T.gold, marginBottom: 46, opacity: p }} />
      <div
        style={{
          fontSize: 120,
          fontWeight: 900,
          color: T.text,
          opacity: p,
          transform: `scale(${0.94 + 0.06 * p})`,
          textShadow: '0 6px 30px rgba(0,0,0,0.7)',
          letterSpacing: 2,
        }}
      >
        {scene.screen[0]}
      </div>
      <div style={{ width: 160, height: 5, background: T.gold, marginTop: 50, opacity: p }} />
    </AbsoluteFill>
  );
};

/** 목표 — 큰 문장(들) + (디펜스) 함께 치는 그림 */
const Goal = (props: Props) => {
  const T = useT();
  const { scene, narrSec } = props;
  const { at, cue } = useClock(scene, narrSec);
  const defense = T.id === 'defense';
  return (
    <Stage>
      {scene.screen.map((t, i) => (
        <Pop key={i} p={at(0.3 + i * 1.6)}>
          <Box accent={i === 0 ? T.gold : undefined} style={{ fontSize: i === 0 ? 72 : 58, fontWeight: 900, textAlign: 'center' }}>
            {t}
          </Box>
        </Pop>
      ))}
      {defense ? (
        <Pop p={at(cue('같이 쳐야', 0.6))} style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
          <div style={{ display: 'flex', gap: 18 }}>
            {['A', 'B', 'C'].map((x) => (
              <Avatar key={x} name={x} />
            ))}
          </div>
          <Arrow />
          <Box accent={T.red} style={{ fontSize: 56, fontWeight: 900, color: T.red }}>
            몬스터 처치
          </Box>
          <Arrow />
          <Box accent={T.gold} style={{ fontSize: 52, fontWeight: 900, color: T.gold }}>
            점수 ÷ 3
          </Box>
        </Pop>
      ) : null}
      {str(scene.data?.note) ? <Note text={str(scene.data?.note)} p={at(cue('모두 현금', 0.8))} /> : null}
    </Stage>
  );
};

/** 카드 4장 + 활성/비활성 — 전투에 쓴 카드가 잠기고, 휴식으로 다시 켜지는 것을 보여 준다 */
const Cards = ({ scene, narrSec }: Props) => {
  const T = useT();
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
            <NumCard n={n} active={!(off && i === 2)} size={1.2} style={{ transform: off && i === 2 ? 'rotate(-6deg)' : undefined }} />
          </Pop>
        ))}
      </div>
      <Pop p={at(cue('두 상태', 0.35))} style={{ display: 'flex', gap: 60, alignItems: 'center', fontSize: 56, fontWeight: 700 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <NumCard n="" active size={0.4} bare />
          <span style={{ color: T.green }}>{onLabel}</span>
        </span>
        <span style={{ color: T.mut }}>/</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <NumCard n="" active={false} size={0.4} bare />
          <span style={{ color: T.mut }}>{offLabel}</span>
        </span>
      </Pop>
      <Note text={off ? '전투에 쓴 카드 → 비활성' : sec >= backAt ? '휴식 → 다시 활성' : ' '} p={sec >= offAt ? 1 : 0} size={44} color={T.text} />
    </Stage>
  );
};

/**
 * 세 가지 행동 — 패널마다 작은 실연:
 *  전투: 카드가 몬스터로 날아가 꽂히고 잠긴다 · 휴식: 잠긴 카드 세 장이 차례로 켜진다 ·
 *  훈련: 카드 한 장을 비용으로 잠그고 다른 카드 숫자가 4 → 5.
 */
const Actions = ({ scene, narrSec }: Props) => {
  const T = useT();
  const { sec, at, seg, cue, cues } = useClock(scene, narrSec);
  const names = scene.screen[0]!.split(' / ');
  const sums = strs(scene.data?.summaries);
  const [exA, exB] = scene.screen[1]!.split(' + ');
  const colors = [T.red, T.blue, T.gold];
  const t = names.map((_, i) => cue(cues[i], 0.1 + i * 0.25));
  // 전투 실연
  const fly = seg(t[0]! + 0.9, t[0]! + 1.9);
  const hit = sec >= t[0]! + 1.9;
  // 휴식 실연
  const wake = (k: number) => sec >= t[1]! + 0.9 + k * 0.45;
  // 훈련 실연
  const cost = sec >= t[2]! + 1.0;
  const bump = seg(t[2]! + 1.6, t[2]! + 2.1);
  const demo = (i: number) => {
    if (i === 0) {
      return (
        <div style={{ position: 'relative', height: 250, width: '100%' }}>
          <div style={{ position: 'absolute', right: 10, top: 10 }}>
            <Pic src={hit ? monsterImg('스컬 스파이더', '_dead') : monsterImg('스컬 스파이더')} size={170} tile style={{ transform: hit ? 'rotate(8deg)' : undefined }} />
            <div style={{ position: 'absolute', left: -10, top: -16, opacity: hit ? 1 : 0, fontSize: 48, fontWeight: 900, color: T.red, textShadow: '0 2px 12px #000' }}>−3</div>
          </div>
          <div style={{ position: 'absolute', left: 10 + fly * 170, top: 30 - Math.sin(fly * Math.PI) * 60, transform: `rotate(${fly * 25}deg)` }}>
            <NumCard n="3" active={!hit} size={0.8} />
          </div>
          <div style={{ position: 'absolute', left: 0, bottom: 0, fontSize: 30, color: T.mut, opacity: at(t[0]! + 2.2) }}>낸 카드는 비활성</div>
        </div>
      );
    }
    if (i === 1) {
      return (
        <div style={{ position: 'relative', height: 250, width: '100%' }}>
          <div style={{ display: 'flex', gap: 14, position: 'absolute', left: 0, top: 10 }}>
            {['1', '2', '4'].map((n, k) => (
              <NumCard key={n} n={n} active={wake(k)} size={0.8} style={{ transform: wake(k) ? 'translateY(-10px)' : undefined }} />
            ))}
          </div>
          <div style={{ position: 'absolute', left: 0, bottom: 0, fontSize: 30, color: T.mut, opacity: at(t[1]! + 2.4) }}>최대 3장까지 다시 활성</div>
        </div>
      );
    }
    return (
      <div style={{ position: 'relative', height: 250, width: '100%' }}>
        <div style={{ display: 'flex', gap: 30, position: 'absolute', left: 0, top: 10, alignItems: 'center' }}>
          <NumCard n="4" active={!cost} size={0.8} style={{ transform: cost ? 'rotate(-6deg)' : undefined }} />
          <span style={{ fontSize: 44, color: T.mut, fontWeight: 900 }}>+</span>
          <div style={{ position: 'relative' }}>
            <NumCard n={bump > 0.5 ? '5' : '4'} active size={0.8} style={{ transform: `scale(${1 + Math.sin(bump * Math.PI) * 0.12})` }} />
            <div style={{ position: 'absolute', right: -26, top: -22, opacity: bump, fontSize: 40, fontWeight: 900, color: T.green, textShadow: '0 2px 12px #000' }}>+1</div>
          </div>
        </div>
        <div style={{ position: 'absolute', left: 0, bottom: 0, fontSize: 30, color: T.mut, opacity: at(t[2]! + 2.4) }}>{str(scene.data?.note)}</div>
      </div>
    );
  };
  return (
    <Stage gap={30}>
      <div style={{ display: 'flex', gap: 26, width: '100%' }}>
        {names.map((n, i) => (
          <Pop key={n} p={at(t[i]!)} style={{ flex: 1 }}>
            <Box accent={colors[i]} style={{ height: 600, display: 'flex', flexDirection: 'column', gap: 14, padding: '22px 26px' }}>
              <div style={{ fontSize: 62, fontWeight: 900, color: colors[i] }}>{n}</div>
              <div style={{ fontSize: 34, fontWeight: 500, minHeight: 100 }}>{sums[i]}</div>
              {demo(i)}
              {i === 2 ? (
                <div style={{ fontSize: 34, fontWeight: 900, color: T.gold, display: 'flex', gap: 14, alignItems: 'center' }}>
                  <span>{exA}</span>
                  <span style={{ color: T.mut }}>+</span>
                  <span>{exB}</span>
                </div>
              ) : null}
            </Box>
          </Pop>
        ))}
      </div>
      <Note text={str(scene.data?.secret)} p={at(cue(cues[3], 0.9))} color={T.text} size={40} />
    </Stage>
  );
};

/** 몬스터 표 6행 — 행 앞에 몬스터 그림 */
const Monsters = ({ scene, narrSec }: Props) => {
  const T = useT();
  const { at, cue } = useClock(scene, narrSec);
  const head = scene.screen[0]!.split(' / ');
  const rows = (scene.data?.rows as string[][]) ?? [];
  const THUMB = 84;
  const cell = (i: number, headRow = false): CSSProperties => ({
    flex: i === 0 ? 2.2 : 1,
    textAlign: i === 0 ? 'left' : 'center',
    fontSize: headRow ? 40 : 48,
    fontWeight: headRow ? 700 : i === 0 ? 700 : 900,
    color: headRow ? T.mut : i === 1 ? T.red : i === 3 ? T.gold : T.text,
  });
  return (
    <Stage gap={22} top={150}>
      <Box style={{ width: 1500, padding: '10px 10px' }}>
        <div style={{ display: 'flex', padding: '8px 24px', borderBottom: `3px solid ${T.line}`, alignItems: 'center' }}>
          <div style={{ width: THUMB + 24 }} />
          {head.map((h, i) => (
            <div key={h} style={cell(i, true)}>
              {h}
            </div>
          ))}
        </div>
        {rows.map((r, ri) => (
          <Pop key={r[0]} p={at(cue('여섯 종류', 0.05) + ri * 0.45)}>
            <div style={{ display: 'flex', padding: '6px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', alignItems: 'center' }}>
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
      </Box>
      <Note text={str(scene.data?.note)} p={at(cue('자세한 수치', 0.8))} />
    </Stage>
  );
};

/** 대기열 칸 — 몬스터 카드(보드와 같은 구성) */
const Queue = ({ scene, narrSec }: Props) => {
  const T = useT();
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
              style={{ width: 340, height: 400, borderRadius: 24, border: `4px dashed ${T.line}`, background: 'rgba(242,178,74,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <div style={{ opacity: p, transform: `scale(${0.85 + 0.15 * p})` }}>
                <MonsterCard name={m} pic={<Pic src={monsterImg(m)} size={210} tile />} hp={`체력 ${info.hp}`} left={`남은 ${info.rounds}`} width={310} />
              </div>
            </div>
          );
        })}
      </div>
      <Pop p={at(cue('대기열 칸 수는', 0.3))} style={{ display: 'flex', gap: 30, alignItems: 'center' }}>
        <Box accent={T.gold} style={{ fontSize: 50, fontWeight: 900, padding: '14px 30px' }}>
          {sizes[0]}
        </Box>
        <span style={{ fontSize: 50, color: T.mut }}>/</span>
        <Box accent={T.gold} style={{ fontSize: 50, fontWeight: 900, padding: '14px 30px' }}>
          {sizes[1]}
        </Box>
        <Box style={{ fontSize: 50, fontWeight: 900, padding: '14px 30px', marginLeft: 20, opacity: at(cue('총 마릿수', 0.6)) }}>
          {scene.screen[1]}
        </Box>
      </Pop>
      {scene.screen[2] ? (
        <Pop p={at(cue('같은 종류의', 0.15))}>
          <Box accent={T.gold} style={{ fontSize: 44, fontWeight: 900, padding: '10px 28px', color: T.gold }}>
            {scene.screen[2]}
          </Box>
        </Pop>
      ) : null}
      <Note text={str(scene.data?.note)} p={at(cue('인원에 따라', 0.8))} />
    </Stage>
  );
};

/** 전투 처리(처치) — 카드 세 장이 몬스터로 날아가 합산되고, 처치 순간 쓰러진 그림으로 */
const Combat = ({ scene, narrSec }: Props) => {
  const T = useT();
  const { sec, at, seg, cue } = useClock(scene, narrSec);
  const cards = strs(scene.data?.cards);
  const name = str(scene.data?.monster);
  const sumAt = cue('모두 더합니다', 0.35);
  const killAt = cue('처치입니다', 0.5);
  const shareAt = cue('점수는', 0.65);
  return (
    <Stage gap={34} top={150}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 46 }}>
        <div style={{ display: 'flex', gap: 20 }}>
          {cards.map((c, i) => {
            const f = seg(sumAt + i * 0.25, sumAt + 0.7 + i * 0.25);
            return (
              <Pop key={i} p={at(0.6 + i * 0.5)}>
                <NumCard n={c} active={sec < sumAt + 0.7 + i * 0.25} style={{ transform: `translateX(${f * 60}px) rotate(${f * 10}deg)` }} />
              </Pop>
            );
          })}
        </div>
        <Arrow size={80} />
        <MonsterCard
          name={name}
          pic={<Swap a={monsterImg(name)} b={monsterImg(name, '_dead')} t={killAt} size={300} sec={sec} />}
          hp={scene.screen[0]!}
          width={340}
        />
        <Pop p={at(killAt)}>
          <div style={{ fontSize: 96, fontWeight: 900, color: T.green, textShadow: '0 4px 20px rgba(0,0,0,0.7)' }}>{scene.screen[1]}</div>
        </Pop>
      </div>
      <div style={{ display: 'flex', gap: 30, alignItems: 'center' }}>
        <Pop p={at(sumAt)}>
          <Box accent={T.gold} style={{ fontSize: 56, fontWeight: 900, color: T.gold }}>
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
  const T = useT();
  const { at, cue } = useClock(scene, narrSec);
  const thumb = (scene.images ?? [])[0];
  return (
    <Stage gap={50}>
      {thumb ? <Pop p={at(0.3)}>{<Pic src={thumb} size={150} tile />}</Pop> : null}
      <Pop p={at(cue('예를 들어', 0.05))}>
        <Chain text={scene.screen[0]!} size={58} accent={T.gold} />
      </Pop>
      <Pop p={at(cue('2점짜리', 0.45))}>
        <Chain text={scene.screen[1]!} size={58} accent={T.red} />
      </Pop>
      <Note text={str(scene.data?.foot)} p={at(cue('누구와 같이', 0.75))} color={T.text} size={46} />
    </Stage>
  );
};

/** 처치 실패 — 다친 그림, 체력 9 → 5 */
const Fail = ({ scene, narrSec }: Props) => {
  const T = useT();
  const { sec, at, seg, cue } = useClock(scene, narrSec);
  const cards = strs(scene.data?.cards);
  const name = str(scene.data?.monster);
  const hitAt = cue('못 미치면', 0.15);
  const hurtAt = cue('깎인 체력', 0.4);
  const f = seg(hitAt - 0.5, hitAt + 0.1);
  return (
    <Stage gap={40} top={150}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 46 }}>
        <Pop p={at(0.5)}>
          <NumCard n={cards[0] ?? ''} active={sec < hitAt + 0.1} style={{ transform: `translateX(${f * 60}px) rotate(${f * 10}deg)` }} />
        </Pop>
        <Arrow size={80} />
        <MonsterCard name={name} pic={<Swap a={monsterImg(name)} b={monsterImg(name, '_damaged')} t={hitAt} size={300} sec={sec} />} hp={scene.screen[0]!} width={340} />
        <Pop p={at(hurtAt)} style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
          <Arrow size={80} />
          <Box accent={T.red} style={{ fontSize: 56, fontWeight: 900, color: T.red }}>
            {scene.screen[1]}
          </Box>
        </Pop>
      </div>
      <Pop p={at(cue('못 미치면', 0.1))}>
        <Box accent={T.gold} style={{ fontSize: 56, fontWeight: 900, color: T.gold }}>
          {str(scene.data?.sum)}
        </Box>
      </Pop>
      <Note text={str(scene.data?.note)} p={at(cue('낸 카드는', 0.75))} size={44} />
    </Stage>
  );
};

/** 라운드 종료와 도망 — 대기열 카드, 0이 되면 도망 그림 */
const Escape = ({ scene, narrSec }: Props) => {
  const T = useT();
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
            <div style={{ width: 210, height: 210, borderRadius: 30, border: `4px dashed ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 90, color: T.dim, fontWeight: 900 }}>
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
                leftColor={n <= 0 && !refilled ? T.red : T.text}
                width={350}
                dim={gone && !refilled}
              />
              {gone && !refilled ? (
                <div style={{ position: 'absolute', top: 70, left: 0, right: 0, textAlign: 'center', fontSize: 92, fontWeight: 900, color: T.red, transform: 'rotate(-12deg)', textShadow: '0 4px 20px #000' }}>
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
        <Box accent={T.red} style={{ fontSize: 42, fontWeight: 900 }}>
          {penalty}
        </Box>
      </Pop>
      <Note text={str(scene.data?.refill)} p={at(refillAt)} size={38} />
    </Stage>
  );
};

/** 단계 아이콘(마피아 라운드 흐름) — 캡처 대신 그린 아이콘 */
const StepIcon = ({ step, p }: { step: string; p: number }) => {
  const T = useT();
  const box: CSSProperties = { width: 150, height: 150, borderRadius: 24, background: T.panel, border: `3px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', opacity: p, transform: `scale(${0.8 + 0.2 * p})`, boxShadow: '0 10px 26px rgba(0,0,0,0.4)' };
  if (step === '직업 경매') {
    return (
      <div style={box}>
        <Pic src={JOB_IMG['경찰']!} size={64} round style={{ position: 'absolute', left: 14, top: 18 }} />
        <Pic src={JOB_IMG['사장']!} size={64} round style={{ position: 'absolute', right: 14, top: 18 }} />
        <Coin text="7" size={54} style={{ position: 'absolute', bottom: 14 }} />
      </div>
    );
  }
  if (step === '주식 거래') {
    return (
      <div style={box}>
        <Pic src={STOCK_IMG['번쩍전기']!} size={70} tile style={{ position: 'absolute', left: 14, top: 14 }} />
        <span style={{ position: 'absolute', right: 18, top: 16, fontSize: 40, fontWeight: 900, color: T.green }}>▲</span>
        <span style={{ position: 'absolute', right: 18, bottom: 10, fontSize: 40, fontWeight: 900, color: T.red }}>▼</span>
        <Pic src={STOCK_IMG['부엉교육']!} size={70} tile style={{ position: 'absolute', left: 14, bottom: 14 }} />
      </div>
    );
  }
  if (step === '주가 변동') {
    const bars = [40, 70, 55, 95];
    return (
      <div style={{ ...box, alignItems: 'flex-end', gap: 10, padding: '0 20px 22px' }}>
        {bars.map((h, i) => (
          <div key={i} style={{ width: 20, height: h * p, borderRadius: 6, background: i === 3 ? T.green : i === 1 ? T.red : T.gold }} />
        ))}
      </div>
    );
  }
  if (step === '투표') {
    return (
      <div style={box}>
        <div style={{ position: 'absolute', bottom: 22, width: 96, height: 60, borderRadius: 10, background: T.gold, boxShadow: 'inset 0 -6px 0 rgba(0,0,0,0.25)' }} />
        <div style={{ position: 'absolute', bottom: 78, width: 70, height: 8, borderRadius: 4, background: T.ink }} />
        <Ballot style={{ position: 'absolute', top: 18, transform: `translateY(${(1 - p) * -20}px) rotate(-8deg)`, width: 44, height: 56, fontSize: 28 }} />
      </div>
    );
  }
  if (step === '라운드 종료') {
    return (
      <div style={box}>
        <span style={{ fontSize: 84, fontWeight: 900, color: T.green }}>✓</span>
      </div>
    );
  }
  return (
    <div style={box}>
      <span style={{ fontSize: 64, fontWeight: 900, color: T.mut }}>⏱</span>
    </div>
  );
};

/** 라운드 흐름 띠 (× 반복) — 마피아는 단계 아래 그린 아이콘 */
const Flow = ({ scene, narrSec }: Props) => {
  const T = useT();
  const { at, cue } = useClock(scene, narrSec);
  const steps = scene.screen[0]!.split(' → ');
  const mafia = T.id === 'mafia';
  const fs = mafia ? 40 : 50;
  return (
    <Stage gap={mafia ? 40 : 56} top={150}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, justifyContent: 'center', flexWrap: mafia ? 'nowrap' : 'wrap' }}>
        {steps.map((s, i) => (
          <Pop key={i} p={at(0.4 + i * 0.45)} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            {i > 0 ? (
              <div style={{ height: 86, display: 'flex', alignItems: 'center' }}>
                <Arrow size={44} />
              </div>
            ) : null}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
              <Box accent={i === 0 ? undefined : T.gold} style={{ fontSize: fs, fontWeight: 900, padding: '16px 22px', whiteSpace: 'nowrap' }}>
                {s}
              </Box>
              {mafia ? <StepIcon step={s} p={at(0.9 + i * 0.45)} /> : null}
            </div>
          </Pop>
        ))}
        <Pop p={at(0.4 + steps.length * 0.45)}>
          <span style={{ fontSize: 76, fontWeight: 900, color: T.gold, marginLeft: 14, lineHeight: '86px', textShadow: '0 4px 18px rgba(0,0,0,0.6)' }}>
            {str(scene.data?.times)}
          </span>
        </Pop>
      </div>
      {scene.screen[1] ? (
        <Pop p={at(cue('4라운드와', 0.6))}>
          <Box accent={T.blue} style={{ fontSize: 54, fontWeight: 900, color: T.blue }}>
            {scene.screen[1]}
          </Box>
        </Pop>
      ) : null}
      {str(scene.data?.note) ? <Note text={str(scene.data?.note)} p={at(cue('', 0.45))} size={38} /> : null}
    </Stage>
  );
};

/** 종료와 순위 — 줄마다 상자. 마피아는 총자산 시상대(현금 + 주식 × 주가)를 옆에 그린다 */
const Ending = ({ scene, narrSec }: Props) => {
  const T = useT();
  const { at, seg } = useClock(scene, narrSec);
  const step = narrSec / (scene.screen.length + 0.5);
  const mafia = T.id === 'mafia';
  const lines = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 44, alignItems: mafia ? 'flex-start' : 'center' }}>
      {scene.screen.map((line, i) => {
        const colon = line.indexOf(': ');
        const head = colon >= 0 ? line.slice(0, colon + 1) : null;
        const body = colon >= 0 ? line.slice(colon + 2) : line;
        return (
          <Pop key={i} p={at(0.4 + i * step)} style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
            {head ? <span style={{ fontSize: 60, fontWeight: 900, color: T.gold }}>{head}</span> : null}
            <Chain text={body} size={mafia ? 46 : 54} accent={i === 0 ? T.gold : undefined} />
          </Pop>
        );
      })}
    </div>
  );
  if (!mafia) return <Stage gap={50}>{lines}</Stage>;
  // 시상대 — 셋의 총자산 막대: 현금(골드) + 주식 평가액(파랑)
  const people = [
    { name: 'B', cash: 26, stock: 44, rank: 2 },
    { name: 'A', cash: 38, stock: 56, rank: 1 },
    { name: 'C', cash: 20, stock: 30, rank: 3 },
  ];
  const grow = seg(step * 0.6, step * 1.6);
  const reveal = at(step * 2.2);
  return (
    <Stage gap={30}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 70 }}>
        {lines}
        <Pop p={at(step * 0.5)} style={{ flexShrink: 0 }}>
          <Box style={{ width: 640, padding: '22px 28px' }}>
            <div style={{ fontSize: 34, fontWeight: 900, color: T.gold, marginBottom: 14 }}>총자산 = 현금 + 주식 × 주가</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 34, height: 330, justifyContent: 'center', marginTop: 50 }}>
              {people.map((pp) => {
                const total = pp.cash + pp.stock;
                return (
                  <div key={pp.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 30, fontWeight: 900, color: pp.rank === 1 ? T.gold : T.text, opacity: grow }}>{total}원</div>
                    <div style={{ width: 110, display: 'flex', flexDirection: 'column-reverse', borderRadius: 12, overflow: 'hidden' }}>
                      <div style={{ height: pp.cash * 1.5 * grow, background: T.gold }} />
                      <div style={{ height: pp.stock * 1.5 * grow, background: T.blue }} />
                    </div>
                    <Avatar name={pp.name} size={76} color={pp.rank === 1 ? T.gold : undefined} sub={pp.rank === 1 ? '1위' : `${pp.rank}위`} />
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 26, marginTop: 10, fontSize: 26, color: T.mut, justifyContent: 'center' }}>
              <span>
                <span style={{ display: 'inline-block', width: 18, height: 18, background: T.gold, borderRadius: 4, marginRight: 8 }} />
                현금
              </span>
              <span>
                <span style={{ display: 'inline-block', width: 18, height: 18, background: T.blue, borderRadius: 4, marginRight: 8 }} />
                주식 × 주가
              </span>
            </div>
            <div style={{ marginTop: 14, display: 'flex', gap: 12, justifyContent: 'center', opacity: reveal }}>
              {['상승 주가조작범', '강도'].map((j) => (
                <Pic key={j} src={JOB_IMG[j]!} size={64} round />
              ))}
              <span style={{ fontSize: 28, color: T.red, fontWeight: 900, alignSelf: 'center' }}>종료 후 마피아 공개</span>
            </div>
          </Box>
        </Pop>
      </div>
    </Stage>
  );
};

/** 정리 — 네 줄 요약 */
const Summary = ({ scene, narrSec }: Props) => {
  const T = useT();
  const { at } = useClock(scene, narrSec);
  const lines = strs(scene.data?.lines);
  const step = (narrSec * 0.8) / lines.length;
  return (
    <Stage gap={30}>
      {lines.map((l, i) => (
        <Pop key={i} p={at(0.8 + i * step)} style={{ width: 1500 }}>
          <Box style={{ fontSize: 50, fontWeight: 700, display: 'flex', gap: 30, alignItems: 'center' }}>
            <span style={{ color: T.gold, fontWeight: 900, fontSize: 58 }}>{i + 1}</span>
            <span>{l}</span>
          </Box>
        </Pop>
      ))}
      <Note text={str(scene.data?.foot)} p={at(narrSec * 0.88)} size={42} />
    </Stage>
  );
};

/**
 * 직업 경매 — 뱃지 9개 + 베팅 실연: 셋이 같은 직업에 돈을 건다. 가장 높은 금액이 둘이면 둘 다 탈락,
 * 혼자 제출한 사람이 낙찰. 못 받으면 월급쟁이.
 */
const Auction = ({ scene, narrSec }: Props) => {
  const T = useT();
  const { sec, at, seg, cue, cues } = useClock(scene, narrSec);
  const jobs = strs(scene.data?.jobs);
  const pick = str(scene.data?.pick);
  const BADGE = 150;
  const t0 = cue(cues[0], 0.2); // 혼자 제출한 사람이 낙찰
  const t1 = cue(cues[1], 0.4); // 둘 이상 같으면
  const t2 = cue(cues[2], 0.6); // 못 받으면 월급쟁이
  const bids = [
    { name: 'A', amt: 7, tie: true },
    { name: 'B', amt: 7, tie: true },
    { name: 'C', amt: 4, tie: false },
  ];
  const tie = sec >= t1 + 0.6;
  const win = sec >= t1 + 1.4;
  const salary = sec >= t2 + 0.4;
  return (
    <Stage gap={22} top={150}>
      <div style={{ display: 'flex', gap: 40, width: '100%', alignItems: 'center' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(3, ${BADGE}px)`, gap: 16, flexShrink: 0 }}>
          {jobs.map((j, i) => (
            <Pop key={j} p={at(0.3 + i * 0.12)} style={{ position: 'relative' }}>
              <Pic src={JOB_IMG[j]!} size={BADGE} round style={{ boxShadow: j === pick ? `0 0 0 7px ${T.gold}` : undefined }} />
            </Pop>
          ))}
        </div>
        {/* 베팅 실연 */}
        <Pop p={at(t0 - 0.4)} style={{ flexShrink: 0 }}>
          <Box style={{ width: 560, height: 520, padding: '20px 24px', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
              <Pic src={JOB_IMG[pick]!} size={70} round />
              <span style={{ fontSize: 36, fontWeight: 900, color: T.gold }}>{pick} 경매</span>
            </div>
            {bids.map((b, i) => {
              const f = seg(t0 + i * 0.3, t0 + 0.7 + i * 0.3);
              const out = b.tie && tie;
              const won = !b.tie && win;
              return (
                <div key={b.name} style={{ display: 'flex', alignItems: 'center', gap: 20, height: 100, opacity: out ? 0.45 : 1 }}>
                  <Avatar name={b.name} size={76} color={won ? T.gold : out ? T.dim : undefined} />
                  <div style={{ position: 'relative', width: 230, height: 70, flexShrink: 0 }}>
                    <Coin text={`${b.amt}원`} size={70} style={{ position: 'absolute', left: f * 140, top: 0 }} />
                    {out ? <div style={{ position: 'absolute', left: 150, top: 10, fontSize: 48, fontWeight: 900, color: T.red }}>✕</div> : null}
                  </div>
                  <div style={{ fontSize: 30, fontWeight: 900, color: won ? T.gold : out ? T.red : T.mut, whiteSpace: 'nowrap' }}>
                    {won ? '낙찰 · 지불' : out ? '동률 탈락' : ''}
                  </div>
                </div>
              );
            })}
            <div style={{ position: 'absolute', left: 24, right: 24, bottom: 18, display: 'flex', alignItems: 'center', gap: 14, opacity: salary ? 1 : 0 }}>
              <Pic src={JOB_IMG['월급쟁이']!} size={56} round />
              <span style={{ fontSize: 28, color: T.text, fontWeight: 700 }}>A·B는 돈을 안 내고 월급쟁이</span>
            </div>
          </Box>
        </Pop>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {scene.screen.map((t, i) => (
            <Pop key={i} p={at(cue(cues[i], 0.2 + i * 0.2))}>
              <Box accent={i === 0 ? T.gold : i === 3 ? T.blue : undefined} style={{ fontSize: 34, fontWeight: 700, padding: '14px 22px' }}>
                {t}
              </Box>
            </Pop>
          ))}
        </div>
      </div>
      <Note text={str(scene.data?.limits)} p={at(cue('라운드에 한 번', 0.2))} size={36} color={T.text} />
    </Stage>
  );
};

/** 직업 카드 — 머리에 실제 뱃지, 「이름 · 수치 · 수치」 */
const Jobs = ({ scene, narrSec }: Props) => {
  const T = useT();
  const { at, cue, cues } = useClock(scene, narrSec);
  const mafia = scene.data?.accent === 'mafia';
  const accent = mafia ? T.red : T.blue;
  const [header, ...cards] = scene.screen;
  const many = cards.length > 3;
  return (
    <AbsoluteFill style={{ padding: '140px 90px 44px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Pop p={at(0.3)}>
        <div style={{ fontSize: 52, fontWeight: 900, color: accent, textAlign: 'center', textShadow: '0 2px 16px rgba(0,0,0,0.7)' }}>{header}</div>
      </Pop>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: many ? 18 : 28, flex: 1, alignContent: 'start' }}>
        {cards.map((c, i) => {
          const [name, ...rest] = c.split(' · ');
          const badge = JOB_IMG[name!];
          return (
            <Pop key={i} p={at(cue(cues[i], 0.2 + i * 0.12))}>
              <Box accent={name === '월급쟁이' ? T.mut : accent} style={{ padding: many ? '14px 22px' : '24px 28px', height: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
                  {badge ? <Pic src={badge} size={many ? 96 : 116} round /> : null}
                  <div style={{ fontSize: many ? 44 : 46, fontWeight: 900, color: name === '월급쟁이' ? T.mut : accent }}>{name}</div>
                </div>
                {rest.map((r, k) => (
                  <div key={k} style={{ fontSize: many ? 32 : 42, fontWeight: 500, marginTop: 4, display: 'flex', gap: 10 }}>
                    <span style={{ color: T.dim, flexShrink: 0 }}>·</span>
                    <span>{r}</span>
                  </div>
                ))}
              </Box>
            </Pop>
          );
        })}
      </div>
      <Note text={str(scene.data?.note)} p={at(cue(mafia ? '경매 결과에 따라' : '능력은', 0.85))} size={many ? 32 : 40} color={T.text} />
    </AbsoluteFill>
  );
};

/** 주식 4종목 — 로고 + 이름 + 5원, 사고팔기 실연(동전 ↔ 주식) */
const Stocks = ({ scene, narrSec }: Props) => {
  const T = useT();
  const { at, seg, cue } = useClock(scene, narrSec);
  const names = scene.screen[0]!.split(' · ');
  const tradeAt = cue('거래 단계에서는', 0.35);
  const buy = seg(tradeAt + 0.6, tradeAt + 1.4);
  return (
    <Stage gap={34}>
      <div style={{ display: 'flex', gap: 30 }}>
        {names.map((n, i) => (
          <Pop key={n} p={at(0.4 + i * 0.35)}>
            <Box accent={T.gold} style={{ width: 360, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <Pic src={STOCK_IMG[n]!} size={200} tile />
              <div style={{ fontSize: 48, fontWeight: 900 }}>{n}</div>
              <div style={{ fontSize: 70, fontWeight: 900, color: T.gold }}>{scene.screen[1]}</div>
            </Box>
          </Pop>
        ))}
      </div>
      <Pop p={at(tradeAt)} style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
        <Box accent={T.green} style={{ fontSize: 46, fontWeight: 900 }}>
          {scene.screen[2]}
        </Box>
        <div style={{ position: 'relative', width: 260, height: 80 }}>
          <Coin text="5원" size={70} style={{ position: 'absolute', left: buy * 150, top: 4, opacity: 1 - buy }} />
          <Pic src={STOCK_IMG[names[1]!]!} size={70} tile style={{ position: 'absolute', right: 0, top: 4, opacity: 0.25 + buy * 0.75, transform: `scale(${0.8 + buy * 0.2})` }} />
          <span style={{ position: 'absolute', right: 80, top: 20, fontSize: 30, fontWeight: 900, color: T.green, opacity: buy }}>매수</span>
        </div>
      </Pop>
      <Pop p={at(cue('단, 한 라운드에', 0.75))}>
        <Box accent={T.red} style={{ fontSize: 46, fontWeight: 900 }}>
          {scene.screen[3]}
        </Box>
      </Pop>
    </Stage>
  );
};

/** 처리 순서 ①~④ (세로) + 자연 변동 예시(로고 옆 +2/+1/−1) */
const NATURAL_EXAMPLE: { stock: string; delta: string; why: string; tone: 'up' | 'down' | 'flat' }[] = [
  { stock: '번쩍전기', delta: '▲ +2', why: '매수량 1위', tone: 'up' },
  { stock: '이상교통', delta: '▲ +1', why: '매수량 2위', tone: 'up' },
  { stock: '부엉교육', delta: '▼ −1', why: '매도량 1위', tone: 'down' },
  { stock: '국채', delta: '0', why: '변동 없음', tone: 'flat' },
];
const Steps = ({ scene, narrSec }: Props) => {
  const T = useT();
  const { at, cue, cues } = useClock(scene, narrSec);
  const tone = { up: T.green, down: T.red, flat: T.mut };
  return (
    <AbsoluteFill style={{ padding: '150px 90px 50px', display: 'flex', flexDirection: 'row', gap: 40, alignItems: 'center' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        {scene.screen.map((t, i) => (
          <Pop key={i} p={at(cue(cues[i], 0.1 + i * 0.25))} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: '100%' }}>
            {i > 0 ? <Arrow dir="down" size={44} /> : null}
            <Box accent={i === 0 ? T.gold : i === 1 ? T.red : i === 3 ? T.red : T.blue} style={{ fontSize: i < 2 ? 40 : 48, fontWeight: 800, width: '100%', textAlign: 'center', padding: '18px 24px' }}>
              {t}
            </Box>
          </Pop>
        ))}
      </div>
      <Pop p={at(cue(cues[0], 0.1) + 1.5)} style={{ width: 470, flexShrink: 0 }}>
        <Box accent={T.gold} style={{ padding: '18px 22px' }}>
          <div style={{ fontSize: 36, fontWeight: 900, color: T.gold, marginBottom: 12 }}>① 예시</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {NATURAL_EXAMPLE.map((e, i) => (
              <Pop key={e.stock} p={at(cue(cues[0], 0.1) + 1.8 + i * 0.35)} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <Pic src={STOCK_IMG[e.stock]!} size={96} tile />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 40, fontWeight: 900, color: tone[e.tone] }}>{e.delta}</span>
                  <span style={{ fontSize: 28, color: T.mut }}>
                    {e.stock} · {e.why}
                  </span>
                </div>
              </Pop>
            ))}
          </div>
        </Box>
      </Pop>
    </AbsoluteFill>
  );
};

/**
 * 투표 — 표 가격은 시장 뱃지. 실연: 내가 동전으로 표를 사서 B에게 3표, D에게 1표를 던지면
 * 표가 날아가 쌓이고, 최다 득표 B가 「경제사범」 도장을 받는다.
 */
const Vote = ({ scene, narrSec }: Props) => {
  const T = useT();
  const { sec, at, seg, cue, cues } = useClock(scene, narrSec);
  const [win, none] = scene.screen[2]!.split(' / ');
  const buyAt = cue(cues[0], 0.15);
  const castAt = cue(cues[1], 0.45);
  const tallyAt = cue(cues[2], 0.65);
  const targets = [
    { name: 'B', votes: 3 },
    { name: 'C', votes: 0 },
    { name: 'D', votes: 1 },
  ];
  const stamped = sec >= tallyAt + 0.8;
  return (
    <Stage gap={30}>
      <div style={{ display: 'flex', gap: 50, alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 30, alignItems: 'flex-start' }}>
          <Pop p={at(buyAt)} style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            {hasImg(scene, 'job/mayor.png') ? <Pic src="job/mayor.png" size={120} round /> : null}
            <Box accent={T.gold} style={{ fontSize: 48, fontWeight: 900, color: T.gold }}>
              {scene.screen[0]}
            </Box>
          </Pop>
          <Pop p={at(castAt)}>
            <Box style={{ fontSize: 46, fontWeight: 800 }}>{scene.screen[1]}</Box>
          </Pop>
          <Pop p={at(tallyAt)} style={{ display: 'flex', gap: 22, alignItems: 'center' }}>
            <Chain text={win!} size={42} accent={T.red} />
            <span style={{ fontSize: 42, color: T.mut }}>/</span>
            <Chain text={none!} size={42} />
          </Pop>
        </div>
        {/* 실연 */}
        <Pop p={at(buyAt + 0.3)} style={{ flexShrink: 0 }}>
          <Box style={{ width: 620, height: 520, position: 'relative', padding: 0 }}>
            <div style={{ position: 'absolute', left: 30, top: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
              <Avatar name="나" size={90} color={T.gold} sub="현금 10원" />
              <Arrow size={40} />
              <div style={{ display: 'flex', gap: 6 }}>
                {[0, 1, 2, 3].map((k) => {
                  const f = seg(buyAt + 0.8 + k * 0.2, buyAt + 1.3 + k * 0.2);
                  return (
                    <div key={k} style={{ position: 'relative', width: 58, height: 72 }}>
                      <Coin text="1" size={54} style={{ position: 'absolute', left: 0, top: 8, opacity: 1 - f }} />
                      <Ballot p={f} style={{ position: 'absolute', left: 0, top: 0 }} />
                    </div>
                  );
                })}
              </div>
              <span style={{ fontSize: 28, color: T.mut, fontWeight: 700, opacity: at(buyAt + 1.8) }}>표 4장</span>
            </div>
            <div style={{ position: 'absolute', left: 30, right: 30, top: 170, display: 'flex', justifyContent: 'space-around' }}>
              {targets.map((tg) => (
                <div key={tg.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, position: 'relative' }}>
                  <Avatar name={tg.name} size={90} color={stamped && tg.votes === 3 ? T.red : undefined} />
                  <div style={{ display: 'flex', gap: -10, height: 80, alignItems: 'flex-end' }}>
                    {Array.from({ length: tg.votes }, (_, k) => {
                      const f = seg(castAt + 0.5 + k * 0.35, castAt + 1.1 + k * 0.35);
                      return <Ballot key={k} p={f} style={{ marginLeft: k ? -24 : 0, transform: `translateY(${(1 - f) * -140}px) rotate(${(k - 1) * 8}deg)` }} />;
                    })}
                  </div>
                  <div style={{ fontSize: 30, fontWeight: 900, color: T.text, opacity: at(castAt + 0.5 + tg.votes * 0.35 + 0.4) }}>{tg.votes}표</div>
                  {stamped && tg.votes === 3 ? (
                    <div style={{ position: 'absolute', top: -44, left: 30, fontSize: 40, fontWeight: 900, color: T.red, border: `5px solid ${T.red}`, borderRadius: 12, padding: '4px 14px', transform: 'rotate(-14deg)', background: 'rgba(0,0,0,0.45)', whiteSpace: 'nowrap' }}>
                      경제사범
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            <div style={{ position: 'absolute', left: 30, right: 30, bottom: 22, fontSize: 28, color: T.mut, textAlign: 'center', opacity: at(tallyAt + 1.2) }}>
              누가 몇 표 던졌는지는 비공개 · 최다 득표가 둘이면 경제사범 없음
            </div>
          </Box>
        </Pop>
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
  const T = useT();
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
              accent={i === 0 ? accent : undefined}
              style={{
                fontSize: i === 0 ? 44 : 38,
                fontWeight: i === 0 ? 900 : 700,
                width: '100%',
                padding: '10px 20px',
                color: i === 0 ? accent : T.text,
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
        {col(left!, T.blue, at(cue(cues[0], 0.3)))}
        {col(right!, T.red, at(cue(cues[1], 0.65)))}
      </div>
      <Pop p={at(0.4)}>
        <Box accent={T.gold} style={{ fontSize: 44, fontWeight: 900, textAlign: 'center', color: T.gold, padding: '14px 24px' }}>
          {common}
        </Box>
      </Pop>
      <Note text={str(scene.data?.foot)} p={at(cue(cues[2], 0.9))} size={36} color={T.text} />
    </AbsoluteFill>
  );
};

/** 정보 공개 범위 — 공개(주가 = 종목 로고) / 비공개(직업 = 뱃지) */
const Info = ({ scene, narrSec }: Props) => {
  const T = useT();
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
              <span style={{ color: T.dim, flexShrink: 0 }}>·</span>
              <span>{b}</span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 14, marginTop: 26 }}>
            {pics.map((s) => (
              <div key={s} style={{ position: 'relative' }}>
                <Pic src={s} size={104} round={s.startsWith('job/')} tile={s.startsWith('company/')} style={{ filter: hidden ? 'grayscale(1) brightness(0.45)' : undefined }} />
                {hidden ? (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 58, fontWeight: 900, color: T.text }}>
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
        {panel(scene.screen[0]!, T.green, at(0.4), logos, false)}
        {panel(scene.screen[1]!, T.red, at(cue('하지만', 0.3)), badges, true)}
      </div>
      <Note text={str(scene.data?.note)} p={at(cue('경찰의 조사', 0.7))} size={38} color={T.text} />
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
  const theme = props.gameTitle.startsWith('디펜스') ? THEMES.defense : THEMES.mafia;
  return (
    <ThemeCtx.Provider value={theme}>
      <AbsoluteFill>
        {props.scene.variant !== 'title' && props.label ? (
          <div style={{ opacity: lp }}>
            <Label text={props.label} game={props.gameTitle} />
          </div>
        ) : null}
        <View {...props} />
      </AbsoluteFill>
    </ThemeCtx.Provider>
  );
};
