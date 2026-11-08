import { Stage, Phone, LockScreen, Notification, Count, Roll, States, WALLPAPER, type Act } from '../../kit'
import { Bases } from '../sandlot-shared/field'
import { Dots } from '../sandlot-fieldday/scene'
import { FieldLayer, Bug, type S as YS } from '../sandlot-youth/youth'
import './fan.css'

// Sandlot for fans: a parent (or a grandparent three states away) following
// their own player, Maya #12. Three screens in the Field Day direction:
//
//  Live game:   the same Rec field and TV score bug, no scoring controls.
//               Plays arrive as the scorer records them; your player is the
//               one lit up.
//  Player page: Maya's game today (stats, where her balls went, each
//               at-bat) and her season, one tap apart.
//  Lock screen: a Live Activity that keeps the score, and a notification
//               when your player does something.
//
// Player names show in the interface only; events and stats refer to
// players by ID (AGENTS.md, rule 5).

// icons.download, thin arrow left and share, bold solid round
const Back = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
    <path d="M8.00096 15.2322L6.01874 13.25H20.751C21.4413 13.25 22.001 12.6904 22.001 12C22.001 11.3097 21.4413 10.75 20.751 10.75H6.01874L8.00096 8.76779C8.48912 8.27964 8.48912 7.48818 8.00096 7.00003C7.5128 6.51187 6.72135 6.51187 6.23319 7.00003L2.11709 11.1161C1.62894 11.6043 1.62894 12.3958 2.11709 12.8839L6.23319 17C6.72135 17.4882 7.5128 17.4882 8.00096 17C8.48911 16.5119 8.48911 15.7204 8.00096 15.2322Z" fill="currentColor" />
  </svg>
)
const Share = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
    <path d="M22.2932 11.2929C22.6838 11.6834 22.6838 12.3166 22.2932 12.7071L14.7075 20.2929C14.0775 20.9229 13.0003 20.4767 13.0003 19.5858V16C8.84027 16 5.73573 16.8017 3.21353 18.6606C2.34637 19.2997 0.835845 18.5228 1.18803 17.5048C2.88164 12.6092 6.12584 8.00002 13.0003 8.00002L13.0003 4.41424C13.0003 3.52333 14.0775 3.07716 14.7075 3.70713L22.2932 11.2929Z" fill="currentColor" />
  </svg>
)

function Chip({ n, size = 30 }: { n: string; size?: number }) {
  return <span className="fn-chip" style={{ width: size, height: size, fontSize: size * 0.43 }}>{n}</span>
}

// ================= Live game =================

type L = YS & { atbat: 'live' | 'done'; next: boolean; toast: boolean }
const LSTART: L = { mic: 'idle', cap: 'hint', heard: 0, phase: 'set', cam: 'wide', liam: 0, maya: 2, us: 2, balls: 1, strikes: 1, outs: 1, last: 'Strike', fade: false, atbat: 'live', next: false, toast: false }
const LPOSTER: L = { ...LSTART, phase: 'throw', liam: 1, maya: 4, us: 3, balls: 0, strikes: 0, atbat: 'done', next: true, toast: true }

const liveScript = async (a: Act<L>) => {
  await a.wait(1100)
  a.mark('ball')
  a.set({ balls: 2 })
  await a.wait(1300)
  a.mark('strike')
  a.set({ strikes: 2 })
  await a.wait(1500)
  a.mark('hit')
  a.set({ phase: 'hit' })
  await a.wait(380)
  a.set({ liam: 1, maya: 4 })
  await a.wait(1070)
  a.set({ phase: 'throw' })
  await a.wait(680)
  // The run is in: the score, the feed and Maya's line all catch up
  a.mark('scored')
  a.set({ us: 3, balls: 0, strikes: 0, atbat: 'done', toast: true })
  await a.wait(1100)
  a.set({ next: true })
  await a.wait(3400)
  a.set({ fade: true })
  await a.wait(450)
  await a.snap({ ...LSTART, fade: true })
  await a.wait(80)
  a.set({ fade: false })
}

