import type { ReactNode } from 'react'
import { Stage, Phone, type Act } from '../../kit'
import { PATHS as S3 } from '../sandlot-s3/s3-icons'
import { Tabs, Tick, Emblem, Wordmark } from '../sandlot-gt/gt'
import '../sandlot-ob/ob.css'
import './u3.css'

// Sandlot, less like Figma, group u3. Two screens that put baseball objects on
// the screen instead of app widgets:
//
//  Player:  Maya's baseball card. Front: the number, today's hits drawn on a
//           little Rec field, today's line. Tap: a real 3D flip to the back,
//           cream card stock with her season and three stamped games.
//  Team:    the Mustangs standing on the Rec field, seen from above, each kid
//           at their position, the bench in the dugout, a pennant with the
//           record. A white dot marks a kid whose parent hasn't joined.
//
// Same look as the approved screens: paper, orange chips with the dark name
// pill, Sandlot green, the real logo, icons.download.

export { Tabs, Tick, Emblem, Wordmark }

const SHARE: [string, number?][] = [['M22.2932 11.2929C22.6838 11.6834 22.6838 12.3166 22.2932 12.7071L14.7075 20.2929C14.0775 20.9229 13.0003 20.4767 13.0003 19.5858V16C8.84027 16 5.73573 16.8017 3.21353 18.6606C2.34637 19.2997 0.835845 18.5228 1.18803 17.5048C2.88164 12.6092 6.12584 8.00002 13.0003 8.00002L13.0003 4.41424C13.0003 3.52333 14.0775 3.07716 14.7075 3.70713L22.2932 11.2929Z']]

/** icons.download, bold solid round */
export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths = name === 'share' ? SHARE : S3[name]!
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {paths.map(([d, eo], i) => <path key={i} d={d} fill="currentColor" fillRule={eo ? 'evenodd' : undefined} />)}
    </svg>
  )
}

export function Shell<T extends object>({ initial, poster, script, rest, children }: { initial: T; poster: T; script: (a: Act<T>) => Promise<void>; rest: { x: number; y: number }; children: (s: T) => ReactNode }) {
  return (
    <Stage<T>
      width={440}
      height={820}
      compact={{ below: 440, width: 358, height: 690 }}
      initial={initial}
      poster={poster}
      script={script}
      cursor={{ at: { wide: rest, compact: { x: rest.x - 40, y: Math.min(rest.y, 600) } }, style: 'touch' }}
      className="fd tv bp yf ob gt u3"
    >
      {(s, _rect, layout) => (
        <>
          <div className="u3-wash" />
          <Phone width={layout === 'compact' ? 326 : 340} className="u3-phone">
            {children(s)}
          </Phone>
        </>
      )}
    </Stage>
  )
}

/** Fade out, snap back to the first frame while hidden, fade up again */
export const fadeOut = async <T extends { fade: boolean }>(a: Act<T>, start: T, rest: { x: number; y: number }) => {
  const fade = (on: boolean) => ({ fade: on }) as unknown as Partial<T>
  a.set(fade(true))
  await a.wait(450)
  await a.snap({ ...start, fade: true })
  await a.wait(80)
  await a.set(fade(false))
  await a.move(a.layout === 'compact' ? { x: rest.x - 40, y: Math.min(rest.y, 600) } : rest)
}

// ---------------------------------------------------------------------------
// The Rec field seen from above: the same pieces as the approved Rec field
// (grass worn in stripes, an all-dirt infield, chalk, a chain-link fence with
// a yellow cap and team banners, trees past it), laid flat.
// ---------------------------------------------------------------------------

type Pt = { x: number; y: number }
export type Geo = { W: number; H: number; hx: number; hy: number; s: number; P0: Pt; C: Pt; P2: Pt; first: Pt; second: Pt; third: Pt; mound: Pt }

/** A field in a W x H box: home plate at (W/2, homeY), bases s apart, the fence's far point at fenceTop */
export function makeGeo(W: number, H: number, homeY: number, fenceTop: number, s: number): Geo {
  const hx = W / 2
  const dx = hx - 8
  const y0 = homeY - dx
  const d = s / Math.SQRT2
  return {
    W, H, hx, hy: homeY, s,
    P0: { x: 8, y: y0 }, C: { x: hx, y: 2 * fenceTop - y0 }, P2: { x: W - 8, y: y0 },
    first: { x: hx + d, y: homeY - d }, third: { x: hx - d, y: homeY - d }, second: { x: hx, y: homeY - 2 * d },
    mound: { x: hx, y: homeY - 2 * d * 0.5 },
  }
}

const bez = (g: Geo, t: number): Pt => ({
  x: (1 - t) ** 2 * g.P0.x + 2 * (1 - t) * t * g.C.x + t * t * g.P2.x,
  y: (1 - t) ** 2 * g.P0.y + 2 * (1 - t) * t * g.C.y + t * t * g.P2.y,
})
const f = (n: number) => +n.toFixed(1)
const sub = (g: Geo, a: number, b: number) => {
  const pts = Array.from({ length: 7 }, (_, i) => bez(g, a + ((b - a) * i) / 6))
  return pts.map((p, i) => `${i ? 'L' : 'M'}${f(p.x)} ${f(p.y)}`).join(' ')
}
const BANNERS: [number, number, string][] = [[0.13, 0.21, '#ff7519'], [0.26, 0.34, '#0c4c39'], [0.39, 0.47, '#25447e'], [0.53, 0.61, '#ff7519'], [0.66, 0.74, '#0c4c39'], [0.79, 0.87, '#25447e']]

