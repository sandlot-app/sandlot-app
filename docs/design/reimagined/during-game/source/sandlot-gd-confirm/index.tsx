import { Roll, Stream, States } from '../../kit'
import { Mic, Waves, words } from '../sandlot-shared/field'
import { TapButton } from '../sandlot-youth/youth'
import { Field, GBug, Tick, Shell, loopEnd, type Act } from '../sandlot-gd/gd'
import './confirm.css'

// The "two readings" card (ADR 0007). A press goes to the AI, which reads the
// whole play. Almost every press just saves. A card appears only when two
// readings are both believable and nothing said picks one: here, a ball hit
// to short that was safe at first is a single, or the shortstop's error.

type C = {
  mic: 'idle' | 'listening'
  cap: 'hint' | 'talk' | 'card' | 'result'
  heard: number
  card: boolean
  pick: boolean
  liam: number
  bases: [boolean, boolean, boolean]
  go: boolean
  balls: number
  strikes: number
  last: string
  fade: boolean
}

const SAID = 'Liam hits it to short, safe at first'
const START: C = { mic: 'idle', cap: 'hint', heard: 0, card: false, pick: false, liam: 0, bases: [false, false, false], go: false, balls: 1, strikes: 1, last: 'Strike', fade: false }
const POSTER: C = { ...START, cap: 'card', heard: words(SAID), card: true }

const script = async (a: Act<C>) => {
  await a.wait(1000)
  a.mark('tap')
  await a.click('mic')
  a.set({ mic: 'listening', cap: 'talk' })
  for (let i = 0; i < words(SAID); i++) {
    await a.wait(i === 4 ? 420 : 210)
    a.put((s) => ({ heard: s.heard + 1 }))
  }
  await a.wait(620)
  // Two readings, both believable: nothing is saved yet
  a.mark('two')
  a.set({ mic: 'idle', cap: 'card', card: true })
  await a.wait(2600)
  await a.click('single')
  a.set({ pick: true })
  await a.wait(320)
  a.set({ card: false })
  await a.wait(300)
  a.mark('play')
  a.set({ go: true, liam: 1 })
  await a.wait(1050)
  a.mark('saved')
  a.set({ bases: [true, false, false], balls: 0, strikes: 0, last: 'Single', cap: 'result' })
  await a.wait(3000)
  await loopEnd(a, START)
}

// A grounder to short, then the throw across to first (the 400 box, drawn at 1.4)
const K = 1.4
const scaled = (d: string) => d.replace(/-?\d+(\.\d+)?/g, (n) => String(+(+n * K).toFixed(2)))
const ROLL = scaled('M200 322 L168 206')
const THROW = scaled('M168 206 L272 256')

function Ball({ kind, go }: { kind: 'roll' | 'throw'; go: boolean }) {
  return (
    <span className={`bp-ball gd-ball gd-ball--${kind}`} data-go={go || undefined} style={{ offsetPath: `path('${kind === 'roll' ? ROLL : THROW}')` }}>
      <span className="bp-ball__shadow" />
      <span className="bp-ball__lift"><span className="bp-ball__body" /></span>
    </span>
  )
}

export default function SandlotGdConfirm() {
  return (
    <Shell<C> initial={START} poster={POSTER} script={script}>
      {(s) => (
        <>
          <Field liam={s.liam} extra={<><Ball kind="roll" go={s.go} /><Ball kind="throw" go={s.go} /></>} />
          <GBug s={{ bases: s.bases, us: 2, them: 1, outs: 1, balls: s.balls, strikes: s.strikes, inning: 'Top 3' }} />

          <div className="gd-lift" data-up={s.card || undefined} />

          <div className="fd-caption">
            <States
              value={s.cap}
              states={{
                hint: <span className="fd-hint">Tap, then say the play</span>,
                talk: <Stream className="fd-said" text={`“${SAID}”`} count={s.heard} />,
                card: <span />,
                result: (
                  <span className="fd-saved">
                    <span className="fd-saved__tick"><Tick /></span>
                    <span className="fd-saved__text">
                      <span className="fd-saved__title">Single</span>
                      <span className="fd-saved__sub">Liam is safe at 1st</span>
                    </span>
                    <span className="fd-undo" data-target="undo">Undo</span>
                  </span>
                ),
              }}
            />
          </div>

          <div className="gd-two" data-on={s.card || undefined}>
            <p className="gd-two__quote">“{SAID}”</p>
            <p className="gd-two__title">Which was it?</p>
            <div className="gd-two__row">
              <span className="gd-choice" data-target="single" data-on={s.pick || undefined}>
                <span className="gd-choice__title">Single</span>
                <span className="gd-choice__sub">Counts as a hit for Liam</span>
              </span>
              <span className="gd-choice">
                <span className="gd-choice__title">Reached on error (SS)</span>
                <span className="gd-choice__sub">No hit for Liam. Error on the shortstop.</span>
              </span>
            </div>
          </div>

          <div className="fd-controls gd-ctl" data-card={s.card || undefined}>
            <TapButton kind="ball" />
            <div className="fd-micwrap">
              <span className="fd-ring" data-on={s.mic === 'listening' || undefined} />
              <span className="fd-ring fd-ring--late" data-on={s.mic === 'listening' || undefined} />
              <span className="fd-mic" data-target="mic" data-mic={s.mic}>
                <States value={s.mic} states={{ idle: <Mic size={34} />, listening: <Waves on={s.mic === 'listening'} /> }} />
              </span>
            </div>
            <TapButton kind="strike" />
          </div>
          <span className="fd-status">
            <Tick />
            <Roll>{`Last: ${s.last} · All plays saved`}</Roll>
          </span>
        </>
      )}
    </Shell>
  )
}
