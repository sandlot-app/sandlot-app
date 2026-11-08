import { Fragment, type CSSProperties } from 'react'
import { Count, Roll, Stream, States, type Act } from '../../kit'
import { Bases, Mic, Waves, runnerStyle, words } from '../sandlot-shared/field'
import { Dots } from '../sandlot-fieldday/scene'
import '../sandlot-field/field.css'
import '../sandlot-fieldday/fieldday.css'
import '../sandlot-board-tv/tv.css'
import './ballpark.css'

// Field Day, round three: the TV score bug stays, and the field becomes a
// real ballpark. A standing outfield wall with its distances, stands with
// a crowd behind it, a mowed checkerboard, dugouts and chalk, and the
// Hawks in the field. On the hit the defense plays it: the left fielder
// runs the ball down and throws to second while the run scores.
//
// Three takes share this scene: "day" (a fixed broadcast camera), "cam"
// (the camera follows the ball, with tracking lines), "golden" (late light,
// long shadows, the lights coming on).

export type Variant = 'day' | 'cam' | 'golden'
export type Phase = 'set' | 'hit' | 'throw' | 'reset'
export type S = {
  mic: 'idle' | 'listening'
  cap: 'hint' | 'talk' | 'result' | 'undone'
  heard: number
  phase: Phase
  cam: 'wide' | 'left'
  liam: number
  maya: number
  us: number
  balls: number
  strikes: number
  outs: number
  last: string
  fade: boolean
}

export const SAID = 'Liam lines one to left, Maya scores'
export const START: S = { mic: 'idle', cap: 'hint', heard: 0, phase: 'set', cam: 'wide', liam: 0, maya: 2, us: 2, balls: 1, strikes: 1, outs: 1, last: 'Strike', fade: false }
export const POSTER: S = { ...START, cap: 'result', heard: words(SAID), phase: 'throw', liam: 1, maya: 4, us: 3, balls: 0, strikes: 0, last: 'Single' }
export const REST = { wide: { x: 330, y: 560 }, compact: { x: 290, y: 560 } }

export const script = async (a: Act<S>) => {
  await a.wait(700)
  a.mark('ball')
  await a.click('ball')
  a.set({ balls: 2, last: 'Ball' })
  await a.wait(850)
  a.mark('strike')
  await a.click('strike')
  a.set({ strikes: 2, last: 'Strike' })
  await a.wait(900)
  a.mark('tap')
  await a.click('mic')
  a.set({ mic: 'listening', cap: 'talk' })
  for (let i = 0; i < words(SAID); i++) {
    await a.wait(i === 4 ? 420 : 210)
    a.put((s) => ({ heard: s.heard + 1 }))
  }
  await a.wait(520)
  a.mark('hit')
  a.set({ mic: 'idle', phase: 'hit', cam: 'left' })
  await a.wait(380)
  a.set({ liam: 1, maya: 4 })
  await a.wait(1070)
  // The left fielder has it and throws to second; the camera pulls back for the run
  a.mark('throw')
  a.set({ phase: 'throw', cam: 'wide' })
  await a.wait(680)
  a.mark('saved')
  a.set({ us: 3, balls: 0, strikes: 0, last: 'Single', cap: 'result' })
  await a.wait(2900)
  a.mark('undo')
  await a.click('undo')
  a.set({ cap: 'undone', phase: 'reset', liam: 0, maya: 2, us: 2, balls: 2, strikes: 2, last: 'Strike' })
  await a.wait(1700)
  a.set({ fade: true })
  await a.wait(450)
  await a.snap({ ...START, fade: true })
  await a.wait(80)
  a.set({ fade: false })
  await a.move(REST)
}

// ---- Geometry, in the shared 400 box; the plane is drawn 560 across ----
const K = 1.4
const k = (n: number) => +(n * K).toFixed(2)
const HOME = { x: 200, y: 330 }
const FIRST = { x: 275, y: 255 }
const SECOND = { x: 200, y: 180 }
const THIRD = { x: 125, y: 255 }
const MOUND = { x: 200, y: 262 }