function Feed({ s }: { s: L }) {
  return (
    <div className="fn-feed">
      <div className="fn-feed__item fn-feed__item--next" data-on={s.next || undefined}>
        <span className="fn-feed__inn">T4</span>
        <span className="fn-feed__text">Ava at bat</span>
        <span className="fn-feed__count">0–0</span>
      </div>
      <div className="fn-feed__item" data-hot={s.atbat === 'done' || undefined}>
        <span className="fn-feed__inn">T4</span>
        <States
          value={s.atbat}
          align="start"
          states={{
            live: (
              <span className="fn-feed__text">
                Liam at bat
                <span className="fn-feed__dots"><Dots kind="ball" lit={s.balls} of={3} /><Dots kind="strike" lit={s.strikes} of={2} /></span>
              </span>
            ),
            done: <span className="fn-feed__text">Liam singles to left. <b>Maya scores!</b></span>,
          }}
        />
      </div>
      <div className="fn-feed__item" data-mine>
        <span className="fn-feed__inn">T4</span>
        <span className="fn-feed__text"><b>Maya</b> doubles to center</span>
      </div>
      <div className="fn-feed__item">
        <span className="fn-feed__inn">T4</span>
        <span className="fn-feed__text">Ben flies out to right</span>
      </div>
    </div>
  )
}

export function FanLive() {
  return (
    <Stage<L> width={440} height={700} compact={{ below: 440, width: 358, height: 690 }} initial={LSTART} poster={LPOSTER} script={liveScript} className="fd tv bp yf fn">
      {(s, _rect, layout) => (
        <>
          <div className="fd-wash" />
          <Phone width={layout === 'compact' ? 326 : 340} className="fd-phone">
            <div className="fd-app bp-app" data-variant="rec">
              <FieldLayer s={s} variant="rec" />
              <Bug s={s} />
              <span className="fn-live"><i />Live</span>
              <div className="fn-toast" data-on={s.toast || undefined}>
                <Chip n="12" size={26} />
                <span><b>Maya scores!</b> Mustangs lead 3–1</span>
              </div>
              <div className="fd-sheet fn-sheet" />
              <div className="fn-follow">
                <Chip n="12" size={40} />
                <span className="fn-follow__who">
                  <span className="fn-follow__name">Maya</span>
                  <span className="fn-follow__sub"><Roll>{s.maya === 4 ? 'Scored in the 4th' : 'On 2nd base'}</Roll></span>
                </span>
                <span className="fn-mini"><b>1</b>H</span>
                <span className="fn-mini"><b><Count value={s.maya === 4 && s.us === 3 ? 1 : 0} duration={500} /></b>R</span>
                <span className="fn-mini"><b>1</b>BB</span>
              </div>
              <Feed s={s} />
              <div className="fdx-fade" data-on={s.fade || undefined} />
            </div>
          </Phone>
        </>
      )}
    </Stage>
  )
}

// ================= Player page =================

type P = { tab: 'today' | 'season'; fade: boolean }
const PSTART: P = { tab: 'today', fade: false }
const PREST = { wide: { x: 330, y: 300 }, compact: { x: 290, y: 300 } }

const playerScript = async (a: Act<P>) => {
  await a.wait(2200)
  a.mark('season')
  await a.click('season')
  a.set({ tab: 'season' })
  await a.wait(3400)
  a.mark('today')
  await a.click('today')
  a.set({ tab: 'today' })
  await a.wait(1600)
  await a.move(PREST)
}

// Where her balls went, on a little Rec field seen from above (a 200 box)
const TODAY_HITS = [
  { x: 100, y: 34, hit: true },
  { x: 76, y: 104, hit: false },
]
const SEASON_HITS = [
  ...TODAY_HITS,
  { x: 48, y: 62, hit: true }, { x: 132, y: 40, hit: true }, { x: 158, y: 70, hit: true }, { x: 86, y: 52, hit: true },
  { x: 60, y: 88, hit: true }, { x: 118, y: 96, hit: false }, { x: 140, y: 110, hit: false }, { x: 112, y: 58, hit: true },
  { x: 40, y: 98, hit: false }, { x: 150, y: 46, hit: true }, { x: 98, y: 112, hit: false }, { x: 70, y: 40, hit: true },
]

