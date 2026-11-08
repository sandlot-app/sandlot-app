import type { CSSProperties, ReactNode } from 'react'
import { Stage, Phone, Count, type Act } from '../../kit'
import { FieldLayer } from '../sandlot-youth/youth'
import './u2.css'

// Group u2: two after-the-game screens, built from baseball things instead of
// app widgets.
//
//  Final:  the Rec field at the end of the day, a scoreboard plate over the
//          outfield (numbers click over, runs by inning as small lit squares),
//          Maya's hits drawn on the grass as orange ball paths, and one ticket
//          below: her line, and the recap as a stub you tear off by tapping.
//  Box:    the Mustangs as a deck of baseball cards, Maya on top. Swipe to
//          deal the next kid; a pitcher's card flips to show pitching; the
//          Hawks are a small stack of cards, by number.
//
// Same Saturday: Mustangs 7, Hawks 4 after six innings. Player names show in
// the interface only (AGENTS.md, rule 5); the Hawks are shown by number.

// ---------------------------------------------------------------- icons
// icons.download, bold solid round
const P = {
  back: 'M8.00096 15.2322L6.01874 13.25H20.751C21.4413 13.25 22.001 12.6904 22.001 12C22.001 11.3097 21.4413 10.75 20.751 10.75H6.01874L8.00096 8.76779C8.48912 8.27964 8.48912 7.48818 8.00096 7.00003C7.5128 6.51187 6.72135 6.51187 6.23319 7.00003L2.11709 11.1161C1.62894 11.6043 1.62894 12.3958 2.11709 12.8839L6.23319 17C6.72135 17.4882 7.5128 17.4882 8.00096 17C8.48911 16.5119 8.48911 15.7204 8.00096 15.2322Z',
  share: 'M22.2932 11.2929C22.6838 11.6834 22.6838 12.3166 22.2932 12.7071L14.7075 20.2929C14.0775 20.9229 13.0003 20.4767 13.0003 19.5858V16C8.84027 16 5.73573 16.8017 3.21353 18.6606C2.34637 19.2997 0.835845 18.5228 1.18803 17.5048C2.88164 12.6092 6.12584 8.00002 13.0003 8.00002L13.0003 4.41424C13.0003 3.52333 14.0775 3.07716 14.7075 3.70713L22.2932 11.2929Z',
  caret: 'M10.0038 15.2323L13.236 12L10.0038 8.7678C9.51566 8.27964 9.51566 7.48818 10.0038 7.00003C10.492 6.51187 11.2834 6.51187 11.7716 7.00003L15.8877 11.1161C16.1221 11.3506 16.2538 11.6685 16.2538 12C16.2538 12.3316 16.1221 12.6495 15.8877 12.8839L11.7716 17C11.7106 17.061 11.6448 17.1144 11.5755 17.1602C11.0903 17.4806 10.4309 17.4272 10.0038 17C9.94279 16.939 9.8894 16.8733 9.84364 16.8039C9.52329 16.3187 9.57668 15.6594 10.0038 15.2323Z',
  book: 'M10.75 5.65625C10.75 4.77864 10.0042 4 9 4H3.5C2.39543 4 1.5 4.89543 1.5 6V18C1.5 19.1046 2.39543 20 3.5 20H9C9.5593 20 10.0573 20.3461 10.3777 20.825C10.7615 21.3989 11.3096 22 12 22C12.6904 22 13.2385 21.3989 13.6223 20.825C13.9427 20.3461 14.4407 20 15 20H20.5C21.6046 20 22.5 19.1046 22.5 18V6C22.5 4.89543 21.6046 4 20.5 4H15C13.9958 4 13.25 4.77864 13.25 5.65625V17.25C13.25 17.9404 12.6904 18.5 12 18.5C11.3096 18.5 10.75 17.9404 10.75 17.25V5.65625Z',
  arrowLeft: 'M10.9549 18.1872L6.0177 13.25H20.7499C21.4403 13.25 21.9999 12.6904 21.9999 12C21.9999 11.3097 21.4403 10.75 20.7499 10.75H6.01771L10.9549 5.81284C11.443 5.32468 11.443 4.53323 10.9549 4.04507C10.8939 3.98405 10.8281 3.93066 10.7588 3.8849C10.2736 3.56454 9.61426 3.61794 9.18712 4.04507L2.11606 11.1161C1.6279 11.6043 1.6279 12.3957 2.11606 12.8839L9.18712 19.955C9.67528 20.4431 10.4667 20.4431 10.9549 19.955C11.443 19.4668 11.443 18.6753 10.9549 18.1872Z',
  refresh: 'M12.0049 18.5C8.41503 18.5 5.50488 15.5899 5.50488 12C5.50488 8.41015 8.41503 5.5 12.0049 5.5C14.1981 5.5 16.1375 6.5862 17.3147 8.25L15.1049 8.25C14.4145 8.25 13.8549 8.80964 13.8549 9.5C13.8549 10.1904 14.4145 10.75 15.1049 10.75L20.3549 10.75C20.6864 10.75 21.0043 10.6183 21.2388 10.3839C21.4732 10.1495 21.6049 9.83152 21.6049 9.5V4.25C21.6049 3.55964 21.0452 3 20.3549 3C19.6645 3 19.1049 3.55964 19.1049 4.25V6.46852C17.4579 4.35746 14.8899 3 12.0049 3C7.03432 3 3.00488 7.02944 3.00488 12C3.00488 16.9706 7.03432 21 12.0049 21C15.8447 21 19.1229 18.5953 20.4157 15.2097C20.6965 14.4742 20.1019 13.75 19.3145 13.75H19.2157C18.6547 13.75 18.1736 14.1299 17.9453 14.6423C16.9328 16.9154 14.6539 18.5 12.0049 18.5Z',
}
type IconName = keyof typeof P
const Icon = ({ name, size = 20 }: { name: IconName; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path d={P[name]} fill="currentColor" fillRule="evenodd" />
  </svg>
)

// ---------------------------------------------------------------- the shell
function Shell<T extends object>({ initial, poster, script, rest, tag, children }: { initial: T; poster: T; script: (a: Act<T>) => Promise<void>; rest: { x: number; y: number }; tag: string; children: (s: T) => ReactNode }) {
  return (
    <Stage<T>
      width={440}
      height={820}
      compact={{ below: 440, width: 358, height: 690 }}
      initial={initial}
      poster={poster}
      script={script}
      cursor={{ at: { wide: rest, compact: { x: rest.x - 40, y: Math.min(rest.y, 600) } }, style: 'touch' }}
      className={`fd tv bp yf u2 ${tag}`}
    >
      {(s, _rect, layout) => (
        <>
          <div className="u2-wash" />
          <Phone width={layout === 'compact' ? 326 : 340} className="u2-phone">
            {children(s)}
          </Phone>
        </>
      )}
    </Stage>
  )
}

/** The orange number chip, as on the field and everywhere else */
function Chip({ n, size = 44, away }: { n: string; size?: number; away?: boolean }) {
  return (
    <span className="u2-chip" data-away={away || undefined} style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {n}
    </span>
  )
}

// ================================================================= Final

// Mustangs 7, Hawks 4, six innings. The Mustangs bat first.
const INNINGS = [
  { id: 'MUS', runs: [0, 1, 1, 1, 2, 2], total: 7 },
  { id: 'HAW', runs: [0, 1, 0, 1, 1, 1], total: 4 },
]

// The field is drawn in a 400 box, scaled by 1.4 in the plane (see youth.tsx)
const K = 1.4
const k = (n: number) => +(n * K).toFixed(2)

// Maya's two hits today: a double to center in the 4th, a single to right-center in the 6th
const HITS = [
  { d: 'M200 326 Q168 226 186 104', end: [186, 104] as const, tag: '2B' },
  { d: 'M200 326 Q250 258 278 178', end: [278, 178] as const, tag: '1B' },
]

type F = { board: boolean; hit: 0 | 1 | 2; card: boolean; open: boolean; fade: boolean }
const FSTART: F = { board: false, hit: 0, card: false, open: false, fade: false }
const FPOSTER: F = { board: true, hit: 2, card: true, open: false, fade: false }
const FREST = { x: 350, y: 520 }
// The cursor rests where the Shell starts it, wide or compact
const restAt = (a: { layout: string }, r: { x: number; y: number }) => (a.layout === 'compact' ? { x: r.x - 40, y: Math.min(r.y, 600) } : r)

const finalScript = async (a: Act<F>) => {
  await a.wait(300)
  // The ticket slides up from the bottom of the field
  a.mark('card')
  a.set({ card: true })
  await a.wait(1200)
  // The board is set: the numbers click over, then the totals roll
  a.mark('board')
  a.set({ board: true })
  await a.wait(2500)
  a.mark('double')
  a.set({ hit: 1 })
  await a.wait(1800)
  a.mark('single')
  a.set({ hit: 2 })
  await a.wait(2300)
  a.mark('tap')
  await a.click('teaser')
  a.set({ open: true })
  await a.wait(2800)
  a.set({ fade: true })
  await a.wait(450)
  await a.snap({ ...FSTART, fade: true })
  await a.wait(80)
  a.set({ fade: false })
  await a.move(restAt(a, FREST))
}

/** One square of the board: a hung number that clicks over when the board is set */
function Square({ v, on, i, big }: { v: number; on: boolean; i: number; big?: boolean }) {
  return (
    <span className="u2-sq" data-on={on || undefined} data-zero={v === 0 || undefined} data-big={big || undefined} style={{ ['--i' as string]: i } as CSSProperties}>
      <b>{v}</b>
    </span>
  )
}

function Plate({ on }: { on: boolean }) {
  return (
    <div className="u2-plate">
      <i className="u2-bolt u2-bolt--tl" />
      <i className="u2-bolt u2-bolt--tr" />
      <div className="u2-plate__top">
        <span className="u2-final">FINAL</span>
        <span className="u2-plate__inn">6 innings</span>
      </div>
      {INNINGS.map((t, row) => (
        <div key={t.id} className="u2-plate__row">
          <span className="u2-team" data-away={t.id === 'HAW' || undefined}>{t.id}</span>
          <span className="u2-plate__sqs">
            {t.runs.map((n, i) => <Square key={i} v={n} on={on} i={row * 6 + i} />)}
          </span>
          <span className="u2-total">
            <b><Count value={on ? t.total : 0} duration={900} /></b>
          </span>
        </div>
      ))}
    </div>
  )
}

/** A spot where a ball came down: a ring on the grass and a tag standing over it */
function Landing({ x, y, tag, on }: { x: number; y: number; tag: string; on: boolean }) {
  return (
    <span className="u2-land" data-on={on || undefined} style={{ transform: `translate3d(${k(x)}px, ${k(y)}px, 0)` }}>
      <i className="u2-land__ring" />
      <span className="bp-stand u2-land__stand"><span className="u2-tag">{tag}</span></span>
    </span>
  )
}

function FieldExtras({ hit }: { hit: number }) {
  return (
    <>
      <span className="u2-hits">
        <svg viewBox="0 0 400 400" aria-hidden>
          {HITS.map((h, i) => (
            <g key={i} data-on={hit > i || undefined}>
              <path className="u2-hit u2-hit--case" d={h.d} pathLength={1} />
              <path className="u2-hit" d={h.d} pathLength={1} />
            </g>
          ))}
        </svg>
      </span>
      {HITS.map((h, i) => <Landing key={i} x={h.end[0]} y={h.end[1]} tag={h.tag} on={hit > i} />)}
    </>
  )
}

function Ticket({ on }: { on: boolean }) {
  return (
    <div className="u2-ticket" data-in={on || undefined}>
      <div className="u2-ticket__shape">
        <div className="u2-top">
          <Chip n="12" size={54} />
          <p className="u2-line"><b>Maya</b> went 2-for-3 with a double and scored twice.</p>
        </div>
        <div className="u2-stub" data-target="teaser">
          <span className="u2-stub__text">
            <span className="u2-kick">Recap</span>
            <span className="u2-stub__head">Mustangs pull away late to beat the Hawks 7–4</span>
          </span>
          <span className="u2-stub__go"><Icon name="caret" size={22} /></span>
        </div>
      </div>
    </div>
  )
}

function Recap({ open }: { open: boolean }) {
  return (
    <div className="u2-recap" data-open={open || undefined}>
      <div className="u2-recap__nav">
        <span className="u2-round"><Icon name="back" size={20} /></span>
        <span className="u2-recap__title">Mustangs vs Hawks</span>
        <span className="u2-round u2-round--ghost" />
      </div>
      <div className="u2-recap__body">
        <span className="u2-kick">Recap · Final</span>
        <div className="u2-recap__head">Mustangs pull away late to beat the Hawks 7–4</div>
        <div className="u2-recap__by"><Icon name="book" size={14} />Written from the scorebook · 10:42 AM</div>
        <div className="u2-recap__story">
          <p>
            A 3–2 game stayed close until the 5th, when Ava doubled home Mia and Leo singled in Ava to make it 5–2.
            Two more runs in the 6th sealed a 7–4 win on Field 2.
          </p>
          <p>
            <b className="u2-me">Maya</b> went 2 for 3 with a walk and scored twice. Her double in the 4th set up Liam’s single,
            and her RBI single in the 6th made it 6–3.
          </p>
        </div>
        <div className="u2-recap__more">
          <span className="u2-playcard">
            <span className="u2-playcard__text">
              <b>Liam singles to left, Maya scores</b>
              <small>Top 4</small>
            </span>
            <span className="u2-playcard__score">3–1</span>
            <Icon name="caret" size={18} />
          </span>
          <p>The Mustangs play the Eagles next Saturday at 9:00 AM on Field 1.</p>
        </div>
      </div>
      <span className="u2-btn"><Icon name="share" size={20} />Share Maya’s game</span>
    </div>
  )
}

export function FinalPlay() {
  return (
    <Shell<F> initial={FSTART} poster={FPOSTER} script={finalScript} rest={FREST} tag="u2-final-play">
      {(s) => (
        <div className="u2-app" data-target="screen">
          <div className="u2-field">
            <FieldLayer s={{ phase: 'set', liam: 0, maya: 0 }} variant="rec" extra={<FieldExtras hit={s.hit} />} />
            <div className="u2-dusk" />
          </div>
          <Plate on={s.board} />
          <Ticket on={s.card} />
          <Recap open={s.open} />
          <div className="fdx-fade" data-on={s.fade || undefined} />
        </div>
      )}
    </Shell>
  )
}

// ================================================================= Box score as cards

type Ball = { x: number; y: number; hit: boolean }
type Kid = {
  n: string
  name: string
  pos: string
  big: string
  rest: string
  balls: Ball[]
  pit?: { p: number; won?: boolean; line: string }
}

const hit = (x: number, y: number): Ball => ({ x, y, hit: true })
const out = (x: number, y: number): Ball => ({ x, y, hit: false })

// One card per Mustangs kid, Maya on top. Only what happened, in one phrase.
const KIDS: Kid[] = [
  { n: '12', name: 'Maya', pos: 'SS', big: '2-for-3', rest: 'a double, 2 runs', balls: [hit(98, 34), hit(130, 70), out(54, 66)] },
  { n: '7', name: 'Liam', pos: '1B', big: '2-for-4', rest: '2 RBIs, a run', balls: [hit(64, 74), hit(126, 80), out(86, 108), out(104, 44)] },
  { n: '15', name: 'Ben', pos: 'P', big: '1-for-3', rest: 'a walk, an RBI', balls: [hit(138, 72), out(118, 104), out(58, 62)], pit: { p: 58, won: true, line: '4 innings, 5 strikeouts' } },
  { n: '3', name: 'Ava', pos: 'C', big: '1-for-3', rest: 'a walk, an RBI, a run', balls: [hit(96, 78), out(72, 110), out(150, 64)] },
  { n: '18', name: 'Leo', pos: '2B', big: '1-for-3', rest: 'an RBI', balls: [hit(60, 78), out(132, 110), out(104, 46)], pit: { p: 29, line: '2 innings, 3 strikeouts' } },
  { n: '22', name: 'Jack', pos: 'CF', big: '1-for-4', rest: 'a run', balls: [hit(146, 66), out(84, 106), out(46, 64), out(112, 54)] },
  { n: '9', name: 'Noah', pos: 'RF', big: '1-for-3', rest: 'a hit', balls: [hit(100, 60), out(70, 104), out(140, 96)] },
  { n: '5', name: 'Mia', pos: 'LF', big: '0-for-3', rest: 'a walk', balls: [out(88, 104), out(60, 66), out(124, 72)] },
  { n: '4', name: 'Zoe', pos: '3B', big: '0-for-3', rest: 'a walk', balls: [out(112, 106), out(150, 62), out(78, 56)] },
]
const LIMIT = 75
const BEN = 2

// The kids' balls in play, on the same Rec field as everywhere else
function CardField({ balls }: { balls: Ball[] }) {
  return (
    <svg className="u2-cf" viewBox="0 0 200 160" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="200" height="160" fill="#3f7f3a" />
      <path d="M100 150 L-4 56 Q100 -22 204 56 Z" fill="#56a04b" />
      {[0, 1, 2, 3].map((i) => <rect key={i} x="-10" y={30 + i * 26} width="220" height="12" fill="rgba(255,255,255,0.07)" />)}
      <path d="M-4 56 Q100 -22 204 56" fill="none" stroke="#f4c430" strokeWidth="3" />
      <path d="M100 152 L50 104 Q100 50 150 104 Z" fill="#c8915f" />
      <path d="M100 146 L-4 52 M100 146 L204 52" stroke="rgba(255,255,255,0.85)" strokeWidth="1.2" />
      {[[128, 118], [100, 90], [72, 118]].map(([x, y], i) => (
        <rect key={i} x={x - 3.5} y={y - 3.5} width="7" height="7" fill="#fff" transform={`rotate(45 ${x} ${y})`} />
      ))}
      {balls.map((b, i) => (
        <g key={i} className="u2-ball" data-hit={b.hit || undefined} style={{ ['--b' as string]: i } as CSSProperties}>
          <path className="u2-ball__case" d={`M100 146 L${b.x} ${b.y}`} pathLength={1} />
          <path className="u2-ball__line" d={`M100 146 L${b.x} ${b.y}`} pathLength={1} />
          <circle className="u2-ball__dot" cx={b.x} cy={b.y} r={b.hit ? 6 : 5} />
        </g>
      ))}
    </svg>
  )
}

/** The front of a kid's card: chip, first name, position, balls in play, one phrase */
function Front({ kid }: { kid: Kid }) {
  return (
    <div className="u2-face u2-face--front">
      <div className="u2-in">
        <div className="u2-head">
          <Chip n={kid.n} size={48} />
          <span className="u2-name">{kid.name}</span>
          <span className="u2-pos">{kid.pos}</span>
        </div>
        <div className="u2-art">
          <CardField balls={kid.balls} />
          <span className="u2-key"><span><i data-hit />hit</span><span><i />out</span></span>
          {kid.pit && (
            <span className="u2-turn" data-target={`flip-${kid.name}`}>
              <Icon name="refresh" size={16} /><span>Pitching</span>
            </span>
          )}
        </div>
        <div className="u2-sentence">
          <b>{kid.big}</b>
          <span>{kid.rest}</span>
        </div>
      </div>
    </div>
  )
}

/** The back of a pitcher's card: pitches against the 10U daily limit, one bar */
function Back({ kid, on }: { kid: Kid; on: boolean }) {
  const pit = kid.pit!
  const pct = Math.round((pit.p / LIMIT) * 100)
  return (
    <div className="u2-face u2-face--back">
      <div className="u2-in u2-in--dark">
        <div className="u2-head">
          <Chip n={kid.n} size={48} />
          <span className="u2-name">{kid.name}</span>
          {pit.won && <span className="u2-won">Won</span>}
        </div>
        <div className="u2-pit">
          <span className="u2-pit__kick">Pitching</span>
          <span className="u2-pit__big"><b>{pit.p}</b><span className="u2-pit__of"><i>of {LIMIT}</i><i>pitches</i></span></span>
          <span className="u2-bar"><i data-warn={pct >= 85 || undefined} style={{ ['--p' as string]: on ? pct : 0 } as CSSProperties} /></span>
          <span className="u2-pit__left">{LIMIT - pit.p} left in today’s limit</span>
          <span className="u2-pit__line">{pit.line}</span>
        </div>
        <span className="u2-turn u2-turn--back"><Icon name="refresh" size={16} /><span>Batting</span></span>
      </div>
    </div>
  )
}

// The deck: where a card sits, by how far down the deck it is.
type Phase = 'idle' | 'in' | 'play' | 'out'
type D = { phase: Phase; top: number; drag: boolean; dx: number; dy: number; flip: boolean; landed: boolean; fade: boolean }
const DSTART: D = { phase: 'idle', top: 0, drag: false, dx: 0, dy: 0, flip: false, landed: false, fade: false }
const DPOSTER: D = { ...DSTART, phase: 'play', landed: true }
const DREST = { x: 250, y: 700 }

const PEEK = [0, -66, -90]
const SCALE = [1, 0.945, 0.89]

function place(i: number, s: D): CSSProperties {
  const rel = i - s.top
  const r = Math.min(Math.max(rel, 0), 2)
  if (rel < 0) {
    // Dealt off to the left
    return { transform: 'translate3d(-480px, -26px, 0) rotate(-16deg)', transition: 'transform 0.6s cubic-bezier(0.2, 0.6, 0.3, 1)', zIndex: 100 + i }
  }
  if (rel === 0 && s.drag) {
    return { transform: `translate3d(${s.dx}px, ${s.dy}px, 0) rotate(${(s.dx * 0.035).toFixed(2)}deg)`, transition: 'none', zIndex: 100 }
  }
  const away = s.phase === 'idle' || s.phase === 'out'
  const transform = away ? 'translate3d(0, 760px, 0) rotate(4deg)' : `translate3d(0, ${PEEK[r]}px, 0) scale(${SCALE[r]})`
  const delay = s.phase === 'in' ? (2 - r) * 90 : s.phase === 'out' ? r * 60 : r * 40
  const dur = s.phase === 'in' ? '0.9s' : s.phase === 'out' ? '0.55s' : '0.65s'
  const ease = s.phase === 'in' ? 'cubic-bezier(0.25, 0.8, 0.25, 1)' : s.phase === 'out' ? 'cubic-bezier(0.45, 0, 0.1, 1)' : 'cubic-bezier(0.3, 0.8, 0.2, 1)'
  return { transform, transition: `transform ${dur} ${ease} ${delay}ms`, zIndex: 50 - i }
}

const boxScript = async (a: Act<D>) => {
  await a.wait(500)
  a.mark('deal')
  a.set({ phase: 'in' })
  await a.wait(1500)
  // Maya's balls in play draw onto her card
  a.set({ landed: true })
  await a.wait(2400)

  const k = a.rect('screen').width / 402
  let top = 0
  const swipe = async () => {
    const g = a.rect('grab')
    const sx = g.x + g.width * 0.85
    const sy = g.y + g.height * 0.5
    await a.move({ x: sx, y: sy })
    await a.wait(180)
    a.set({ phase: 'play' })
    await a.drag(
      { x: sx - 240 * k, y: sy - 14 * k },
      (at) => a.put({ drag: true, dx: (at.x - sx) / k, dy: (at.y - sy) / k }),
      { duration: 380, path: (t, from, to) => ({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }) },
    )
    top += 1
    a.set({ drag: false, top, dx: 0, dy: 0 })
  }

  a.mark('swipe')
  await swipe()
  await a.wait(2300)
  a.mark('swipe2')
  await swipe()
  await a.wait(1500)
  a.mark('flip')
  await a.click('flip-Ben')
  a.set({ flip: true })
  await a.wait(3300)
  // The deck is gathered up and sent off; it is dealt again fresh
  a.mark('out')
  a.set({ phase: 'out' })
  await a.wait(900)
  await a.snap({ ...DSTART })
  await a.move(restAt(a, DREST))
}

function Pager({ at }: { at: number }) {
  return (
    <span className="u2-dots" aria-hidden>
      {KIDS.map((_, i) => <i key={i} data-on={i === at || undefined} data-past={i < at || undefined} />)}
    </span>
  )
}

/** The Hawks, a small stack of cards: numbers only */
function Hawks() {
  return (
    <div className="u2-hawks">
      <span className="u2-hawks__stack">
        <span className="u2-mini u2-mini--b" />
        <span className="u2-mini u2-mini--m" />
        <span className="u2-mini u2-mini--f">
          <span className="u2-mini__in">
            <Chip n="14" size={34} away />
            <span className="u2-mini__art"><CardField balls={[]} /></span>
          </span>
        </span>
      </span>
      <span className="u2-hawks__label">Hawks<Icon name="caret" size={14} /></span>
    </div>
  )
}

export function BoxPlay() {
  return (
    <Shell<D> initial={DSTART} poster={DPOSTER} script={boxScript} rest={DREST} tag="u2-box-play">
      {(s) => (
        <div className="u2-app" data-target="screen">
          <div className="u2-nav">
            <span className="u2-round"><Icon name="back" size={20} /></span>
            <span className="u2-nav__stack">
              <span className="u2-nav__big">Box score</span>
              <span className="u2-nav__small">Final · Mustangs 7, Hawks 4</span>
            </span>
            <span className="u2-round"><Icon name="share" size={20} /></span>
          </div>

          <div className="u2-deck">
            <span className="u2-grab" data-target="grab" />
            {KIDS.map((kid, i) => (
              <div key={kid.name} className="u2-card" data-seen={(i <= s.top && s.landed) || undefined} data-rel={Math.min(Math.max(i - s.top, 0), 2)} style={place(i, s)}>
                <div className="u2-flip" data-flip={(i === BEN && s.flip) || undefined}>
                  <Front kid={kid} />
                  {kid.pit && <Back kid={kid} on={i === BEN && s.flip} />}
                </div>
              </div>
            ))}
          </div>

          <div className="u2-hint">
            <span className="u2-hint__t"><Icon name="arrowLeft" size={18} />Swipe for the next kid</span>
            <Pager at={s.top} />
          </div>
          <Hawks />
          <div className="fdx-fade" data-on={s.fade || undefined} />
        </div>
      )}
    </Shell>
  )
}