// The fence: a curve from the left-field corner to the right-field corner,
// both on the foul lines
const P0 = { x: -10, y: 120 }
const PC = { x: 200, y: -80 }
const P2 = { x: 410, y: 120 }
const bez = (t: number) => ({
  x: (1 - t) ** 2 * P0.x + 2 * (1 - t) * t * PC.x + t * t * P2.x,
  y: (1 - t) ** 2 * P0.y + 2 * (1 - t) * t * PC.y + t * t * P2.y,
})
const FENCE = `M${P0.x} ${P0.y} Q${PC.x} ${PC.y} ${P2.x} ${P2.y}`
const FAIR = `M${HOME.x} ${HOME.y} L${P0.x} ${P0.y} Q${PC.x} ${PC.y} ${P2.x} ${P2.y} Z`
const BEYOND = `M-300 ${P0.y} L${P0.x} ${P0.y} Q${PC.x} ${PC.y} ${P2.x} ${P2.y} L700 ${P2.y} L700 -400 L-300 -400 Z`

// The ball: lined to left, picked up by the left fielder, thrown to second
const LAND = { x: 98, y: 150 }
const GLOVE = { x: 98, y: 146 }
const BAG = { x: 203, y: 184 }
const scaled = (d: string) => d.replace(/-?\d+(\.\d+)?/g, (n) => String(k(+n)))
const HIT = `M200 322 L${LAND.x} ${LAND.y}`
const THROW = `M${GLOVE.x} ${GLOVE.y} L${BAG.x} ${BAG.y}`
const HIT_DX = LAND.x - 200
const HIT_DY = LAND.y - 322
const HIT_LEN = Math.hypot(HIT_DX, HIT_DY)
const HIT_ANGLE = (Math.atan2(HIT_DY, HIT_DX) * 180) / Math.PI

// The Hawks in the field: where each stands, and where the hit sends them
const FIELDERS: { id: string; at: [number, number]; to?: [number, number]; ms?: number }[] = [
  { id: 'p', at: [200, 258], to: [196, 282], ms: 900 },
  { id: 'c', at: [200, 346] },
  { id: '1b', at: [262, 236], to: [271, 250], ms: 700 },
  { id: '2b', at: [232, 198], to: [206, 188], ms: 900 },
  { id: 'ss', at: [166, 198], to: [146, 178], ms: 1000 },
  { id: '3b', at: [140, 232], to: [129, 250], ms: 800 },
  { id: 'lf', at: [82, 102], to: [GLOVE.x - 2, GLOVE.y - 2], ms: 1180 },
  { id: 'cf', at: [200, 66], to: [148, 94], ms: 1400 },
  { id: 'rf', at: [312, 104], to: [292, 128], ms: 1200 },
]

const WALL = 18
const SEGS = 30

function seg(t0: number, t1: number) {
  const a = bez(t0)
  const b = bez(t1)
  const len = Math.hypot(b.x - a.x, b.y - a.y) * K + 1
  const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
  return { a, len, ang }
}

const DISTANCES: Record<number, string> = { 7: '200', 15: '215', 22: '200' }

function Wall() {
  return (
    <>
      {Array.from({ length: SEGS }, (_, i) => {
        const { a, len, ang } = seg(i / SEGS, (i + 1) / SEGS)
        const eye = i >= 13 && i <= 16
        const base = `translate3d(${k(a.x)}px, ${k(a.y)}px, 0) rotateZ(${ang}deg)`
        return (
          <Fragment key={i}>
            <span className="bp-wall" style={{ width: len, height: WALL, marginTop: -WALL, transform: `${base} rotateX(-90deg)` }}>
              {DISTANCES[i] && <b>{DISTANCES[i]}</b>}
            </span>
            <span
              className="bp-stands"
              data-eye={eye || undefined}
              style={{ width: len, marginTop: -100, transform: `${base} translateZ(${WALL}px) rotateX(-76deg)`, backgroundPositionX: `${-i * 31}px` } as CSSProperties}
            />
          </Fragment>
        )
      })}
    </>
  )
}

