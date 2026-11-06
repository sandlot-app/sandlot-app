import { Stage, Phone, Count, Stream, States, type Act } from '../../kit'
import { Bases, FieldArt, Mic, Waves, HOME, runnerStyle, words } from '../sandlot-shared/field'
import './night.css'

// Sandlot, concept 2: "Night Game". The app as the ballpark under the
// lights. A real LED scoreboard sits on top (today's scoreboard pill grown
// into the thing it was always drawing), the field glows under four light
// towers, and the one control is a lit orb. Say the play and the ballpark
// answers: a home run leaves a comet trail over the fence, the board flashes
// HOME RUN, both runners come round and the score rolls into the lead.
//
// The loop resets the way a ballpark does between innings: the lights go
// out and come back up on the next half.
//
// Real strings: the teams, the LED runs, the inning, B S O, the marquee,
// the spoken line, the saved play, the hint.

type Mic = 'idle' | 'listening'
type Cap = 'hint' | 'talk' | 'result'
type Ball = 'ready' | 'hit' | 'gone'
type S = { mic: Mic; cap: Cap; heard: number; ball: Ball; jack: number; ava: number; us: number; marquee: 'bat' | 'hr'; dark: boolean }

const SAID = 'Jack crushes it over the left field fence'
const START: S = { mic: 'idle', cap: 'hint', heard: 0, ball: 'ready', jack: 0, ava: 1, us: 2, marquee: 'bat', dark: false }
const REST = { wide: { x: 340, y: 560 }, compact: { x: 300, y: 560 } }

// The flight: a straight track on the ground, and the ball above it, lifted
// by a parabola, so the comet trail bows up toward the camera
const LAND = { x: 34, y: 62 }
const PEAK = 120
const point = (t: number) => {
  const x = HOME.x + (LAND.x - HOME.x) * t
  const y = HOME.y - 8 + (LAND.y - HOME.y + 8) * t - 4 * PEAK * t * (1 - t)
  return `${x.toFixed(1)} ${y.toFixed(1)}`
}
const ARC = 'M' + Array.from({ length: 33 }, (_, i) => point(i / 32)).join(' L')
const TRACK = `M${HOME.x} ${HOME.y - 8} L${LAND.x} ${LAND.y}`

const script = async (a: Act<S>) => {
  await a.wait(800)
  a.mark('tap')
  await a.click('orb')
  a.set({ mic: 'listening', cap: 'talk' })
  for (let i = 0; i < words(SAID); i++) {
    await a.wait(i === 3 ? 380 : 200)
    a.put((s) => ({ heard: s.heard + 1 }))
  }
  await a.wait(480)
  a.mark('hit')
  a.set({ mic: 'idle', ball: 'hit' })
  await a.wait(1300)
  a.set({ marquee: 'hr', ava: 4, jack: 4 })
  await a.wait(2000)
  a.set({ us: 3 })
  await a.wait(900)
  a.set({ us: 4 })
  await a.wait(400)
  a.mark('saved')
  a.set({ cap: 'result', ball: 'gone' })
  await a.wait(2400)
  // Lights out between halves; the next half comes up under them
  a.set({ dark: true })
  await a.wait(700)
  await a.snap({ ...START, dark: true })
  await a.wait(250)
  a.set({ dark: false })
  await a.move(REST)
}

function Runner({ n, name, base, ms, scored }: { n: string; name: string; base: number; ms: number; scored?: boolean }) {
  return (
    <span className="ng-runner" style={runnerStyle(base, ms)} data-scored={scored || undefined}>
      <span className="ng-runner__chip">{n}</span>
      <span className="ng-runner__name">{name}</span>
    </span>
  )
}

function Bulbs({ label, lit, of }: { label: string; lit: number; of: number }) {
  return (
    <span className="ng-bulbs">
      <span className="ng-bulbs__label">{label}</span>
      {Array.from({ length: of }, (_, i) => (
        <i key={i} data-on={i < lit || undefined} />
      ))}
    </span>
  )
}

