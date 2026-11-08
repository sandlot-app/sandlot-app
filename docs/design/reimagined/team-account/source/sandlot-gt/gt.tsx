import type { ReactNode } from 'react'
import { Stage, Phone, type Act } from '../../kit'
import { Emblem, Wordmark } from '../sandlot-ob/ob'
import { PATHS } from './gt-icons'
import './gt.css'

// Sandlot: team and account. Three screens in the Field Day direction, for
// the plan's "Accounts and teams" and "Privacy" sections:
//
//  Team:   the roster, who follows each kid, the people and their roles, and
//          the invite link a parent texts from the share sheet (no email).
//  Me:     the profile, notifications, what's private, and in-app removal of
//          a child or the account (a calm sheet, never a surprise).
//  Public: what someone sees opening a shared game link with no account:
//          jersey numbers and positions, never names.
//
// Player names show in the interface only (AGENTS.md, rule 5); a public
// viewer sees numbers.

export { Emblem, Wordmark }

/** icons.download, bold solid round: the one icon set on every screen */
export type IconName = keyof typeof PATHS
export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {PATHS[name]!.map(([d, eo], i) => <path key={i} d={d} fill="currentColor" fillRule={eo ? 'evenodd' : undefined} />)}
    </svg>
  )
}

// Apple's own mark, as its sign-in guidelines require
export const AppleMark = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path fill="currentColor" d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z" />
  </svg>
)

export const Tick = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
    <path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/** The shell every Sandlot screen sits in: a 340-wide phone on the paper wash */
export function Shell<T extends object>({ initial, poster, script, rest, children }: { initial: T; poster: T; script: (a: Act<T>) => Promise<void>; rest?: { x: number; y: number }; children: (s: T) => ReactNode }) {
  return (
    <Stage<T>
      width={440}
      height={820}
      compact={{ below: 440, width: 358, height: 690 }}
      initial={initial}
      poster={poster}
      script={script}
      cursor={rest ? { at: { wide: rest, compact: { x: rest.x - 40, y: Math.min(rest.y, 600) } }, style: 'touch' } : undefined}
      className="fd tv bp yf ob gt"
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

/** The four tabs, one selected */
export function Tabs({ on }: { on: 'home' | 'games' | 'team' | 'me' }) {
  const items: [string, string, string][] = [['home', 'house', 'Home'], ['games', 'calendar', 'Games'], ['team', 'users', 'Team'], ['me', 'user', 'Me']]
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

/** The jersey number, orange when it is the player you follow */
export function Num({ n, mine, size = 36 }: { n: string; mine?: boolean; size?: number }) {
  return (
    <span className="gt-num" data-mine={mine || undefined} style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {n}
    </span>
  )
}

export type RoleKind = 'Admin' | 'Scorekeeper' | 'Parent' | 'Fan'
export const Role = ({ kind }: { kind: RoleKind }) => <span className="gt-role" data-role={kind}>{kind}</span>
