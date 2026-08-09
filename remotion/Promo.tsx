import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

/**
 * Assay promo — a motion graphic, not a screen capture.
 *
 * It tells the one thing that makes the product different: six specialists
 * build, one breaks it on purpose, and you only ever see the version that runs.
 * Type and colour are the app's own system, so the film and the product read as
 * the same thing.
 */

const INK = '#08080A';
const TEXT = '#EDEDF0';
const MUTED = '#8B8B96';
const FAINT = '#3F3F46';

const BLUE = '#60A5FA';
const GREEN = '#4ADE80';
const AMBER = '#FBBF24';
const RED = '#F87171';
const EMERALD = '#34D399';
const CYAN = '#22D3EE';
const PURPLE = '#C084FC';

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const SANS = 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif';

export const FPS = 30;
export const DURATION = 15 * FPS;

/* ── helpers ─────────────────────────────────────────── */

const useEnter = (delay = 0, damping = 200) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, mass: 0.6 }, durationInFrames: 22 });
};

/** Types out `text` one character at a time. */
const Typed: React.FC<{ text: string; start: number; cps?: number; style?: React.CSSProperties }> = ({
  text,
  start,
  cps = 26,
  style,
}) => {
  const frame = useCurrentFrame();
  const shown = Math.max(0, Math.min(text.length, Math.floor(((frame - start) / FPS) * cps)));
  const done = shown >= text.length;
  return (
    <span style={style}>
      {text.slice(0, shown)}
      {!done && shown > 0 ? (
        <span style={{ opacity: Math.floor(frame / 8) % 2 ? 0.15 : 1 }}>▌</span>
      ) : null}
    </span>
  );
};

/** One agent turn: a coloured rail, a name and a line of text. */
const Turn: React.FC<{
  who: string;
  hue: string;
  children: React.ReactNode;
  start: number;
}> = ({ who, hue, children, start }) => {
  const e = useEnter(start);
  const frame = useCurrentFrame();
  if (frame < start) return null;
  return (
    <div
      style={{
        width: SAFE,
        marginBottom: 28,
        opacity: e,
        transform: `translateY(${interpolate(e, [0, 1], [18, 0])}px)`,
      }}
    >
      <div
        style={{
          fontFamily: MONO,
          fontSize: 15,
          letterSpacing: '0.18em',
          color: hue,
          marginBottom: 10,
        }}
      >
        {who.toUpperCase()}
      </div>
      <div style={{ borderLeft: `3px solid ${hue}`, paddingLeft: 18 }}>{children}</div>
    </div>
  );
};

const FileChip: React.FC<{ name: string; start: number; index: number }> = ({ name, start, index }) => {
  const e = useEnter(start + index * 5);
  return (
    <div
      style={{
        opacity: e,
        transform: `translateX(${interpolate(e, [0, 1], [-26, 0])}px)`,
        border: '1px solid rgba(255,255,255,0.09)',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: 12,
        padding: '11px 16px',
        marginTop: 10,
        fontFamily: MONO,
        fontSize: 16,
        color: '#A1A1AA',
      }}
    >
      {name}
    </div>
  );
};

const Note: React.FC<{ text: string; tone: 'fail' | 'pass'; start: number }> = ({ text, tone, start }) => {
  const e = useEnter(start, 14);
  const fail = tone === 'fail';
  return (
    <div
      style={{
        opacity: e,
        transform: `scale(${interpolate(e, [0, 1], [0.94, 1])})`,
        transformOrigin: 'left center',
        marginTop: 12,
        borderRadius: 12,
        padding: '12px 16px',
        fontFamily: MONO,
        fontSize: 15,
        border: `1px solid ${fail ? 'rgba(248,113,113,0.32)' : 'rgba(52,211,153,0.32)'}`,
        background: fail ? 'rgba(248,113,113,0.09)' : 'rgba(52,211,153,0.09)',
        color: fail ? '#FCA5A5' : '#6EE7B7',
      }}
    >
      {text}
    </div>
  );
};

/* ── scenes ──────────────────────────────────────────── */

const Prompt: React.FC = () => (
  <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
    <div
      style={{
        fontFamily: MONO,
        fontSize: 15,
        letterSpacing: '0.24em',
        color: MUTED,
        marginBottom: 22,
      }}
    >
      YOU
    </div>
    <div
      style={{
        width: SAFE,
        textAlign: 'center',
        fontFamily: SANS,
        fontSize: 36,
        fontWeight: 600,
        letterSpacing: '-0.03em',
        color: TEXT,
        lineHeight: 1.2,
      }}
    >
      <Typed text="Build a kanban board that survives a refresh" start={6} cps={30} />
    </div>
  </AbsoluteFill>
);

/** Centred: the site views this film through a frame that crops the edges. */
/** Safe area: the landing page crops to roughly the middle half of the frame. */
const SAFE = 620;