function Spray({ tab }: { tab: P['tab'] }) {
  const hits = tab === 'today' ? TODAY_HITS : SEASON_HITS
  return (
    <svg className="fn-spray" viewBox="0 0 200 160" aria-hidden data-tab={tab}>
      <path className="fn-spray__foul" d="M0 0 H200 V160 H0 Z" />
      <path className="fn-spray__grass" d="M100 150 L-4 46 Q100 -40 204 46 Z" />
      <path className="fn-spray__fence" d="M-4 46 Q100 -40 204 46" />
      <path className="fn-spray__dirt" d="M100 152 L52 104 Q100 44 148 104 Z" />
      <path className="fn-spray__chalk" d="M100 146 L-4 42 M100 146 L204 42" />
      {[[128, 118], [100, 90], [72, 118]].map(([x, y], i) => (
        <rect key={i} className="fn-spray__base" x={x - 3} y={y - 3} width="6" height="6" transform={`rotate(45 ${x} ${y})`} />
      ))}
      <g key={tab}>
        {hits.map((h, i) => (
          <g key={i} className="fn-spray__ab" data-hit={h.hit || undefined} style={{ animationDelay: `${0.15 + i * (tab === 'today' ? 0.45 : 0.08)}s` }}>
            {tab === 'today' && <path d={`M100 144 L${h.x} ${h.y}`} pathLength={1} style={{ animationDelay: `${0.15 + i * 0.45}s` }} />}
            <circle cx={h.x} cy={h.y} r={tab === 'today' ? 5 : 4} />
          </g>
        ))}
      </g>
    </svg>
  )
}

const STATS = {
  today: [['AB', '2'], ['H', '1'], ['R', '1'], ['BB', '1']],
  season: [['AVG', '.412'], ['H', '14'], ['R', '9'], ['RBI', '6']],
}

export function FanPlayer() {
  return (
    <Stage<P> width={440} height={700} compact={{ below: 440, width: 358, height: 690 }} initial={PSTART} poster={PSTART} script={playerScript} cursor={{ at: PREST, style: 'touch' }} className="fn fn-p">
      {(s, _rect, layout) => (
        <>
          <div className="fn-wash" />
          <Phone width={layout === 'compact' ? 326 : 340} className="fn-phone">
            <div className="fn-page">
              <div className="fn-hero">
                <div className="fn-nav">
                  <span className="fn-nav__btn"><Back /></span>
                  <span className="fn-nav__title">Mustangs vs Hawks · Live</span>
                  <span className="fn-nav__btn"><Share /></span>
                </div>
                <div className="fn-id">
                  <Chip n="12" size={64} />
                  <span className="fn-id__text">
                    <span className="fn-id__name">Maya</span>
                    <span className="fn-id__team">Mustangs · 10U Rec · bats 3rd</span>
                  </span>
                </div>
              </div>

              <div className="fn-body">
                <div className="fn-seg">
                  <i className="fn-seg__thumb" data-tab={s.tab} />
                  <span data-target="today" data-on={s.tab === 'today' || undefined}>Today</span>
                  <span data-target="season" data-on={s.tab === 'season' || undefined}>Season</span>
                </div>

                <div className="fn-stats">
                  {STATS.today.map((_, i) => (
                    <span key={i} className="fn-stat">
                      <span className="fn-stat__v"><Roll>{STATS[s.tab][i]![1]!}</Roll></span>
                      <span className="fn-stat__k"><Roll>{STATS[s.tab][i]![0]!}</Roll></span>
                    </span>
                  ))}
                </div>

                <div className="fn-card fn-card--spray">
                  <span className="fn-card__head">
                    <Roll>{s.tab === 'today' ? 'Where her balls went today' : 'Where her balls went this season'}</Roll>
                  </span>
                  <Spray tab={s.tab} />
                  <span className="fn-key"><i data-hit style={{ marginLeft: 0 }} />Hit<i />Out</span>
                </div>

                <div className="fn-card fn-card--list">
                  <States
                    value={s.tab}
                    align="start"
                    states={{
                      today: (
                        <div className="fn-rows">
                          <span className="fn-row"><span className="fn-row__inn">4th</span><span className="fn-row__what"><b>Double</b> to center, then scored</span></span>
                          <span className="fn-row"><span className="fn-row__inn">2nd</span><span className="fn-row__what">Ground out to short</span></span>
                          <span className="fn-row"><span className="fn-row__inn">1st</span><span className="fn-row__what">Walk</span></span>
                        </div>
                      ),
                      season: (
                        <div className="fn-rows">
                          <span className="fn-row"><span className="fn-row__inn">Today</span><span className="fn-row__what">vs Hawks · <b>1 for 2</b>, 1 run</span></span>
                          <span className="fn-row"><span className="fn-row__inn">Sat</span><span className="fn-row__what">vs Eagles · <b>2 for 3</b>, 2 RBI</span></span>
                          <span className="fn-row"><span className="fn-row__inn">Oct 25</span><span className="fn-row__what">vs Giants · 1 for 3</span></span>
                        </div>
                      ),
                    }}
                  />
                </div>
                <span className="fn-sharebtn"><Share />Share Maya’s game</span>
              </div>
              <div className="fdx-fade" data-on={s.fade || undefined} />
            </div>
          </Phone>
        </>
      )}
    </Stage>
  )
}

