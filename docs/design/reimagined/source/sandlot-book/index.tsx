import { Stage, Phone, Stream, States, type Act } from '../../kit'
import { Mic, Waves, words } from '../sandlot-shared/field'
import './book.css'

// Sandlot, concept 3: "The Book". The paper scorebook every parent already
// knows, alive. Each batter is one square with its printed diamond; you say
// the play and a pen inks it the way a scorekeeper would: the hit line out
// to right-center, the runner's path round to second, "2B" in the corner.
// The line score sits on top like the book's own header.
//
// Beats: tap the ink button once, say the play, the ball goes out along the
// hit line, the pen draws the path, the play is written, and the book moves
// on to the next batter. The loop resets with a page turn.
//
// Real strings: the line score, the batters' numbers and names, the inked
// marks, the spoken line, the saved play, the hint.

type Mic = 'idle' | 'listening'
type Cap = 'hint' | 'talk' | 'result'
type Ink = 'none' | 'ball' | 'path' | 'done'
type Page = 'rest' | 'out' | 'in'
type S = { mic: Mic; cap: Cap; heard: number; ink: Ink; at: number; page: Page }

const SAID = 'Liam doubles to right center'
const START: S = { mic: 'idle', cap: 'hint', heard: 0, ink: 'none', at: 1, page: 'rest' }
const REST = { wide: { x: 330, y: 600 }, compact: { x: 290, y: 600 } }

const PITCH = 264
const CARD = 250
const BATTERS = [
  { n: '9', name: 'Noah', mark: 'K' },
  { n: '7', name: 'Liam', mark: '' },
  { n: '3', name: 'Ava', mark: '' },
  { n: '15', name: 'Ben', mark: '' },
]

// The printed diamond inside a square, in its 250 × 230 box
const H = { x: 125, y: 196 }
const B1 = { x: 189, y: 132 }
const B2 = { x: 125, y: 68 }
const B3 = { x: 61, y: 132 }
const HIT = `M${H.x} ${H.y - 4} L214 30`
const RUN = `M${H.x} ${H.y} L${B1.x} ${B1.y} L${B2.x} ${B2.y}`

const script = async (a: Act<S>) => {
  await a.wait(600)
  a.mark('tap')
  await a.click('ink')
  a.set({ mic: 'listening', cap: 'talk' })
  for (let i = 0; i < words(SAID); i++) {
    await a.wait(i === 2 ? 360 : 230)
    a.put((s) => ({ heard: s.heard + 1 }))
  }
  await a.wait(500)
  a.mark('ink')
  a.set({ mic: 'idle', ink: 'ball' })
  await a.wait(850)
  a.set({ ink: 'path' })
  await a.wait(1700)
  a.mark('saved')
  a.set({ ink: 'done', cap: 'result' })
  await a.wait(2300)
  // On to the next batter, the way the book is read
  a.set({ at: 2, cap: 'hint' })
  await a.wait(1100)
  // A page turn: the next page comes in from the right
  a.set({ page: 'out' })
  await a.wait(520)
  await a.snap({ ...START, page: 'in' })
  await a.wait(40)
  a.set({ page: 'rest' })
  await a.move(REST)
}