function Tower({ t }: { t: number }) {
  const p = bez(t)
  // pushed out behind the stands
  const nx = p.x - 200
  const ny = p.y - 200
  const d = Math.hypot(nx, ny)
  const x = p.x + (nx / d) * 58
  const y = p.y + (ny / d) * 58
  return (
    <span className="bp-tower" style={{ transform: `translate3d(${k(x)}px, ${k(y)}px, 0) rotateX(-90deg)` }}>
      <span className="bp-tower__head">{Array.from({ length: 8 }, (_, i) => <i key={i} />)}</span>
      <span className="bp-tower__pole" />
    </span>
  )
}

function FieldArt() {
  const stripes = (n: number, w: number, rot: number) =>
    Array.from({ length: n }, (_, i) => <rect key={i} x={-200 + i * w * 2} y={-300} width={w} height={900} transform={`rotate(${rot} 200 200)`} />)
  return (
    <svg className="bp-art" viewBox="0 0 400 400" aria-hidden>
      <defs>
        <clipPath id="bp-fair"><path d={FAIR} /></clipPath>
        <clipPath id="bp-in"><path d="M200 314 L259 255 L200 196 L141 255 Z" /></clipPath>
        <radialGradient id="bp-skin" cx="200" cy="268" r="110" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--bp-dirt-hi)" />
          <stop offset="1" stopColor="var(--bp-dirt)" />
        </radialGradient>
        <radialGradient id="bp-mound" cx="198" cy="259" r="13" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--bp-dirt-hi)" />
          <stop offset="0.7" stopColor="var(--bp-dirt)" />
          <stop offset="1" stopColor="var(--bp-dirt-lo)" />
        </radialGradient>
        <linearGradient id="bp-depth" x1="0" y1="-80" x2="0" y2="360" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--bp-haze)" stopOpacity="0.32" />
          <stop offset="0.5" stopColor="var(--bp-haze)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect className="bp-foul" x="-400" y="-400" width="1200" height="1200" />
      <path className="bp-beyond" d={BEYOND} />
      <path className="bp-grass" d={FAIR} />
      <g clipPath="url(#bp-fair)">
        <g className="bp-mow">{stripes(16, 22, 45)}</g>
        <g className="bp-mow">{stripes(16, 22, -45)}</g>
        <path className="bp-track" d={FENCE} />
      </g>      <path d="M200 352 L96 252 Q200 112 304 252 Z" fill="url(#bp-skin)" />
      <path className="bp-infield" d="M200 314 L259 255 L200 196 L141 255 Z" />
      <g clipPath="url(#bp-in)" className="bp-mow bp-mow--in">{stripes(20, 8, 45)}</g>
      <circle cx={MOUND.x} cy={MOUND.y} r="12" fill="url(#bp-mound)" />
      <circle cx={HOME.x} cy={HOME.y + 2} r="18" fill="url(#bp-skin)" />      <g className="bp-chalk">
        <path d={`M${HOME.x} ${HOME.y} L${P0.x} ${P0.y} M${HOME.x} ${HOME.y} L${P2.x} ${P2.y}`} />
        <rect x="186" y="323" width="8" height="15" />
        <rect x="206" y="323" width="8" height="15" />
        <path d="M193 338 L193 348 L207 348 L207 338" />
        <path d="M241 293 L274 260" />
        <rect x="286" y="272" width="14" height="6" transform="rotate(45 293 275)" />
        <rect x="100" y="272" width="14" height="6" transform="rotate(-45 107 275)" />
      </g>
      <rect className="bp-rubber" x={MOUND.x - 4} y={MOUND.y - 1} width="8" height="2" rx="1" />
      {[FIRST, SECOND, THIRD].map((b, i) => (
        <rect key={i} className="bp-base" x={b.x - 4.5} y={b.y - 4.5} width="9" height="9" rx="1.2" transform={`rotate(45 ${b.x} ${b.y})`} />
      ))}
      <path className="bp-base" d={`M${HOME.x - 5} ${HOME.y - 4} h10 v4 l-5 5 l-5 -5 Z`} />
      <path className="bp-fence" d={FENCE} />
      <rect x="-400" y="-400" width="1200" height="1200" fill="url(#bp-depth)" />
    </svg>
  )
}

