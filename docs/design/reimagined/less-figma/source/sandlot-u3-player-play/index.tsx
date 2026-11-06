import { Count, Roll, type Act } from '../../kit'
import { Shell, Icon, Emblem, Wordmark, RecTop, makeGeo, fadeOut } from '../sandlot-u3/u3'

// Maya's baseball card. The whole screen is one trading card: the front has
// her number, today's hits drawn on a little Rec field and today's line; tap
// it and it flips (a real 3D turn) to the back, cream card stock with her
// season and three stamped games. One button: Share card.

type C = { dealt: boolean; tally: boolean; side: 'front' | 'back'; season: boolean; stamps: boolean; lift: boolean; fade: boolean }
const START: C = { dealt: false, tally: false, side: 'front', season: false, stamps: false, lift: false, fade: false }
const POSTER: C = { ...START, dealt: true, tally: true }
const REST = { x: 338, y: 646 }

const script = async (a: Act<C>) => {
  await a.wait(500)
  a.mark('deal')
  a.set({ dealt: true })
  await a.wait(1500)
  a.set({ tally: true })
  await a.wait(2000)
  // Tap the card: it lifts and turns over; her season counts up on the back
  a.mark('tap')
  await a.click({ at: 'card', x: 0.88, y: 0.12 })
  a.set({ side: 'back', lift: true })
  await a.wait(560)
  a.set({ season: true })
  await a.wait(300)
  a.set({ stamps: true })
  await a.wait(1100)
  a.set({ lift: false })
  a.mark('back')
  await a.wait(2600)
  // Tap again: back to the front
  a.mark('tap2')
  await a.click({ at: 'card', x: 0.88, y: 0.1 })
  a.set({ side: 'front', lift: true })
  await a.wait(560)
  a.set({ stamps: false })
  await a.wait(600)
  a.set({ lift: false })
  await a.wait(1500)
  await fadeOut(a, START, REST)
}

// Her three at-bats today on a little Rec field (a 320 x 270 box): a walk, a
// ground out to short, and the double to center
const G = makeGeo(320, 270, 248, 12, 80)

const AVG = (n: number) => `.${String(Math.round(n)).padStart(3, '0')}`

function Stamp({ i, on, ink, r, date, vs, line }: { i: number; on: boolean; ink: 'green' | 'orange'; r: number; date: string; vs: string; line: string }) {
  return (
    <span className="u3-stamp" data-ink={ink} data-on={on || undefined} style={{ '--r': `${r}deg`, '--d': `${i * 0.2}s` } as React.CSSProperties}>
      <span>{date} <i>·</i> {vs}</span>
      <b>{line}</b>
    </span>
  )
}

export default function PlayerCard() {
  return (
    <Shell<C> initial={START} poster={POSTER} script={script} rest={REST}>
      {(s) => (
        <div className="u3-page u3-pc">
          <div className="u3-top">
            <span className="u3-round"><Icon name="arrow-left" size={20} /></span>
          </div>

          <div className="u3-deck" data-in={s.dealt || undefined}>
            <span className="u3-ghost u3-ghost--a"><Emblem size={34} /></span>
            <span className="u3-ghost u3-ghost--b"><Emblem size={34} /></span>

            <div className="u3-lift" data-lift={s.lift || undefined}>
              <div className="u3-deal">
                <div className="u3-card3d" data-target="card" data-side={s.side}>
                  <div className="u3-card__inner">
                    {/* ---- Front ---- */}
                    <div className="u3-face u3-front">
                      <span className="u3-sheen" />
                      <div className="u3-art">
                        <RecTop g={G} id="u3pc" />
                        <svg className="u3-hits" viewBox="0 0 320 270" width="320" height="270" aria-hidden>
                          <g className="u3-hit u3-hit--out">
                            <path d="M160 246 L124 176" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="1" pathLength="1" />
                            <circle cx="124" cy="176" r="6.5" fill="rgba(255,255,255,0.35)" stroke="#fff" strokeWidth="2.4" />
                          </g>
                          <g className="u3-hit u3-hit--hit">
                            <path d="M160 246 Q214 128 186 52" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" opacity="0.9" strokeDasharray="1" pathLength="1" />
                            <path d="M160 246 Q214 128 186 52" fill="none" stroke="#ff7519" strokeWidth="3.2" strokeLinecap="round" strokeDasharray="1" pathLength="1" />
                            <g className="u3-hit__dot">
                              <circle cx="186" cy="52" r="10" fill="#ff7519" stroke="#fff" strokeWidth="3" />
                            </g>
                          </g>
                        </svg>
                        <span className="u3-pill">Today vs Hawks</span>
                        <span className="u3-tag"><i />Double</span>
                      </div>
                      <span className="u3-chip3">12</span>
                      <div className="u3-id">
                        <span className="u3-id__name">Maya</span>
                        <span className="u3-id__sub">SS · Mustangs 10U</span>
                      </div>
                      <div className="u3-nums">
                        <span className="u3-num"><b><Count value={s.tally ? 1 : 0} duration={600} /></b><i>Hits</i></span>
                        <span className="u3-num"><b><Count value={s.tally ? 1 : 0} duration={600} stagger={0} /></b><i>Runs</i></span>
                        <span className="u3-num"><b><Count value={s.tally ? 1 : 0} duration={600} stagger={0} /></b><i>Walks</i></span>
                      </div>
                      <p className="u3-says">Doubled to center, then scored on Liam’s single.</p>
                    </div>

                    {/* ---- Back ---- */}
                    <div className="u3-face u3-back">
                      <div className="u3-band">
                        <span className="u3-chip3 u3-chip3--sm">12</span>
                        <span className="u3-band__text">
                          <span className="u3-band__name">Maya</span>
                          <span className="u3-band__sub">Shortstop · bats 3rd</span>
                        </span>
                      </div>
                      <p className="u3-rule">Fall 2026 season</p>
                      <div className="u3-grid">
                        <span className="u3-stat u3-stat--avg"><b><Count value={s.season ? 412 : 0} format={AVG} duration={900} /></b><i>Batting avg</i></span>
                        <span className="u3-stat"><b><Count value={s.season ? 14 : 0} duration={900} /></b><i>Hits</i></span>
                        <span className="u3-stat"><b><Count value={s.season ? 9 : 0} duration={900} /></b><i>Runs</i></span>
                        <span className="u3-stat"><b><Count value={s.season ? 6 : 0} duration={900} /></b><i>RBI</i></span>
                      </div>
                      <p className="u3-rule">Recent games</p>
                      <div className="u3-stamps">
                        <Stamp i={0} on={s.stamps} ink="green" r={-1.3} date="Nov 7" vs="Hawks" line="1-for-2" />
                        <Stamp i={1} on={s.stamps} ink="orange" r={1.1} date="Oct 31" vs="Eagles" line="2-for-3" />
                        <Stamp i={2} on={s.stamps} ink="green" r={-0.8} date="Oct 24" vs="Giants" line="1-for-3" />
                      </div>
                      <span className="u3-foot"><Wordmark size={15} /></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="u3-hint">
            <Icon name="refresh" size={15} />
            <Roll variant="fade">{s.side === 'front' ? 'Tap the card to flip it' : 'Tap again to flip back'}</Roll>
          </p>
          <span className="u3-share"><Icon name="share" size={20} />Share card</span>

          <div className="fdx-fade" data-on={s.fade || undefined} />
        </div>
      )}
    </Shell>
  )
}
