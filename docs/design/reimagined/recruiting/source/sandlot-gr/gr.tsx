import type { CSSProperties, ReactNode } from 'react'
import { Stage, Phone, type Act } from '../../kit'
import { Emblem } from '../sandlot-ob/ob'
import { PATHS } from './gr-icons'
import photo from '../sandlot-stream/live-stream.jpg'
import '../sandlot-ob/ob.css'
import '../sandlot-fieldday/fieldday.css'
import './gr.css'

// Group gr: the recruiting screens. Same Sandlot look as the approved
// screens (paper, white cards, green and orange, the real logo); only the
// story is new. Plan rules these follow (docs/plan.md, Recruiting profile and
// milestone 16):
//
//  - Profiles are for players 13 and up. Maya is 10, so she has none.
//  - Stats scored in Sandlot are "verified" and kept apart from imported ones.
//  - A parent manages the profile, picks who can see it and shares a link.
//  - The profile shows no contact details; a scout's request goes to the parent.
//
// Nico (15, #8, center field, Moraga Mustangs 15U) is made up for the mockups.

export { Emblem, photo }

/** icons.download, bold solid round */
export function Icon({ name, size = 20 }: { name: keyof typeof PATHS; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {PATHS[name]!.map(([d, eo], i) => <path key={i} d={d} fill="currentColor" fillRule={eo ? 'evenodd' : undefined} />)}
    </svg>
  )
}

export function Shell<T extends object>({ initial, poster, script, rest, tag, children }: { initial: T; poster: T; script: (a: Act<T>) => Promise<void>; rest: { x: number; y: number }; tag: string; children: (s: T) => ReactNode }) {
  return (
    <Stage<T>
      width={440}
      height={820}
      compact={{ below: 440, width: 358, height: 690 }}
      initial={initial}
      poster={poster}
      script={script}
      cursor={{ at: { wide: rest, compact: { x: rest.x - 40, y: Math.min(rest.y, 600) } }, style: 'touch' }}
      className={`fd tv bp yf ob gr ${tag}`}
    >
      {(s, _rect, layout) => (
        <>
          <div className="ob-wash" />
          <Phone width={layout === 'compact' ? 326 : 340} className="ob-phone">
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

/** Rises into place `d` seconds after the screen's `in` flag turns on */
export function Rise({ on, d = 0, className, children }: { on: boolean; d?: number; className?: string; children: ReactNode }) {
  return (
    <div className={`gr-rise${className ? ` ${className}` : ''}`} data-in={on || undefined} style={{ '--d': `${d}s` } as CSSProperties}>
      {children}
    </div>
  )
}

/** The jersey number, orange: the player this profile is about */
export function Num({ n, size = 60 }: { n: string; size?: number }) {
  return (
    <span className="gr-num" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {n}
    </span>
  )
}

/** Who this is: number chip, name with the age beside it, position and team */
export function Who({ n, name, age, sub, size = 64, dark }: { n: string; name: string; age: number; sub: string; size?: number; dark?: boolean }) {
  return (
    <div className="gr-who" data-dark={dark || undefined}>
      <Num n={n} size={size} />
      <span className="gr-who__text">
        <span className="gr-who__name">
          {name}
          <span className="gr-age">Age {age}</span>
        </span>
        <span className="gr-who__sub">{sub}</span>
      </span>
    </div>
  )
}

/** Small green badge: stats scored in Sandlot */
export function Verified({ dark }: { dark?: boolean }) {
  return (
    <span className="gr-verified" data-dark={dark || undefined}>
      <Icon name="check-circle" size={15} />
      Verified · scored in Sandlot
    </span>
  )
}

/** The muted line for stats that came from another app: kept apart from the verified card */
export function Imported() {
  return (
    <div className="gr-import">
      <span className="gr-import__l">
        <Icon name="cloud-download" size={18} />
        <span className="gr-import__text">Imported from GameChanger</span>
      </span>
      <span className="gr-import__n">6 games</span>
    </div>
  )
}

/** Clips are a still photo of a real youth game standing in for video */
export const CLIPS = [
  { pos: '86% 46%', size: '330%', dur: '0:12' },
  { pos: '40% 40%', size: '230%', dur: '0:09' },
  { pos: '50% 62%', size: '300%', dur: '0:15' },
]

export function Clip({ i, now, tall }: { i: number; now?: boolean; tall?: boolean }) {
  const c = CLIPS[i]!
  return (
    <span className="gr-clip" data-now={now || undefined} data-tall={tall || undefined} style={{ backgroundImage: `url(${photo})`, backgroundPosition: c.pos, backgroundSize: c.size }}>
      <span className="gr-clip__play"><Icon name="play" size={12} /></span>
    </span>
  )
}

export const Switch = ({ on, target }: { on: boolean; target?: string }) => (
  <span className="gr-switch" data-on={on || undefined} data-target={target}><i /></span>
)

export const Spinner = () => <span className="ob-spin" aria-hidden />

/** The app's four tabs, as on Home, Team and Me */
export function Tabs({ on }: { on: 'home' | 'games' | 'team' | 'me' }) {
  const items: [string, keyof typeof PATHS, string][] = [['home', 'house', 'Home'], ['games', 'calendar', 'Games'], ['team', 'users', 'Team'], ['me', 'user', 'Me']]
  return (
    <div className="ob-tabs">
      {items.map(([k, icon, label]) => (
        <span key={k} className="ob-tab" data-on={on === k || undefined}>
          <Icon name={icon} size={22} />
          {label}
        </span>
      ))}
    </div>
  )
}
