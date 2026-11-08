import type { ReactNode } from 'react'
import { Count, Roll, Stream, States, type Act } from '../../kit'
import { Bases, Mic, Waves, runnerStyle, words } from '../sandlot-shared/field'
import { Dots } from '../sandlot-fieldday/scene'
import '../sandlot-field/field.css'
import '../sandlot-fieldday/fieldday.css'
import '../sandlot-board-tv/tv.css'
import '../sandlot-ballpark/ballpark.css'
import './youth.css'

// Field Day, round four: a youth field, not a stadium. The TV score bug
// stays; the field is the kind a Saturday game is played on: a chain-link
// fence with a yellow cap, trees past the outfield, aluminum bleachers down
// the lines, grass worn where the kids stand. The Hawks play the hit: the
// left fielder runs the ball down and throws to second as the run scores.
//
// Three takes share this scene: "league" (grass infield, chain-link),
// "rec" (an all-dirt infield, team banners on the fence), "park" (no fence,
// an orange temporary fence and the park beyond).

export type Variant = 'league' | 'rec' | 'park'
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
export const k = (n: number) => +(n * K).toFixed(2)
const HOME = { x: 200, y: 330 }
const FIRST = { x: 275, y: 255 }
const SECOND = { x: 200, y: 180 }
const THIRD = { x: 125, y: 255 }
const MOUND = { x: 200, y: 262 }

// The outfield fence: a curve from the left-field corner to the right-field
// corner, both on the foul lines (a youth field is about 200 feet out)
const P0 = { x: -10, y: 120 }
const PC = { x: 200, y: -80 }
const P2 = { x: 410, y: 120 }
const bez = (t: number) => ({
  x: (1 - t) ** 2 * P0.x + 2 * (1 - t) * t * PC.x + t * t * P2.x,
  y: (1 - t) ** 2 * P0.y + 2 * (1 - t) * t * PC.y + t * t * P2.y,
})
// A point pushed out from the fence by d, away from the middle of the field
const out = (t: number, d: number) => {
  const p = bez(t)
  const nx = p.x - 200
  const ny = p.y - 230
  const n = Math.hypot(nx, ny)
  return { x: p.x + (nx / n) * d, y: p.y + (ny / n) * d }
}
const FENCE = `M${P0.x} ${P0.y} Q${PC.x} ${PC.y} ${P2.x} ${P2.y}`
const FAIR = `M${HOME.x} ${HOME.y} L${P0.x} ${P0.y} Q${PC.x} ${PC.y} ${P2.x} ${P2.y} Z`

// The ball: lined to left, picked up by the left fielder, thrown to second
export const LAND = { x: 98, y: 150 }
const GLOVE = { x: 98, y: 146 }
const BAG = { x: 203, y: 184 }
const scaled = (d: string) => d.replace(/-?\d+(\.\d+)?/g, (n) => String(k(+n)))
const HIT = `M200 322 L${LAND.x} ${LAND.y}`
const THROW = `M${GLOVE.x} ${GLOVE.y} L${BAG.x} ${BAG.y}`

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

// Something standing up off the grass along a line from a to b, its face
// toward home; lean tips it back (90 is upright)
function standing(a: { x: number; y: number }, b: { x: number; y: number }, h: number, lean = 90, z = 0) {
  const len = Math.hypot(b.x - a.x, b.y - a.y) * K + 1
  const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
  return {
    width: len,
    height: h,
    marginTop: -h,
    transform: `translate3d(${k(a.x)}px, ${k(a.y)}px, ${z}px) rotateZ(${ang}deg) rotateX(${-lean}deg)`,
  }
}

const SEGS = 30
const BANNERS: Record<number, string> = { 6: 'navy', 7: 'navy', 10: 'orange', 11: 'orange', 14: 'green', 15: 'green', 18: 'orange', 19: 'orange', 22: 'navy', 23: 'navy' }

function Fence({ variant }: { variant: Variant }) {
  if (variant === 'park') {
    // An orange temporary fence staked out on the grass
    return (
      <>
        {Array.from({ length: SEGS }, (_, i) => (
          <span key={i} className="yf-temp" style={standing(bez(i / SEGS), bez((i + 1) / SEGS), 11)} />
        ))}
      </>
    )
  }
  return (
    <>
      {Array.from({ length: SEGS }, (_, i) => (
        <span key={i} className="yf-fence" style={standing(bez(i / SEGS), bez((i + 1) / SEGS), 20)}>
          {variant === 'rec' && BANNERS[i] && <i className="yf-banner" data-color={BANNERS[i]} />}
        </span>
      ))}
    </>
  )
}

// Trees past the outfield: two loose rows, no two quite alike
const TREES = Array.from({ length: 30 }, (_, i) => {
  const back = i % 2 === 1
  const t = 0.04 + (i / 29) * 0.92 + (back ? 0.015 : 0)
  const wobble = ((i * 37) % 11) / 11
  return { t, d: (back ? 46 : 22) + wobble * 10, size: (back ? 78 : 58) + wobble * 22, tone: i % 3 }
})

function Trees({ farther }: { farther: boolean }) {
  return (
    <>
      {TREES.map((tr, i) => {
        const p = out(tr.t, tr.d + (farther ? 34 : 0))
        return (
          <span key={i} className="yf-tree" data-tone={tr.tone} style={{ transform: `translate3d(${k(p.x)}px, ${k(p.y)}px, 0)` }}>
            <span className="yf-tree__art" style={{ width: tr.size, height: tr.size * 1.1, marginLeft: -tr.size / 2 }}>
              <i /><i /><i /><b />
            </span>
          </span>
        )
      })}
    </>
  )
}

