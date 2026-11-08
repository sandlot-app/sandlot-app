import type { CSSProperties, ReactNode } from 'react'
import { Stage, Phone, type Act } from '../../kit'
import { Num, Tabs, Tick, AppleMark, Emblem } from '../sandlot-gt/gt'
import { PATHS } from './s3-icons'
import '../sandlot-ob/ob.css'
import './s3.css'

// Sandlot, simpler. Three screens rebuilt around one job each:
//
//  Start a game: the schedule and last game fill everything in; one big
//                button. (Replaces Game setup and Lineup.)
//  Me:           one player, one switch, one sentence about privacy, the account.
//  Team:         the roster as big chips and one Invite button; people and
//                roles sit behind a link. (Replaces Team.)
//
// Same look as the approved screens (paper, white cards, Sandlot green and
// orange, the real logo); only the amount on screen changes.

export { Num, Tabs, Tick, AppleMark, Emblem }

/** icons.download, bold solid round */
export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {PATHS[name]!.map(([d, eo], i) => <path key={i} d={d} fill="currentColor" fillRule={eo ? 'evenodd' : undefined} />)}
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
      className="fd tv bp yf ob gt s3"
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
    <div className={`s3-rise${className ? ` ${className}` : ''}`} data-in={on || undefined} style={{ '--d': `${d}s` } as CSSProperties}>
      {children}
    </div>
  )
}

export const Spinner = () => <span className="ob-spin" aria-hidden />

/** The Mustangs we use in every screen: number, first name */
export const MUSTANGS = [
  { id: 'maya', n: '12', name: 'Maya', pos: 'Shortstop' },
  { id: 'liam', n: '7', name: 'Liam', pos: 'Center field' },
  { id: 'ava', n: '3', name: 'Ava', pos: 'First base' },
  { id: 'ben', n: '15', name: 'Ben', pos: 'Second base' },
  { id: 'noah', n: '9', name: 'Noah', pos: 'Left field' },
  { id: 'jack', n: '22', name: 'Jack', pos: 'Third base' },
  { id: 'mia', n: '5', name: 'Mia', pos: 'Right field' },
  { id: 'leo', n: '18', name: 'Leo', pos: 'Catcher' },
  { id: 'zoe', n: '4', name: 'Zoe', pos: 'Pitcher' },
  { id: 'sam', n: '11', name: 'Sam', pos: '' },
  { id: 'ella', n: '6', name: 'Ella', pos: '' },
  { id: 'max', n: '20', name: 'Max', pos: '' },
]
