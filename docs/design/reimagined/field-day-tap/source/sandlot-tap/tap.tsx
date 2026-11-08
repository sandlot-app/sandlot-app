import type { ReactNode } from 'react'
import { Stage, Phone, Roll, States, type Act } from '../../kit'
import { FieldLayer, Bug, Tick, LAND, k, type S as YS } from '../sandlot-youth/youth'
import './tap.css'

// Field Day without the mic. The Rec field and the TV score bug stay as
// they are; only the bottom sheet changes. Three ways to score by tapping,
// each recording the same play as the voice demo (a Ball, a Strike, then
// "Liam singles to left, Maya scores") so they compare beat for beat:
//
//  A "field":    tap where the ball went, then pick what it was right there
//  B "tiles":    one question at a time, big tiles (In play, Single, Left)
//  C "sentence": build the sentence you would have said, one word chip at a time

export type Option = 'field' | 'tiles' | 'sentence'
export type T = YS & { step: string; pin: boolean }

export const TSTART: T = { mic: 'idle', cap: 'hint', heard: 0, phase: 'set', cam: 'wide', liam: 0, maya: 2, us: 2, balls: 1, strikes: 1, outs: 1, last: 'Strike', fade: false, step: 'pitch', pin: false }
const SAVED: Partial<T> = { us: 3, balls: 0, strikes: 0, last: 'Single', cap: 'result', step: 'pitch', pin: false }
export const TPOSTER: T = { ...TSTART, ...SAVED, phase: 'throw', liam: 1, maya: 4 } as T
const REST = { wide: { x: 330, y: 470 }, compact: { x: 290, y: 470 } }

// The play itself, the same for every option once it is recorded
async function play(a: Act<T>) {
  a.mark('hit')
  a.set({ phase: 'hit', pin: false })
  await a.wait(380)
  a.set({ liam: 1, maya: 4 })
  await a.wait(1070)
  a.mark('throw')
  a.set({ phase: 'throw' })
  await a.wait(680)
  a.mark('saved')
  a.set(SAVED)
  await a.wait(2900)
  a.mark('undo')
  await a.click('undo')
  a.set({ cap: 'undone', phase: 'reset', liam: 0, maya: 2, us: 2, balls: 2, strikes: 2, last: 'Strike' })
  await a.wait(1700)
  a.set({ fade: true })
  await a.wait(450)
  await a.snap({ ...TSTART, fade: true })
  await a.wait(80)
  a.set({ fade: false })
  await a.move(REST)
}

async function pitches(a: Act<T>) {
  await a.wait(700)
  a.mark('ball')
  await a.click('ball')
  a.set({ balls: 2, last: 'Ball' })
  await a.wait(800)
  a.mark('strike')
  await a.click('strike')
  a.set({ strikes: 2, last: 'Strike' })
  await a.wait(900)
}

const SCRIPTS: Record<Option, (a: Act<T>) => Promise<void>> = {
  field: async (a) => {
    await pitches(a)
    a.mark('where')
    await a.click('spot')
    a.set({ pin: true, step: 'what' })
    await a.wait(900)
    await a.click('pick')
    a.set({ step: 'done' })
    await a.wait(250)
    await play(a)
  },
  tiles: async (a) => {
    await pitches(a)
    await a.click('inplay')
    a.set({ step: 'what' })
    await a.wait(800)
    await a.click('single')
    a.set({ step: 'where' })
    await a.wait(800)
    await a.click('left')
    a.set({ step: 'pitch', pin: true })
    await a.wait(150)
    await play(a)
  },
  sentence: async (a) => {
    await pitches(a)
    await a.click('singles')
    a.set({ step: 'where' })
    await a.wait(800)
    await a.click('toleft')
    a.set({ step: 'runners' })
    await a.wait(1000)
    await a.click('save')
    a.set({ step: 'pitch' })
    await a.wait(150)
    await play(a)
  },
}

function Result({ s }: { s: T }) {
  return s.cap === 'undone' ? (
    <span className="tp-result tp-result--undone">
      <span className="tp-result__text">
        <span className="tp-result__title">Play undone</span>
        <span className="tp-result__sub">Back to 2–2, Maya on 2nd</span>
      </span>
    </span>
  ) : (
    <span className="tp-result">
      <span className="tp-result__tick"><Tick /></span>
      <span className="tp-result__text">
        <span className="tp-result__title">Single to left</span>
        <span className="tp-result__sub">Maya scores · Liam on 1st</span>
      </span>
      <span className="tp-undo" data-target="undo">Undo</span>
    </span>
  )
}