const Stage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
    <div style={{ width: SAFE }}>{children}</div>
  </AbsoluteFill>
);

const Build: React.FC = () => (
  <Stage>
    <Turn who="Architect" hue={BLUE} start={4}>
      <div style={{ fontFamily: SANS, fontSize: 21, color: '#D4D4D8', lineHeight: 1.45 }}>
        <Typed text="Three columns, drag between them, state in localStorage." start={10} cps={34} />
      </div>
    </Turn>
    <Turn who="Coder" hue={GREEN} start={44}>
      <div style={{ fontFamily: SANS, fontSize: 21, color: '#D4D4D8', lineHeight: 1.45 }}>
        Writing the board, the column and the persistence hook.
      </div>
      {['src/App.tsx', 'src/components/Board.tsx', 'src/hooks/useBoard.ts'].map((f, i) => (
        <FileChip key={f} name={f} start={58} index={i} />
      ))}
    </Turn>
  </Stage>
);

const Break: React.FC = () => (
  <Stage>
    <Turn who="QA" hue={AMBER} start={4}>
      <div style={{ fontFamily: SANS, fontSize: 23, color: TEXT, lineHeight: 1.4 }}>
        Ran it. The board crashes on the first drag.
      </div>
      <Note text="TypeError: can't read property 'id' of undefined" tone="fail" start={18} />
    </Turn>
    <Turn who="Debugger" hue={RED} start={44}>
      <div style={{ fontFamily: SANS, fontSize: 23, color: TEXT, lineHeight: 1.4 }}>
        Drop handler read the card before the column resolved. Fixed.
      </div>
      <FileChip name="src/components/Board.tsx" start={56} index={0} />
    </Turn>
    <Turn who="QA" hue={EMERALD} start={80}>
      <div style={{ fontFamily: SANS, fontSize: 23, color: TEXT, lineHeight: 1.4 }}>Ran it again.</div>
      <Note text="Build clean · drag works · state survives reload" tone="pass" start={92} />
    </Turn>
  </Stage>
);

const Claim: React.FC = () => {
  const frame = useCurrentFrame();
  const lines = ['Six agents build it.', 'One agent breaks it.', 'You get what works.'];
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      {lines.map((line, i) => {
        const e = spring({
          frame: frame - 4 - i * 7,
          fps: FPS,
          config: { damping: 200, mass: 0.7 },
          durationInFrames: 26,
        });
        return (
          <div key={line} style={{ overflow: 'hidden', height: 62, textAlign: 'center', width: SAFE }}>
            <div
              style={{
                fontFamily: SANS,
                fontSize: 46,
                fontWeight: 600,
                letterSpacing: '-0.04em',
                color: i === 1 ? MUTED : TEXT,
                transform: `translateY(${interpolate(e, [0, 1], [100, 0])}%)`,
                lineHeight: 1.3,
              }}
            >
              {line}
            </div>
          </div>
        );
      })}
      <div
        style={{
          marginTop: 30,
          fontFamily: MONO,
          fontSize: 14,
          letterSpacing: '0.22em',
          color: MUTED,
          opacity: spring({ frame: frame - 34, fps: FPS, config: { damping: 200 }, durationInFrames: 20 }),
        }}
      >
        ASSAY — SIX AGENTS · ONE QA GATE
      </div>
    </AbsoluteFill>
  );
};

/* ── film ────────────────────────────────────────────── */

export const Promo: React.FC = () => {
  const frame = useCurrentFrame();
  // A hairline that tracks progress, like the pipeline rail on the site.
  const progress = interpolate(frame, [0, DURATION], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: INK }}>
      {/* corner marks keep the frame feeling like a viewport */}
      <div
        style={{
          position: 'absolute',
          inset: 40,
          border: `1px solid ${FAINT}33`,
          borderRadius: 18,
          pointerEvents: 'none',
        }}
      />

      <Sequence from={0} durationInFrames={2.6 * FPS}>
        <Prompt />
      </Sequence>
      <Sequence from={2.6 * FPS} durationInFrames={4.2 * FPS}>
        <Build />
      </Sequence>
      <Sequence from={6.8 * FPS} durationInFrames={5 * FPS}>
        <Break />
      </Sequence>
      <Sequence from={11.8 * FPS} durationInFrames={3.2 * FPS}>
        <Claim />
      </Sequence>

      <div
        style={{
          position: 'absolute',
          left: 40,
          right: 40,
          bottom: 40,
          height: 2,
          background: `${FAINT}33`,
          borderRadius: 2,
        }}
      >
        <div
          style={{
            width: `${progress * 100}%`,
            height: '100%',
            borderRadius: 2,
            background: `linear-gradient(90deg, ${BLUE}, ${GREEN}, ${AMBER}, ${RED}, ${EMERALD})`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
