import type { CSSProperties } from 'react'

// One field geometry for all three Sandlot concepts, in a 400 × 400 box.
// Home plate sits low and centered; the bases are a square turned 45°.
export const HOME = { x: 200, y: 330 }
export const FIRST = { x: 275, y: 255 }
export const SECOND = { x: 200, y: 180 }
export const THIRD = { x: 125, y: 255 }
export const MOUND = { x: 200, y: 262 }
export const BASES = [HOME, FIRST, SECOND, THIRD]

// Runners travel the base path with CSS offset-path, so a runner sent from
// first to third goes round second instead of cutting across the infield.
// Each base is a quarter of the loop.
export const BASE_PATH = `M${HOME.x} ${HOME.y} L${FIRST.x} ${FIRST.y} L${SECOND.x} ${SECOND.y} L${THIRD.x} ${THIRD.y} Z`

// k scales the 400 box to the size the field is drawn at, so nothing is
// scaled up as a layer (a scaled 3D layer rasterizes soft)
export const scalePath = (d: string, k: number) => d.replace(/-?\d+(\.\d+)?/g, (n) => String(+(+n * k).toFixed(2)))

export const runnerStyle = (base: number, ms: number, k = 1): CSSProperties => ({
  offsetPath: `path('${scalePath(BASE_PATH, k)}')`,
  offsetDistance: `${base * 25}%`,
  offsetRotate: '0deg',
  transition: `offset-distance ${ms}ms cubic-bezier(0.45, 0.05, 0.3, 1)`,
})

// Grass, dirt and chalk, drawn once; each concept colors it with CSS
export function FieldArt({ className = '' }: { className?: string }) {
  return (
    <svg className={`sl-field ${className}`} viewBox="0 0 400 400" aria-hidden>
      <defs>
        <clipPath id="sl-outfield">
          <path d="M200 352 L-20 132 Q200 -70 420 132 Z" />
        </clipPath>
      </defs>
      <path className="sl-field__foul" d="M-400 132 L-20 132 Q200 -70 420 132 L800 132 L800 900 L-400 900 Z" />
      <path className="sl-field__grass" d="M200 352 L-20 132 Q200 -70 420 132 Z" />
      <g clipPath="url(#sl-outfield)" className="sl-field__stripes">
        {Array.from({ length: 12 }, (_, i) => (
          <rect key={i} x={-40 + i * 44} y={-60} width={22} height={460} transform="rotate(45 200 200)" />
        ))}
      </g>
      <path className="sl-field__track" d="M200 352 L-20 132 Q200 -70 420 132 Z" />
      <path className="sl-field__dirt" d="M200 350 L96 252 Q200 112 304 252 Z" />
      <path className="sl-field__infield" d="M200 314 L259 255 L200 196 L141 255 Z" />
      <circle className="sl-field__dirt" cx={MOUND.x} cy={MOUND.y} r={11} />
      <circle className="sl-field__dirt" cx={HOME.x} cy={HOME.y + 2} r={17} />
      <path className="sl-field__chalk" d={`M${HOME.x} ${HOME.y} L-20 110 M${HOME.x} ${HOME.y} L420 110`} />
      <rect className="sl-field__rubber" x={MOUND.x - 4} y={MOUND.y - 1} width={8} height={2} rx={1} />
      {[FIRST, SECOND, THIRD].map((b, i) => (
        <rect key={i} className="sl-field__base" x={b.x - 5} y={b.y - 5} width={10} height={10} rx={1.5} transform={`rotate(45 ${b.x} ${b.y})`} />
      ))}
      <path className="sl-field__base" d={`M${HOME.x - 6} ${HOME.y - 4} h12 v5 l-6 5 l-6 -5 Z`} />
    </svg>
  )
}

// icons.download, mic, bold solid round
export function Mic({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
      <path d="M12.0003 1C9.79116 1 8.0003 2.79086 8.0003 5V12C8.0003 14.2091 9.79116 16 12.0003 16C14.2094 16 16.0003 14.2091 16.0003 12V5C16.0003 2.79086 14.2094 1 12.0003 1Z" fill="currentColor" />
      <path d="M4.75286 11C4.06309 11 3.50192 11.5602 3.50391 12.25C3.62398 16.4071 6.72885 19.8161 10.7503 20.4087V21.75C10.7503 22.4404 11.3099 23 12.0003 23C12.6907 23 13.2503 22.4404 13.2503 21.75V20.4087C17.2718 19.8161 20.3766 16.4071 20.4967 12.25C20.4987 11.5602 19.9375 11 19.2477 11C18.5594 11 17.998 11.5616 17.9952 12.25C17.9776 12.6799 17.9147 13.0981 17.8113 13.5C17.1452 16.0878 14.7961 18 12.0003 18C9.20454 18 6.85539 16.0878 6.18933 13.5C6.08589 13.0981 6.02304 12.6799 6.00542 12.25C6.0026 11.5616 5.44122 11 4.75286 11Z" fill="currentColor" />
    </svg>
  )
}

// A live voice level: bars that move only while listening
export function Waves({ on, bars = 5 }: { on: boolean; bars?: number }) {
  return (
    <span className="sl-waves" data-on={on || undefined} aria-hidden>
      {Array.from({ length: bars }, (_, i) => (
        <span key={i} style={{ animationDelay: `${(i * 137) % 500}ms` }} />
      ))}
    </span>
  )
}

export const words = (text: string) => text.split(' ').length

// The scoreboard's little diamond: which bases are taken, as today's app shows
export function Bases({ on, className = '' }: { on: [boolean, boolean, boolean]; className?: string }) {
  const at = [
    { x: 19, y: 12 },
    { x: 12, y: 5 },
    { x: 5, y: 12 },
  ]
  return (
    <svg className={`sl-bases ${className}`} width="24" height="18" viewBox="0 0 24 18" aria-hidden>
      {at.map((p, i) => (
        <rect key={i} x={p.x - 3.6} y={p.y - 3.6} width={7.2} height={7.2} rx={1.2} transform={`rotate(45 ${p.x} ${p.y})`} data-on={on[i] || undefined} />
      ))}
    </svg>
  )
}