// ================= Lock screen =================

type K = { us: number; maya: number; balls: number; strikes: number; note: boolean; line: 'on' | 'scored' }
const KSTART: K = { us: 2, maya: 2, balls: 2, strikes: 2, note: false, line: 'on' }
const KPOSTER: K = { us: 3, maya: 4, balls: 0, strikes: 0, note: true, line: 'scored' }

const lockScript = async (a: Act<K>) => {
  await a.wait(1600)
  a.mark('scored')
  a.set({ maya: 4, balls: 0, strikes: 0, line: 'scored' })
  await a.wait(500)
  a.set({ us: 3 })
  await a.wait(900)
  a.mark('note')
  a.set({ note: true })
  await a.wait(4200)
  a.set({ note: false })
  await a.wait(700)
  await a.snap(KSTART)
}

function AppIcon() {
  return (
    <span className="fn-appicon" aria-hidden>
      <svg width="20" height="20" viewBox="0 0 20 20">
        <rect x="7" y="2" width="6" height="6" rx="1" transform="rotate(45 10 5)" fill="#fff" />
        <rect x="2.5" y="7.5" width="5" height="5" rx="1" transform="rotate(45 5 10)" fill="#ffb21e" />
        <rect x="12.5" y="7.5" width="5" height="5" rx="1" transform="rotate(45 15 10)" fill="#fff" />
      </svg>
    </span>
  )
}

function LiveActivity({ s }: { s: K }) {
  return (
    <div className="fn-la">
      <div className="fn-la__top">
        <AppIcon />
        <span className="fn-la__brand">Sandlot · Live</span>
        <span className="fn-la__inn">▲ Top 4</span>
      </div>
      <div className="fn-la__mid">
        <span className="fn-la__team">MUS <b><Count value={s.us} duration={600} /></b></span>
        <span className="fn-la__field">
          <Bases on={[s.maya === 4, s.maya === 2, false]} className="fn-la__bases" />
          <span className="fn-la__count"><Dots kind="ball" lit={s.balls} of={3} /><Dots kind="strike" lit={s.strikes} of={2} /></span>
        </span>
        <span className="fn-la__team fn-la__team--away"><b>1</b> HAW</span>
      </div>
      <div className="fn-la__line">
        <Chip n="12" size={22} />
        <Roll>{s.line === 'on' ? 'Maya is on 2nd · Liam at bat' : 'Maya scored! · Ava at bat'}</Roll>
      </div>
    </div>
  )
}

export function FanLock() {
  return (
    <Stage<K> width={440} height={700} compact={{ below: 440, width: 358, height: 690 }} initial={KSTART} poster={KPOSTER} script={lockScript} className="fn fn-k">
      {(s, _rect, layout) => (
        <>
          <div className="fn-wash fn-wash--lock" />
          <Phone width={layout === 'compact' ? 326 : 340} className="fn-phone" dark wallpaper={WALLPAPER}>
            <LockScreen date="Saturday, November 7" time="10:42" stack="top" controls={false}>
              <LiveActivity s={s} />
              {s.note && (
                <Notification
                  icon={<AppIcon />}
                  title="Maya scored!"
                  body="She came home from 2nd on Liam’s single. Mustangs lead the Hawks 3–1 in the 4th."
                />
              )}
            </LockScreen>
          </Phone>
        </>
      )}
    </Stage>
  )
}
