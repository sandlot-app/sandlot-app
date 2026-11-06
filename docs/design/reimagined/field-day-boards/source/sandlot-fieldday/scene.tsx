import type { ReactNode } from 'react'
import { Roll, Stream, States, type Act } from '../../kit'
import { FieldArt, Mic, Waves, runnerStyle, scalePath, words } from '../sandlot-shared/field'
import '../sandlot-field/field.css'
import './fieldday.css'

// Field Day, round two: the same field, mic and one-step fix, with three
// takes on the scoreboard. Every take runs one script so they compare
// beat for beat: a Ball, a Strike, the play said out loud, the board
// catching up, then Undo putting the board back.

export type Mic = 'idle' | 'listening'
export type Cap = 'hint' | 'talk' | 'result' | 'undone'
export type Ball = 'ready' | 'hit' | 'gone'
export type S = {
  mic: Mic
  cap: Cap
  heard: number
  ball: Ball
  liam: number
  maya: number
  us: number
  hits: number
  balls: number
  strikes: number
  outs: number
  last: string
  fade: boolean
}

export const SAID = 'Liam lines one to left, Maya scores'
export const START: S = { mic: 'idle', cap: 'hint', heard: 0, ball: 'ready', liam: 0, maya: 2, us: 2, hits: 4, balls: 1, strikes: 1, outs: 1, last: 'Strike', fade: false }
export const POSTER: S = { ...START, cap: 'result', heard: words(SAID), ball: 'hit', liam: 1, maya: 4, us: 3, hits: 5, balls: 0, strikes: 0, last: 'Single' }
const K = 1.4
const FLIGHT = scalePath('M200 322 L94 128', K)
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
  a.set({ mic: 'idle', ball: 'hit' })
  await a.wait(380)
  a.set({ liam: 1, maya: 4 })
  await a.wait(1750)
  // Maya crosses the plate: the run counts, the hit counts, the next batter starts at 0–0
  a.mark('saved')
  a.set({ us: 3, hits: 5, balls: 0, strikes: 0, last: 'Single', cap: 'result' })
  await a.wait(2900)
  a.mark('undo')
  await a.click('undo')
  a.set({ cap: 'undone', ball: 'gone', liam: 0, maya: 2, us: 2, hits: 4, balls: 2, strikes: 2, last: 'Strike' })
  await a.wait(1700)
  // A cut to the next take
  a.set({ fade: true })
  await a.wait(450)
  await a.snap({ ...START, fade: true })
  await a.wait(80)
  a.set({ fade: false })
  await a.move(REST)
}

function Runner({ n, name, base, ms, scored }: { n: string; name: string; base: number; ms: number; scored?: boolean }) {
  return (
    <span className="fd-runner" style={runnerStyle(base, ms, K)} data-scored={scored || undefined}>
      <span className="fd-runner__shadow" />
      <span className="fd-runner__stand">
        <span className="fd-runner__chip">{n}</span>
        <span className="fd-runner__name">{name}</span>
      </span>
    </span>
  )
}

const Tick = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
    <path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/** The default Ball and Strike buttons: a colored dot and a label */
export function TapButton({ kind }: { kind: 'ball' | 'strike' }) {
  return (
    <span className="fd-tap" data-target={kind}>
      <span className="fd-tap__btn"><i className={`fd-dot fd-dot--${kind}`} /></span>
      {kind === 'ball' ? 'Ball' : 'Strike'}
    </span>
  )
}

export function Scene({ s, board, ball, strike }: { s: S; board: ReactNode; ball?: ReactNode; strike?: ReactNode }) {
  return (
    <div className="fd-app">
      <div className="fd-sky" />
      {board}

      <div className="fd-stadium">
        <div className="fd-plane">
          <FieldArt className="fd-art" />
          <svg className="fd-track" viewBox="0 0 400 400" aria-hidden data-ball={s.ball}>
            <path d="M200 322 L94 128" pathLength={1} />
          </svg>
          <span className="fd-ball" data-ball={s.ball} style={{ offsetPath: `path('${FLIGHT}')` }}>
            <span className="fd-ball__shadow" />
            <span className="fd-ball__lift">
              <span className="fd-ball__body" />
            </span>
          </span>
          <span className="fd-burst" data-on={s.maya === 4 || undefined} />
          <Runner n="12" name="Maya" base={s.maya} ms={s.maya === 4 ? 1700 : 1300} scored={s.maya === 4} />
          <Runner n="7" name="Liam" base={s.liam} ms={1100} />
        </div>
      </div>

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
        {ball ?? <TapButton kind="ball" />}
        <div className="fd-micwrap">
          <span className="fd-ring" data-on={s.mic === 'listening' || undefined} />
          <span className="fd-ring fd-ring--late" data-on={s.mic === 'listening' || undefined} />
          <span className="fd-mic" data-target="mic" data-mic={s.mic}>
            <States value={s.mic} states={{ idle: <Mic size={34} />, listening: <Waves on={s.mic === 'listening'} /> }} />
          </span>
        </div>
        {strike ?? <TapButton kind="strike" />}
      </div>
      <span className="fd-status">
        <Tick />
        <Roll>{`Last: ${s.last} · All plays saved`}</Roll>
      </span>
      <div className="fdx-fade" data-on={s.fade || undefined} />
    </div>
  )
}

/** Lit dots for balls, strikes or outs */
export function Dots({ lit, of, kind }: { lit: number; of: number; kind: 'ball' | 'strike' | 'out' }) {
  return (
    <span className={`fdx-dots fdx-dots--${kind}`}>
      {Array.from({ length: of }, (_, i) => <i key={i} data-on={i < lit || undefined} />)}
    </span>
  )
}