function Runner({ n, name, base, ms, scored }: { n: string; name: string; base: number; ms: number; scored?: boolean }) {
  return (
    <span className="bp-runner" style={runnerStyle(base, ms, K)} data-scored={scored || undefined} data-moving={undefined}>
      <span className="bp-shadow" />
      <span className="bp-stand">
        <span className="bp-runner__chip">{n}</span>
        <span className="bp-runner__name">{name}</span>
      </span>
    </span>
  )
}

function Fielder({ f, moved }: { f: (typeof FIELDERS)[number]; moved: boolean }) {
  const [x, y] = moved && f.to ? f.to : f.at
  return (
    <span
      className="bp-fielder"
      data-id={f.id}
      style={{ transform: `translate3d(${k(x)}px, ${k(y)}px, 0)`, transitionDuration: `${moved ? f.ms ?? 800 : 1000}ms` }}
    >
      <span className="bp-shadow bp-shadow--small" />
      <span className="bp-stand"><span className="bp-fielder__chip" /></span>
    </span>
  )
}

export function Bug({ s }: { s: S }) {
  return (
    <header className="tv-bug">
      <div className="tv-teams">
        <span className="tv-team" data-bat>
          <i className="tv-team__stripe" />
          <span className="tv-team__name">MUS</span>
          <span className="tv-team__runs"><Count value={s.us} duration={650} /></span>
        </span>
        <span className="tv-team">
          <i className="tv-team__stripe tv-team__stripe--away" />
          <span className="tv-team__name">HAW</span>
          <span className="tv-team__runs">1</span>
        </span>
      </div>
      <div className="tv-diamond">
        <Bases on={[s.liam === 1, s.maya === 2, false]} className="tv-bases" />
        <span className="tv-row">
          <span className="tv-label">Out</span>
          <Dots kind="out" lit={s.outs} of={2} />
        </span>
      </div>
      <div className="tv-count">
        <span className="tv-inning">
          <svg width="9" height="8" viewBox="0 0 9 8" aria-hidden><path d="M4.5 0 9 8H0Z" fill="currentColor" /></svg>
          Top 4
        </span>
        <span className="tv-row">
          <span className="tv-label">Ball</span>
          <Dots kind="ball" lit={s.balls} of={3} />
        </span>
        <span className="tv-row">
          <span className="tv-label">Strike</span>
          <Dots kind="strike" lit={s.strikes} of={2} />
        </span>
      </div>
    </header>
  )
}

const Tick = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
    <path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

function TapButton({ kind }: { kind: 'ball' | 'strike' }) {
  return (
    <span className="fd-tap" data-target={kind}>
      <span className="fd-tap__btn"><i className={`fd-dot fd-dot--${kind}`} /></span>
      {kind === 'ball' ? 'Ball' : 'Strike'}
    </span>
  )
}