const shown = (s: T) => s.cap === 'result' || s.cap === 'undone'

function Pitch({ kind, label }: { kind: 'ball' | 'strike' | 'foul'; label: string }) {
  return (
    <span className="tp-pitch" data-target={kind}>
      <span className="tp-pitch__btn"><i className={`tp-dot tp-dot--${kind}`} /></span>
      {label}
    </span>
  )
}

// ---- A: tap the field ----
function SheetField({ s }: { s: T }) {
  return (
    <>
      <div className="tp-top">
        <States
          value={shown(s) ? 'result' : s.step === 'pitch' ? 'hint' : 'where'}
          states={{
            hint: <span className="tp-hint">Ball in play? Tap where it went.</span>,
            where: <span className="tp-hint tp-hint--on">Left field · what happened?</span>,
            result: <Result s={s} />,
          }}
        />
      </div>
      <div className="tp-row">
        <Pitch kind="ball" label="Ball" />
        <Pitch kind="strike" label="Strike" />
        <Pitch kind="foul" label="Foul" />
      </div>
    </>
  )
}

function FieldExtras({ s }: { s: T }) {
  return (
    <>
      <span className="tp-spot" data-target="spot" style={{ transform: `translate3d(${k(LAND.x)}px, ${k(LAND.y)}px, 0)` }} />
      <span className="tp-pin" data-on={s.pin || undefined} style={{ transform: `translate3d(${k(LAND.x)}px, ${k(LAND.y)}px, 0)` }}>
        <i className="tp-pin__ring" />
        <span className="bp-stand"><span className="tp-pin__head" /></span>
      </span>
    </>
  )
}

function FieldPopover({ s }: { s: T }) {
  return (
    <div className="tp-pop" data-on={s.step === 'what' || undefined}>
      <span className="tp-pop__chip tp-pop__chip--main" data-target="pick">Single</span>
      <span className="tp-pop__chip">Double</span>
      <span className="tp-pop__chip">Out</span>
      <span className="tp-pop__chip tp-pop__chip--more">More</span>
    </div>
  )
}

// ---- B: big tiles, one question at a time ----
function SheetTiles({ s }: { s: T }) {
  const step = shown(s) ? 'pitch' : s.step
  return (
    <>
      <div className="tp-top tp-top--slim">
        <States
          value={shown(s) ? 'result' : step}
          states={{
            pitch: <span className="tp-ask">Liam batting · <Roll>{`${s.balls}–${s.strikes}`}</Roll></span>,
            what: <span className="tp-ask"><span className="tp-crumb">In play</span> What happened?</span>,
            where: <span className="tp-ask"><span className="tp-crumb">Single</span> Where did it go?</span>,
            result: <Result s={s} />,
          }}
        />
      </div>
      <div className="tp-deck">
        <States
          value={step}
          states={{
            pitch: (
              <div className="tp-grid tp-grid--2">
                <span className="tp-tile" data-target="ball"><i className="tp-dot tp-dot--ball" />Ball</span>
                <span className="tp-tile" data-target="strike"><i className="tp-dot tp-dot--strike" />Strike</span>
                <span className="tp-tile"><i className="tp-dot tp-dot--foul" />Foul</span>
                <span className="tp-tile tp-tile--go" data-target="inplay">In play</span>
              </div>
            ),
            what: (
              <div className="tp-grid tp-grid--3">
                <span className="tp-tile tp-tile--hit" data-target="single">Single</span>
                <span className="tp-tile tp-tile--hit">Double</span>
                <span className="tp-tile tp-tile--hit">Triple</span>
                <span className="tp-tile tp-tile--hit">Home run</span>
                <span className="tp-tile">Out</span>
                <span className="tp-tile">Error</span>
              </div>
            ),
            where: (
              <div className="tp-grid tp-grid--where">
                {(['Left', 'Center', 'Right'] as const).map((w, i) => (
                  <span key={w} className="tp-tile tp-tile--where" data-target={w === 'Left' ? 'left' : undefined}>
                    <svg width="44" height="34" viewBox="0 0 44 34" aria-hidden>
                      <path d="M22 32 L2 12 Q22 -6 42 12 Z" className="tp-wedge" />
                      <path d={['M22 32 L2 12 Q8 6 15 3 Z', 'M22 32 L15 3 Q22 1 29 3 Z', 'M22 32 L29 3 Q36 6 42 12 Z'][i]} className="tp-wedge tp-wedge--on" />
                    </svg>
                    {w}
                  </span>
                ))}
              </div>
            ),
          }}
        />
      </div>
    </>
  )
}