export default function SandlotNight() {
  const done = (s: S) => s.ava === 4
  return (
    <Stage<S>
      width={440}
      height={700}
      compact={{ below: 440, width: 358, height: 690 }}
      initial={START}
      poster={{ ...START, mic: 'idle', cap: 'result', heard: words(SAID), ball: 'gone', jack: 4, ava: 4, us: 4, marquee: 'hr' }}
      script={script}
      cursor={{ at: REST, style: 'touch' }}
      className="ng"
    >
      {(s, _rect, layout) => (
        <>
          <div className="ng-wash" />
          <Phone width={layout === 'compact' ? 326 : 340} className="ng-phone" dark>
            <div className="ng-app" data-dark={s.dark || undefined}>
              <div className="ng-towers" />

              <header className="ng-board">
                <div className="ng-board__rows">
                  <span className="ng-board__team">Hawks</span>
                  <span className="ng-led ng-board__runs">3</span>
                  <span className="ng-board__team ng-board__team--us">Mustangs</span>
                  <span className="ng-led ng-board__runs">
                    <Count value={s.us} duration={700} />
                  </span>
                </div>
                <div className="ng-board__side">
                  <span className="ng-board__inn">
                    <span className="ng-board__small">Inning</span>
                    <span className="ng-led ng-board__innnum">6</span>
                  </span>
                  <Bases on={[s.ava === 1, false, false]} className="ng-bases" />
                </div>
                <div className="ng-board__foot">
                  <Bulbs label="B" lit={s.ball === 'ready' ? 2 : 0} of={3} />
                  <Bulbs label="S" lit={s.ball === 'ready' ? 1 : 0} of={2} />
                  <Bulbs label="O" lit={1} of={2} />
                </div>
                <div className="ng-marquee" data-hr={s.marquee === 'hr' || undefined}>
                  <States
                    value={s.marquee}
                    states={{
                      bat: <span className="ng-marquee__text">Now batting · #22 Jack</span>,
                      hr: <span className="ng-marquee__text ng-marquee__text--hr">Home run!</span>,
                    }}
                  />
                </div>
              </header>

              <div className="ng-park">
                <FieldArt className="ng-art" />
                <svg className="ng-flight" viewBox="0 0 400 400" aria-hidden data-ball={s.ball}>
                  <defs>
                    <linearGradient id="ng-comet" x1="200" y1="322" x2="34" y2="62" gradientUnits="userSpaceOnUse">
                      <stop offset="0" stopColor="#ff7519" stopOpacity="0" />
                      <stop offset="0.55" stopColor="#ff9a3d" stopOpacity="0.7" />
                      <stop offset="1" stopColor="#ffd27a" />
                    </linearGradient>
                  </defs>
                  <path className="ng-flight__track" d={TRACK} pathLength={1} />
                  <path className="ng-flight__arc" d={ARC} pathLength={1} />
                </svg>
                <span className="ng-ball" data-ball={s.ball} style={{ offsetPath: `path('${ARC}')` }}>
                  <span className="ng-ball__body" />
                </span>
                <span className="ng-flash" data-on={s.ball !== 'ready' || undefined} />
                <Runner n="3" name="Ava" base={s.ava} ms={2000} scored={done(s)} />
                <Runner n="22" name="Jack" base={s.jack} ms={2900} scored={s.jack === 4} />
              </div>

              <div className="ng-caption">
                <States
                  value={s.cap}
                  states={{
                    hint: <span className="ng-hint">Tap the light, then say the play</span>,
                    talk: <Stream className="ng-said" text={`“${SAID}”`} count={s.heard} />,
                    result: (
                      <span className="ng-saved">
                        <span className="ng-saved__title">Home run to left</span>
                        <span className="ng-saved__sub">2 runs score · Mustangs lead 4–3</span>
                      </span>
                    ),
                  }}
                />
              </div>

              <div className="ng-orbwrap">
                <span className="ng-halo" data-on={s.mic === 'listening' || undefined} />
                <span className="ng-orb" data-target="orb" data-mic={s.mic}>
                  <States value={s.mic} states={{ idle: <Mic size={32} />, listening: <Waves on={s.mic === 'listening'} bars={7} /> }} />
                </span>
              </div>

              <div className="ng-dark" data-on={s.dark || undefined} />
            </div>
          </Phone>
        </>
      )}
    </Stage>
  )
}
