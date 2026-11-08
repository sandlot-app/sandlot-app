import { Stage, Phone, Count, Roll, Stream, States, type Act } from '../../kit'
import { Bases, FieldArt, Mic, Waves, runnerStyle, scalePath, words } from '../sandlot-shared/field'
import './field.css'

// Sandlot, concept 1: "Field Day". The field is the whole app. A broadcast
// view of a sunny diamond fills the screen, one big mic sits under it, and
// the play you say happens on the grass: the ball flies, the runners go.
//
// Beats: tap the mic once (no hold), say the play, the words land under
// the field, the ball is lined to left, Maya comes round to score, the
// score rolls, and the play saves itself with one Undo beside it. Undo is
// the loop's reset: a seen cause, and the one-step fix the app promises.
//
// Built from today's scorer: the green scoreboard pill (score, little
// diamond, inning, count and outs) and the named player chips stay, made
// calmer; the four pitch buttons become one big mic with Ball and Strike as
// one-tap neighbors. Pitches are a tap, plays are said.
//
// Real strings: the two teams and scores, Top 4 and the count, the runners'
// names, the spoken line, the saved play, Undo, the hint, Ball and Strike.

type Mic = 'idle' | 'listening'
type Cap = 'hint' | 'talk' | 'result'
type Ball = 'ready' | 'hit' | 'gone'
type S = { mic: Mic; cap: Cap; heard: number; ball: Ball; liam: number; maya: number; us: number }

const SAID = 'Liam lines one to left, Maya scores'
const START: S = { mic: 'idle', cap: 'hint', heard: 0, ball: 'ready', liam: 0, maya: 2, us: 2 }
// The field is drawn 560 across; K maps the shared 400 box onto it
const K = 1.4
const FLIGHT = scalePath('M200 322 L94 128', K)
const REST = { wide: { x: 330, y: 560 }, compact: { x: 290, y: 560 } }

const script = async (a: Act<S>) => {
  await a.wait(800)
  a.mark('tap')
  await a.click('mic')
  a.set({ mic: 'listening', cap: 'talk' })
  for (let i = 0; i < words(SAID); i++) {
    await a.wait(i === 4 ? 420 : 210)
    a.put((s) => ({ heard: s.heard + 1 }))
  }
  await a.wait(520)
  // The mic stops by itself when the speaking ends; the play goes straight on
  a.mark('hit')
  a.set({ mic: 'idle', ball: 'hit' })
  await a.wait(380)
  a.set({ liam: 1, maya: 4 })
  await a.wait(1750)
  a.set({ us: 3 })
  await a.wait(350)
  a.mark('saved')
  a.set({ cap: 'result' })
  await a.wait(2600)
  a.mark('undo')
  await a.click('undo')
  a.set({ cap: 'hint', ball: 'gone', liam: 0, maya: 2, us: 2 })
  await a.wait(900)
  await a.snap({ ball: 'ready', heard: 0 })
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

export default function SandlotField() {
  return (
    <Stage<S>
      width={440}
      height={700}
      compact={{ below: 440, width: 358, height: 690 }}
      initial={START}
      poster={{ mic: 'idle', cap: 'result', heard: words(SAID), ball: 'hit', liam: 1, maya: 4, us: 3 }}
      script={script}
      cursor={{ at: REST, style: 'touch' }}
      className="fd"
    >
      {(s, _rect, layout) => (
        <>
          <div className="fd-wash" />
          <Phone width={layout === 'compact' ? 326 : 340} className="fd-phone">
            <div className="fd-app">
              <div className="fd-sky" />

              <header className="fd-board">
                <span className="fd-board__team">
                  MUS
                  <span className="fd-board__runs">
                    <Count value={s.us} duration={650} />
                  </span>
                </span>
                <span className="fd-board__mid">
                  <Bases on={[s.liam === 1, s.maya === 2, false]} />
                  <span className="fd-board__lines">
                    <span className="fd-board__inning">Top 4</span>
                    <span className="fd-board__count">{s.liam === 1 ? '0–0' : '1–1'} · 1 out</span>
                  </span>
                </span>
                <span className="fd-board__team fd-board__team--away">
                  <span className="fd-board__runs">1</span>
                  HAW
                </span>
              </header>

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
                        <span className="fd-saved__tick">
                          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden><path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </span>
                        <span className="fd-saved__text">
                          <span className="fd-saved__title">Single to left</span>
                          <span className="fd-saved__sub">Maya scores · Liam on 1st</span>
                        </span>
                        <span className="fd-undo" data-target="undo">Undo</span>
                      </span>
                    ),
                  }}
                />
              </div>

              <div className="fd-controls">
                <span className="fd-tap">
                  <span className="fd-tap__btn"><i className="fd-dot fd-dot--ball" /></span>
                  Ball
                </span>
                <div className="fd-micwrap">
                  <span className="fd-ring" data-on={s.mic === 'listening' || undefined} />
                  <span className="fd-ring fd-ring--late" data-on={s.mic === 'listening' || undefined} />
                  <span className="fd-mic" data-target="mic" data-mic={s.mic}>
                    <States value={s.mic} states={{ idle: <Mic size={34} />, listening: <Waves on={s.mic === 'listening'} /> }} />
                  </span>
                </div>
                <span className="fd-tap">
                  <span className="fd-tap__btn"><i className="fd-dot fd-dot--strike" /></span>
                  Strike
                </span>
              </div>
              <span className="fd-status">
                <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden><path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <Roll>{s.cap === 'result' ? 'Last: Single · All plays saved' : 'Last: Strike · All plays saved'}</Roll>
              </span>
            </div>
          </Phone>
        </>
      )}
    </Stage>
  )
}