// ---- C: tap the sentence ----
function SheetSentence({ s }: { s: T }) {
  const done = shown(s)
  const verb = done || s.step === 'where' || s.step === 'runners'
  const where = done || s.step === 'runners'
  return (
    <>
      <div className="tp-top">
        {done ? (
          <Result s={s} />
        ) : (
          <span className="tp-sentence">
            <span className="tp-word tp-word--who">Liam</span>
            <span className="tp-word" data-in={verb || undefined}>singles</span>
            <span className="tp-word" data-in={where || undefined}>to left</span>
            <span className="tp-word tp-word--run" data-in={where || undefined}>Maya scores</span>
            {!verb && <span className="tp-ghost">did what?</span>}
          </span>
        )}
      </div>
      <div className="tp-tray">
        <States
          value={done ? 'start' : s.step === 'pitch' ? 'start' : s.step}
          states={{
            start: (
              <div className="tp-chips">
                <span className="tp-chip tp-chip--ball" data-target="ball"><i className="tp-dot tp-dot--ball" />Ball</span>
                <span className="tp-chip tp-chip--strike" data-target="strike"><i className="tp-dot tp-dot--strike" />Strike</span>
                <span className="tp-chip"><i className="tp-dot tp-dot--foul" />Foul</span>
                <span className="tp-chip tp-chip--verb" data-target="singles">singles</span>
                <span className="tp-chip tp-chip--verb">doubles</span>
                <span className="tp-chip tp-chip--verb">grounds out</span>
                <span className="tp-chip tp-chip--verb">flies out</span>
                <span className="tp-chip tp-chip--verb">walks</span>
              </div>
            ),
            where: (
              <div className="tp-chips">
                <span className="tp-chip tp-chip--verb" data-target="toleft">to left</span>
                <span className="tp-chip tp-chip--verb">to center</span>
                <span className="tp-chip tp-chip--verb">to right</span>
                <span className="tp-chip">skip</span>
              </div>
            ),
            runners: (
              <div className="tp-chips tp-chips--save">
                <span className="tp-note">Maya scores from 2nd. Change it?</span>
                <span className="tp-chip">Maya stops at 3rd</span>
                <span className="tp-save" data-target="save">Save play</span>
              </div>
            ),
          }}
        />
      </div>
    </>
  )
}

const SHEETS: Record<Option, (p: { s: T }) => ReactNode> = { field: SheetField, tiles: SheetTiles, sentence: SheetSentence }

export function TapDemo({ option }: { option: Option }) {
  const Sheet = SHEETS[option]
  return (
    <Stage<T>
      width={440}
      height={700}
      compact={{ below: 440, width: 358, height: 690 }}
      initial={TSTART}
      poster={TPOSTER}
      script={SCRIPTS[option]}
      cursor={{ at: REST, style: 'touch' }}
      className="fd tv bp yf tp"
    >
      {(s, _rect, layout) => (
        <>
          <div className="fd-wash" />
          <Phone width={layout === 'compact' ? 326 : 340} className="fd-phone">
            <div className="fd-app bp-app" data-variant="rec" data-option={option}>
              <FieldLayer s={s} variant="rec" extra={option === 'field' ? <FieldExtras s={s} /> : undefined} />
              <Bug s={s} />
              {option === 'field' && <FieldPopover s={s} />}
              <div className="fd-sheet tp-sheet" />
              <Sheet s={s} />
              <span className="fd-status tp-status">
                <Tick />
                <Roll>{`Last: ${s.last} · All plays saved`}</Roll>
              </span>
              <div className="fdx-fade" data-on={s.fade || undefined} />
            </div>
          </Phone>
        </>
      )}
    </Stage>
  )
}