export function RecTop({ g, trees = true, id }: { g: Geo; trees?: boolean; id: string }) {
  const { W, H, hx, hy, s } = g
  const d = s / Math.SQRT2
  const e = s * 0.3
  const lp = { x: hx - d - e, y: hy - d - e }
  const rp = { x: hx + d + e, y: hy - d - e }
  const dirtTop = g.second.y - e * 0.9
  const dc = { x: hx, y: 2 * dirtTop - lp.y }
  const fence = `M${f(g.P0.x)} ${f(g.P0.y)} Q${f(g.C.x)} ${f(g.C.y)} ${f(g.P2.x)} ${f(g.P2.y)}`
  const fair = `M${hx} ${hy} L${f(g.P0.x)} ${f(g.P0.y)} Q${f(g.C.x)} ${f(g.C.y)} ${f(g.P2.x)} ${f(g.P2.y)} Z`
  const cx = hx
  const cy = hy - (hy - g.C.y) * 0.62
  const treeList = trees
    ? Array.from({ length: 30 }, (_, i) => {
        const back = i % 2 === 1
        const t = 0.02 + (i / 29) * 0.96 + (back ? 0.012 : 0)
        const p = bez(g, t)
        const nx = p.x - cx
        const ny = p.y - cy
        const n = Math.hypot(nx, ny) || 1
        const wob = ((i * 37) % 11) / 11
        const dist = (back ? 38 : 17) + wob * 8
        const r = (back ? 19 : 14) + wob * 6
        return { x: p.x + (nx / n) * dist, y: p.y + (ny / n) * dist, r, tone: i % 3 }
      })
    : []
  return (
    <svg className="u3-field" viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden>
      <defs>
        <clipPath id={`${id}-fair`}><path d={fair} /></clipPath>
        <radialGradient id={`${id}-skin`} cx={hx} cy={hy - s * 0.9} r={s * 1.5} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#dcaa79" />
          <stop offset="1" stopColor="#c8915f" />
        </radialGradient>
        {[0, 1, 2].map((i) => (
          <radialGradient key={i} id={`${id}-tree${i}`} cx="38%" cy="32%" r="75%">
            <stop offset="0" stopColor={['#5a9d4b', '#62a653', '#4a8b44'][i]} />
            <stop offset="0.6" stopColor={['#3f7f3a', '#468a3d', '#356f37'][i]} />
            <stop offset="1" stopColor={['#2f6a31', '#336f31', '#2a5e2e'][i]} />
          </radialGradient>
        ))}
      </defs>
      <rect x="0" y="0" width={W} height={H} fill="#4d9445" />
      <path d={fair} fill="#58a24d" />
      <g clipPath={`url(#${id}-fair)`}>
        {Array.from({ length: Math.ceil(H / 26) }, (_, i) => (i % 2 ? <rect key={i} x="0" y={i * 26} width={W} height="26" fill="rgba(255,255,255,0.06)" /> : null))}
        <path d={fence} fill="none" stroke="#c8915f" strokeWidth="15" opacity="0.92" />
      </g>
      <path d={`M${hx} ${hy} L${f(lp.x)} ${f(lp.y)} Q${f(dc.x)} ${f(dc.y)} ${f(rp.x)} ${f(rp.y)} Z`} fill={`url(#${id}-skin)`} />
      <circle cx={hx} cy={hy + 2} r={s * 0.27} fill={`url(#${id}-skin)`} />
      <circle cx={g.mound.x} cy={g.mound.y} r={s * 0.15} fill="#d3a070" />
      <g fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth="1.8">
        <path d={`M${hx} ${hy} L${f(g.P0.x)} ${f(g.P0.y)} M${hx} ${hy} L${f(g.P2.x)} ${f(g.P2.y)}`} />
      </g>
      <g fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.3">
        <rect x={hx - 14} y={hy - 9} width="8" height="16" />
        <rect x={hx + 6} y={hy - 9} width="8" height="16" />
      </g>
      <rect x={g.mound.x - 5} y={g.mound.y - 1} width="10" height="2.4" rx="1.2" fill="#fff" />
      {[g.first, g.second, g.third].map((b, i) => (
        <rect key={i} x={b.x - 5.5} y={b.y - 5.5} width="11" height="11" rx="1.4" fill="#fff" transform={`rotate(45 ${f(b.x)} ${f(b.y)})`} />
      ))}
      <path d={`M${hx - 6} ${hy - 5} h12 v5 l-6 6 l-6 -6 Z`} fill="#fff" />
      <path d={fence} fill="none" stroke="#d2dadc" strokeWidth="7.5" />
      {BANNERS.map(([a, b, c], i) => <path key={i} d={sub(g, a, b)} fill="none" stroke={c} strokeWidth="7.5" />)}
      <path d={fence} fill="none" stroke="#f4c430" strokeWidth="2.6" />
      {treeList.map((t, i) => (
        <g key={i}>
          <circle cx={f(t.x + 1.5)} cy={f(t.y + 2.5)} r={f(t.r)} fill="rgba(8,40,22,0.2)" />
          <circle cx={f(t.x)} cy={f(t.y)} r={f(t.r)} fill={`url(#${id}-tree${t.tone})`} />
        </g>
      ))}
    </svg>
  )
}