export function Scene({ s, variant }: { s: S; variant: Variant }) {
  const moved = s.phase === 'hit' || s.phase === 'throw'
  const tracking = variant === 'cam'
  return (
    <div className="fd-app bp-app" data-variant={variant}>
      <div className="bp-sky" />
      <div className="bp-cam" data-cam={tracking ? s.cam : 'wide'}>
        <div className="bp-stadium">
          <div className="bp-plane" data-phase={s.phase}>
            <FieldArt />
            {variant === 'golden' && <span className="bp-dusk" />}
            <span className="bp-groundline bp-groundline--hit"><svg viewBox="0 0 400 400"><path d={HIT} pathLength={1} /></svg></span>
            {tracking && <span className="bp-groundline bp-groundline--throw"><svg viewBox="0 0 400 400"><path d={THROW} pathLength={1} /></svg></span>}
            <Wall />
            <Tower t={0.2} />
            <Tower t={0.8} />
            {tracking && (
              <span className="bp-arc" style={{ width: k(HIT_LEN), transform: `translate3d(${k(200)}px, ${k(322)}px, 0) rotateZ(${HIT_ANGLE}deg) rotateX(-90deg)` }}>
                <svg width={k(HIT_LEN)} height="90" viewBox={`0 0 ${k(HIT_LEN)} 90`} overflow="visible">
                  <path d={`M0 86 Q${k(HIT_LEN) * 0.44} ${90 - 128} ${k(HIT_LEN)} 90`} pathLength={1} />
                </svg>
              </span>
            )}
            {tracking && (
              <span className="bp-landing" style={{ transform: `translate3d(${k(LAND.x)}px, ${k(LAND.y)}px, 0)` }}>
                <i />
                <span className="bp-stand"><span className="bp-tag">Left field</span></span>
              </span>
            )}
            {FIELDERS.map((f) => <Fielder key={f.id} f={f} moved={moved} />)}
            <span className="bp-ball bp-ball--hit" style={{ offsetPath: `path('${scaled(HIT)}')` }}>
              <span className="bp-ball__shadow" />
              <span className="bp-ball__lift"><span className="bp-ball__body" /></span>
            </span>
            <span className="bp-ball bp-ball--throw" style={{ offsetPath: `path('${scaled(THROW)}')` }}>
              <span className="bp-ball__shadow" />
              <span className="bp-ball__lift"><span className="bp-ball__body" /></span>
            </span>
            <span className="bp-burst" style={{ transform: `translate3d(${k(HOME.x)}px, ${k(HOME.y)}px, 0)` }} data-on={s.maya === 4 || undefined} />
            <Runner n="12" name="Maya" base={s.maya} ms={s.maya === 4 ? 1700 : 1300} scored={s.maya === 4} />
            <Runner n="7" name="Liam" base={s.liam} ms={1100} />
          </div>
        </div>
      </div>
      <div className="bp-vignette" />
      <Bug s={s} />

      <div className="fd-sheet" />
      <div className="fd-caption">
        <States
          value={s.cap}
          states={{
            hint: <span className="fd-hint">Tap, then say the play</span>,
            talk: <Stream className="fd-said" text={`“${SAID}”`} count={s.heard} />,
            result: (
              <span className="fd-saved">
                <span className="fd-saved__tick"><Tick /></span>
                <span className="fd-saved__text">
                  <span className="fd-saved__title">Single to left</span>
                  <span className="fd-saved__sub">Maya scores · Liam on 1st</span>
                </span>
                <span className="fd-undo" data-target="undo">Undo</span>
              </span>
            ),
            undone: (
              <span className="fd-saved fd-saved--undone">
                <span className="fd-saved__text">
                  <span className="fd-saved__title">Play undone</span>
                  <span className="fd-saved__sub">Back to 2–2, Maya on 2nd</span>
                </span>
              </span>
            ),
          }}
        />
      </div>
      <div className="fd-controls">
        <TapButton kind="ball" />
        <div className="fd-micwrap">
          <span className="fd-ring" data-on={s.mic === 'listening' || undefined} />
          <span className="fd-ring fd-ring--late" data-on={s.mic === 'listening' || undefined} />
          <span className="fd-mic" data-target="mic" data-mic={s.mic}>
            <States value={s.mic} states={{ idle: <Mic size={34} />, listening: <Waves on={s.mic === 'listening'} /> }} />
          </span>
        </div>
        <TapButton kind="strike" />
      </div>
      <span className="fd-status">
        <Tick />
        <Roll>{`Last: ${s.last} · All plays saved`}</Roll>
      </span>
      <div className="fdx-fade" data-on={s.fade || undefined} />
    </div>
  )
}