function Square({ i, s }: { i: number; s: S }) {
  const b = BATTERS[i]!
  const live = i === 1
  const ink = live ? s.ink : 'none'
  return (
    <div className="bk-square" data-focus={s.at === i || undefined} style={{ left: i * PITCH }}>
      <div className="bk-square__head">
        <span className="bk-square__n">{b.n}</span>
        <span className="bk-square__name">{b.name}</span>
        <span className="bk-count" aria-hidden>
          <span>B</span><i /><i /><i />
          <span>S</span><i /><i />
        </span>
      </div>
      <svg className="bk-diamond" viewBox="0 0 250 230" aria-hidden data-ink={ink}>
        <path className="bk-print" d={`M${H.x} ${H.y} L${B1.x} ${B1.y} L${B2.x} ${B2.y} L${B3.x} ${B3.y} Z`} />
        {[B1, B2, B3].map((p, k) => (
          <rect key={k} className="bk-print bk-print--base" x={p.x - 5} y={p.y - 5} width={10} height={10} transform={`rotate(45 ${p.x} ${p.y})`} />
        ))}
        <path className="bk-print bk-print--base" d={`M${H.x - 6} ${H.y - 3} h12 v5 l-6 5 l-6 -5 Z`} />
        {live && (
          <>
            <path className="bk-ink bk-ink--hit" d={HIT} pathLength={1} />
            <path className="bk-ink bk-ink--run" d={RUN} pathLength={1} />
            <text className="bk-hand bk-hand--mark" x={196} y={214}>2B</text>
            <circle className="bk-ink bk-ink--dot" cx={B2.x} cy={B2.y} r={6} />
          </>
        )}
        {b.mark && <text className="bk-hand bk-hand--k" x={125} y={150}>{b.mark}</text>}
      </svg>
      {live && (
        <div className="bk-layer">
          <span className="bk-ball" data-ink={ink} style={{ offsetPath: `path('${HIT}')` }} />
          <span className="bk-pen" data-ink={ink} style={{ offsetPath: `path('${RUN}')` }}>
            <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden>
              <path d="M12 9.50002C11.7761 9.50002 11.559 9.52947 11.3525 9.5847L4.31171 2.54395L17.6921 5.69228C18.4831 5.87839 19.0828 6.52456 19.2096 7.32719L20.0743 12.8038C20.1073 13.0126 20.2055 13.2055 20.355 13.355L21.5858 14.5858C22.3668 15.3668 22.3668 16.6332 21.5858 17.4142L17.4142 21.5858C16.6332 22.3668 15.3668 22.3668 14.5858 21.5858L13.355 20.355C13.2055 20.2055 13.0126 20.1073 12.8038 20.0743L7.32719 19.2096C6.52456 19.0828 5.87839 18.4831 5.69228 17.6921L2.54395 4.31171L9.5847 11.3525C9.52947 11.559 9.50002 11.7761 9.50002 12C9.50002 13.3807 10.6193 14.5 12 14.5C13.3807 14.5 14.5 13.3807 14.5 12C14.5 10.6193 13.3807 9.50002 12 9.50002Z" fill="currentColor" />
            </svg>
          </span>
        </div>
      )}
    </div>
  )
}

const INNINGS = ['1', '2', '3', '4', '5', '6']
const LINE = [
  { team: 'Hawks', runs: ['1', '0', '2', '', '', ''], r: '3' },
  { team: 'Mustangs', runs: ['0', '1', '', '', '', ''], r: '1' },
]

export default function SandlotBook() {
  return (
    <Stage<S>
      width={440}
      height={700}
      compact={{ below: 440, width: 358, height: 690 }}
      initial={START}
      poster={{ mic: 'idle', cap: 'result', heard: words(SAID), ink: 'done', at: 1, page: 'rest' }}
      script={script}
      cursor={{ at: REST, style: 'touch' }}
      className="bk"
    >
      {(s, _rect, layout) => (
        <>
          <div className="bk-wash" />
          <Phone width={layout === 'compact' ? 326 : 340} className="bk-phone">
            <div className="bk-app">
              <div className="bk-sheet" data-page={s.page}>
                <table className="bk-line">
                  <thead>
                    <tr>
                      <th />
                      {INNINGS.map((n) => <th key={n} data-now={n === '3' || undefined}>{n}</th>)}
                      <th className="bk-line__r">R</th>
                    </tr>
                  </thead>
                  <tbody>
                    {LINE.map((row) => (
                      <tr key={row.team}>
                        <td className="bk-line__team">{row.team}</td>
                        {row.runs.map((r, i) => <td key={i} className="bk-hand">{r}</td>)}
                        <td className="bk-line__r bk-hand">{row.r}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="bk-strip">
                  <div className="bk-track" style={{ transform: `translateX(${201 - CARD / 2 - s.at * PITCH}px)` }}>
                    {BATTERS.map((_, i) => <Square key={i} i={i} s={s} />)}
                  </div>
                </div>
              </div>

              <div className="bk-caption">
                <States
                  value={s.cap}
                  states={{
                    hint: <span className="bk-hint">Tap the pen, then say the play</span>,
                    talk: <Stream className="bk-said" text={`“${SAID}”`} count={s.heard} />,
                    result: (
                      <span className="bk-saved">
                        <span className="bk-saved__title">Double to right-center</span>
                        <span className="bk-saved__sub">Written in the book · Ava up next</span>
                      </span>
                    ),
                  }}
                />
              </div>

              <div className="bk-inkwrap">
                <span className="bk-blot" data-on={s.mic === 'listening' || undefined} />
                <span className="bk-btn" data-target="ink" data-mic={s.mic}>
                  <States value={s.mic} states={{ idle: <Mic size={30} />, listening: <Waves on={s.mic === 'listening'} /> }} />
                </span>
              </div>
            </div>
          </Phone>
        </>
      )}
    </Stage>
  )
}