// Aluminum bleachers down each line, a few parents in them
function Bleachers() {
  return (
    <>
      <span className="yf-bleach" style={standing({ x: 308, y: 276 }, { x: 336, y: 248 }, 26, 62)} />
      <span className="yf-bleach" style={standing({ x: 64, y: 248 }, { x: 92, y: 276 }, 26, 62)} />
    </>
  )
}

function FieldArt({ variant }: { variant: Variant }) {
  const skinned = variant === 'rec'
  return (
    <svg className="bp-art" viewBox="0 0 400 400" aria-hidden>
      <defs>
        <clipPath id={`yf-fair-${variant}`}><path d={FAIR} /></clipPath>
        <radialGradient id={`yf-skin-${variant}`} cx="200" cy="268" r="110" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--yf-dirt-hi)" />
          <stop offset="1" stopColor="var(--yf-dirt)" />
        </radialGradient>
        <radialGradient id={`yf-mound-${variant}`} cx="198" cy="259" r="13" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--yf-dirt-hi)" />
          <stop offset="1" stopColor="var(--yf-dirt)" />
        </radialGradient>
      </defs>
      <rect className="yf-ground" x="-400" y="-75" width="1200" height="900" />
      <path className="yf-grass" d={FAIR} />
      <g clipPath={`url(#yf-fair-${variant})`} className="yf-mow">
        {Array.from({ length: 12 }, (_, i) => <rect key={i} x="-100" y={-80 + i * 40} width="600" height="20" />)}
      </g>
      {/* Grass worn thin where the outfielders stand and the batters walk */}
      <g className="yf-worn">
        <ellipse cx="82" cy="104" rx="11" ry="8" />
        <ellipse cx="200" cy="66" rx="12" ry="8" />
        <ellipse cx="312" cy="104" rx="11" ry="8" />
        <ellipse cx="166" cy="200" rx="9" ry="6" />
        <ellipse cx="232" cy="200" rx="9" ry="6" />
      </g>
      {variant !== 'park' && <path className="yf-track" d={FENCE} clipPath={`url(#yf-fair-${variant})`} />}
      <path d="M200 352 L96 252 Q200 112 304 252 Z" fill={`url(#yf-skin-${variant})`} />
      {!skinned && <path className="yf-infield" d="M200 314 L259 255 L200 196 L141 255 Z" />}
      <circle cx={MOUND.x} cy={MOUND.y} r="11" fill={`url(#yf-mound-${variant})`} />
      <circle cx={HOME.x} cy={HOME.y + 2} r="17" fill={`url(#yf-skin-${variant})`} />
      <g className="yf-chalk">
        <path d={`M${HOME.x} ${HOME.y} L${P0.x} ${P0.y} M${HOME.x} ${HOME.y} L${P2.x} ${P2.y}`} />
        <rect x="186" y="323" width="8" height="15" />
        <rect x="206" y="323" width="8" height="15" />
        <rect x="286" y="272" width="14" height="6" transform="rotate(45 293 275)" />
        <rect x="100" y="272" width="14" height="6" transform="rotate(-45 107 275)" />
      </g>
      <rect className="yf-rubber" x={MOUND.x - 4} y={MOUND.y - 1} width="8" height="2" rx="1" />
      {[FIRST, SECOND, THIRD].map((b, i) => (
        <rect key={i} className="yf-base" x={b.x - 4.5} y={b.y - 4.5} width="9" height="9" rx="1.2" transform={`rotate(45 ${b.x} ${b.y})`} />
      ))}
      <path className="yf-base" d={`M${HOME.x - 5} ${HOME.y - 4} h10 v4 l-5 5 l-5 -5 Z`} />
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

export const Tick = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
    <path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export function TapButton({ kind }: { kind: 'ball' | 'strike' }) {
  return (
    <span className="fd-tap" data-target={kind}>
      <span className="fd-tap__btn"><i className={`fd-dot fd-dot--${kind}`} /></span>
      {kind === 'ball' ? 'Ball' : 'Strike'}
    </span>
  )
}

/** Sky, hills and the field with its players: everything above the sheet but the bug */
export function FieldLayer({ s, variant, extra }: { s: Pick<S, 'phase' | 'liam' | 'maya'>; variant: Variant; extra?: ReactNode }) {
  const moved = s.phase === 'hit' || s.phase === 'throw'
  return (
    <>
      <div className="bp-sky" />
      <div className="yf-hills" />
      <div className="bp-stadium">
        <div className="bp-plane" data-phase={s.phase}>
          <FieldArt variant={variant} />
          <span className="bp-groundline bp-groundline--hit"><svg viewBox="0 0 400 400"><path d={HIT} pathLength={1} /></svg></span>
          <Trees farther={variant === 'park'} />
          <Fence variant={variant} />
          {variant !== 'park' && <Bleachers />}
          {FIELDERS.map((f) => <Fielder key={f.id} f={f} moved={moved} />)}
          {extra}
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
    </>
  )
}

export function Scene({ s, variant }: { s: S; variant: Variant }) {
  return (
    <div className="fd-app bp-app" data-variant={variant}>
      <FieldLayer s={s} variant={variant} />
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
