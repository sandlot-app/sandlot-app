import type { ReactNode } from 'react'
import { Count, Phone, Roll, Stage, States, Swap, type Act } from '../../kit'
import { FieldLayer, Tick } from '../sandlot-youth/youth'
import { Dots } from '../sandlot-fieldday/scene'
import { Bases } from '../sandlot-shared/field'
import { ICONS, type IconName } from './icons'
import './gd.css'

// "During the game": the scorer's side tools, on the approved Big buttons
// scorer. Every screen here is the same phone: the Rec field behind, the TV
// score bug on top, and a bottom sheet of big tiles. What differs is what the
// sheet is doing. This module holds the parts they share.

export { Tick }
export type { Act }

export const REST = { wide: { x: 330, y: 470 }, compact: { x: 290, y: 470 } }

// ---- Icons: icons.download, bold solid round ----
export function Ico({ name, size = 20, spin }: { name: IconName; size?: number; spin?: boolean }) {
  return (
    <svg className={spin ? 'gd-ico gd-spin' : 'gd-ico'} width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {ICONS[name].map((d, i) => <path key={i} d={d} fill="currentColor" fillRule="evenodd" clipRule="evenodd" />)}
    </svg>
  )
}

// ---- The stage: Phone 340 (326 compact), the app inside it ----
export function Shell<T extends { fade: boolean }>({ initial, poster, script, rest = REST, children }: { initial: T; poster: T; script: (a: Act<T>) => Promise<void>; rest?: typeof REST; children: (s: T) => ReactNode }) {
  return (
    <Stage<T>
      width={440}
      height={700}
      compact={{ below: 440, width: 358, height: 690 }}
      initial={initial}
      poster={poster}
      script={script}
      cursor={{ at: rest, style: 'touch' }}
      className="fd tv bp yf gd"
    >
      {(s, _rect, layout) => (
        <>
          <div className="fd-wash" />
          <Phone width={layout === 'compact' ? 326 : 340} className="fd-phone">
            <div className="fd-app bp-app gd-app" data-variant="rec">
              {children(s)}
              <div className="fdx-fade" data-on={s.fade || undefined} />
            </div>
          </Phone>
        </>
      )}
    </Stage>
  )
}

// ---- The field: Maya has scored, so only who is on the bases shows ----
export function Field({ liam, extra }: { liam: number; extra?: ReactNode }) {
  return <FieldLayer s={{ phase: 'set', liam, maya: 2 }} variant="rec" extra={extra} />
}

// ---- The score bug, with the bases and the count as props ----
export type BugState = { bases: [boolean, boolean, boolean]; us: number; them: number; outs: number; balls: number; strikes: number; inning: string }

export function GBug({ s }: { s: BugState }) {
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
          <span className="tv-team__runs">{s.them}</span>
        </span>
      </div>
      <div className="tv-diamond">
        <Bases on={s.bases} className="tv-bases" />
        <span className="tv-row">
          <span className="tv-label">Out</span>
          <Dots kind="out" lit={s.outs} of={2} />
        </span>
      </div>
      <div className="tv-count">
        <span className="tv-inning">
          <svg width="9" height="8" viewBox="0 0 9 8" aria-hidden><path d="M4.5 0 9 8H0Z" fill="currentColor" /></svg>
          {s.inning}
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

// ---- A status pill hanging under the bug ----
export type PillTone = 'ok' | 'warn' | 'busy' | 'dark'

export function Pill({ id, tone, icon, hide, children }: { id: string; tone: PillTone; icon?: ReactNode; hide?: boolean; children: ReactNode }) {
  return (
    <span className="gd-pill" data-tone={tone} data-hide={hide || undefined}>
      <Swap id={id} duration={420}>
        <span className="gd-pill__in">
          {icon}
          {children}
        </span>
      </Swap>
    </span>
  )
}

// ---- The scorer's bottom sheet: the same one on every screen ----
export function Tiles() {
  return (
    <div className="gd-grid gd-grid--2">
      <span className="gd-tile" data-target="ball"><i className="gd-dot gd-dot--ball" />Ball</span>
      <span className="gd-tile" data-target="strike"><i className="gd-dot gd-dot--strike" />Strike</span>
      <span className="gd-tile" data-target="foul"><i className="gd-dot gd-dot--foul" />Foul</span>
      <span className="gd-tile gd-tile--go" data-target="inplay">In play</span>
    </div>
  )
}

export function Result({ title, sub, undo = true }: { title: string; sub: string; undo?: boolean }) {
  return (
    <span className="gd-result">
      <span className="gd-result__tick"><Tick /></span>
      <span className="gd-result__text">
        <span className="gd-result__title">{title}</span>
        <span className="gd-result__sub">{sub}</span>
      </span>
      {undo && <span className="gd-undo" data-target="undo">Undo</span>}
    </span>
  )
}

export function MoreButton() {
  return (
    <span className="gd-morebtn" data-target="more">
      <Ico name="more-horizontal" size={22} />
      More
    </span>
  )
}

/** The big tiles sheet. `mode` picks between the question line and a saved card. */
export function Base({ mode = 'ask', ask, more, result, status }: { mode?: 'ask' | 'result'; ask: ReactNode; more?: boolean; result?: ReactNode; status: string }) {
  return (
    <>
      <div className="gd-sheet" />
      <div className="gd-top">
        <States
          value={mode}
          states={{
            ask: <div className="gd-askrow" data-more={more || undefined}>{ask}{more && <MoreButton />}</div>,
            result: <>{result ?? <span />}</>,
          }}
        />
      </div>
      <div className="gd-deck"><Tiles /></div>
      <span className="gd-status">
        <Tick />
        <Roll>{status}</Roll>
      </span>
    </>
  )
}

export function Ask({ who, count }: { who: string; count: string }) {
  return (
    <span className="gd-ask">
      {who} batting
      <span className="gd-crumb"><Roll>{count}</Roll></span>
    </span>
  )
}

/** The end of every loop: a short fade, then the first frame again */
export async function loopEnd<T extends { fade: boolean }>(a: Act<T>, start: T) {
  a.set({ fade: true } as Partial<T>)
  await a.wait(450)
  await a.snap({ ...start, fade: true })
  await a.wait(80)
  a.set({ fade: false } as Partial<T>)
  await a.move(REST)
}
