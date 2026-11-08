import type { CSSProperties } from 'react'
import { Count, Roll, States, type Act } from '../../kit'
import { Shell, Icon, Tabs, Tick, RecTop, makeGeo, fadeOut } from '../sandlot-u3/u3'

// The Mustangs, standing on the Rec field seen from above: each kid's orange
// chip at their position, the bench in the dugout strip, the record on a
// pennant. A white dot marks a kid whose parent hasn't joined yet. One big
// button invites the parents; roles stay behind a small People link.

type T = { pen: boolean; run: boolean; sheet: boolean; sent: boolean; joined: string[]; toast: boolean; fade: boolean }
const START: T = { pen: false, run: false, sheet: false, sent: false, joined: [], toast: false, fade: false }
const POSTER: T = { ...START, pen: true, run: true, joined: ['zoe', 'ella'], toast: true }
const REST = { x: 342, y: 604 }

const script = async (a: Act<T>) => {
  await a.wait(500)
  a.mark('pennant')
  a.set({ pen: true })
  await a.wait(800)
  a.mark('run')
  a.set({ run: true })
  await a.wait(3000)
  a.mark('invite')
  await a.click({ at: 'invite', x: 0.9, y: 0.5 })
  a.set({ sheet: true })
  await a.wait(1500)
  a.mark('send')
  await a.click({ at: 'text', x: 0.9, y: 0.5 })
  a.set({ sent: true })
  await a.wait(800)
  a.set({ sheet: false })
  await a.wait(1100)
  // The parents tap the link: their kid's dot becomes a check
  a.mark('joined')
  a.set({ joined: ['zoe'], toast: true })
  await a.wait(1300)
  a.set({ joined: ['zoe', 'ella'] })
  await a.wait(2600)
  a.set({ toast: false })
  await a.wait(700)
  await fadeOut(a, START, REST)
}

// The field card: the art on top, the dugout strip under it
const W = 370
const ART = 392
const DUG = 86
const G = makeGeo(W, ART, 316, 44, 116)

type Kid = { id: string; n: string; name: string; at: [number, number]; waiting?: boolean }
const STARTERS: Kid[] = [
  { id: 'zoe', n: '4', name: 'Zoe', at: [185, 236], waiting: true },
  { id: 'leo', n: '18', name: 'Leo', at: [185, 346], waiting: true },
  { id: 'ava', n: '3', name: 'Ava', at: [258, 224] },
  { id: 'ben', n: '15', name: 'Ben', at: [222, 178] },
  { id: 'maya', n: '12', name: 'Maya', at: [148, 178] },
  { id: 'jack', n: '22', name: 'Jack', at: [112, 224] },
  { id: 'noah', n: '9', name: 'Noah', at: [80, 128] },
  { id: 'liam', n: '7', name: 'Liam', at: [185, 98] },
  { id: 'mia', n: '5', name: 'Mia', at: [290, 128] },
]
const BENCH: Kid[] = [
  { id: 'sam', n: '11', name: 'Sam', at: [186, ART + 40], waiting: true },
  { id: 'ella', n: '6', name: 'Ella', at: [250, ART + 40], waiting: true },
  { id: 'max', n: '20', name: 'Max', at: [314, ART + 40], waiting: true },
]
const DOOR: [number, number] = [-46, ART + 40]

function KidChip({ k, i, run, joined }: { k: Kid; i: number; run: boolean; joined: boolean }) {
  const bench = BENCH.includes(k)
  const out = bench || run
  const [x, y] = out ? k.at : DOOR
  const dist = Math.hypot(k.at[0] - DOOR[0], k.at[1] - DOOR[1])
  const ms = bench ? 0 : Math.round(750 + dist * 1.1)
  const d = bench ? 0 : i * 90
  return (
    <span
      className="u3-kid"
      data-out={out || undefined}
      data-go={(!bench && run) || undefined}
      style={{ '--x': `${x}px`, '--y': `${y}px`, '--ms': `${ms}ms`, '--d': `${d}ms`, zIndex: Math.round(k.at[1]) } as CSSProperties}
    >
      <span className="u3-kid__x">
        <span className="u3-kid__y">
          <span className="u3-kid__stack">
            <span className="u3-kid__bob">
              <span className="u3-chip">
                {k.n}
                {k.waiting && (
                  <span className="u3-mark" data-joined={joined || undefined}>
                    <i className="u3-mark__dot" />
                    <i className="u3-mark__ok"><Tick size={12} /></i>
                  </span>
                )}
              </span>
            </span>
            <span className="u3-kid__name">{k.name}</span>
          </span>
        </span>
      </span>
    </span>
  )
}

const WAITING = [...STARTERS, ...BENCH].filter((k) => k.waiting).length

export default function TeamField() {
  return (
    <Shell<T> initial={START} poster={POSTER} script={script} rest={REST}>
      {(s) => (
        <div className="u3-page u3-tf">
          <span className="u3-pole" />
          <div className="u3-pen" data-on={s.pen || undefined}>
            <span className="u3-pen__felt" />
            <span className="u3-pen__text">
              <span className="u3-pen__rec">6–2</span>
              <span className="u3-pen__name">Mustangs</span>
            </span>
          </div>

          <div className="u3-fieldcard" style={{ height: ART + DUG }}>
            <div className="u3-fieldcard__art"><RecTop g={G} id="u3tf" /></div>
            <div className="u3-dugout" style={{ top: ART, height: DUG }}>
              <span className="u3-dugout__label">On the bench</span>
              <span className="u3-dugout__plank" />
            </div>
            {[...STARTERS, ...BENCH].map((k, i) => (
              <KidChip key={k.id} k={k} i={i} run={s.run} joined={s.joined.includes(k.id)} />
            ))}

            <div className="u3-toast" data-on={s.toast || undefined}>
              <span className="u3-toast__icon"><Icon name="check-circle" size={20} /></span>
              <Roll variant="fade">{`${s.joined.length || 1} parent${s.joined.length === 1 || !s.joined.length ? '' : 's'} joined`}</Roll>
            </div>
          </div>

          <span className="u3-big" data-target="invite"><Icon name="user-add" size={22} />Invite parents</span>
          <div className="u3-under">
            <span className="u3-legend">
              <i className="u3-legend__dot" />
              <span className="u3-legend__n"><Count value={WAITING - s.joined.length} duration={500} /></span>
              parents haven’t joined
            </span>
            <span className="u3-people">People<Icon name="caret-right" size={13} /></span>
          </div>

          <Tabs on="team" />

          <div className="u3-scrim" data-on={s.sheet || undefined} />
          <div className="u3-sheet" data-open={s.sheet || undefined}>
            <span className="u3-grab" />
            <div className="u3-ticketwrap">
              <div className="u3-ticket">
                <span className="u3-ticket__stub"><Icon name="link" size={22} /></span>
                <span className="u3-ticket__url">sandlot.app/join/<b>mustangs</b></span>
              </div>
            </div>
            <span className="u3-text" data-target="text" data-done={s.sent || undefined}>
              <States
                value={s.sent ? 'sent' : 'idle'}
                states={{
                  idle: <span className="u3-text__in"><Icon name="message-circle" size={20} />Text the link</span>,
                  sent: <span className="u3-text__in"><Tick size={16} />Sent</span>,
                }}
              />
            </span>
          </div>

          <div className="fdx-fade" data-on={s.fade || undefined} />
        </div>
      )}
    </Shell>
  )
}
