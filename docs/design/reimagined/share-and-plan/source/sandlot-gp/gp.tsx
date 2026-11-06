import type { ReactNode } from 'react'
import { Stage, Phone, Roll, States, Count, Collapse, type Act } from '../../kit'
import { Wordmark } from '../sandlot-ob/ob'
import { FieldLayer, Bug, START as YSTART } from '../sandlot-youth/youth'
import { Dots } from '../sandlot-fieldday/scene'
import photo from '../sandlot-stream/live-stream.jpg'
import '../sandlot-ga/ga.css'
import '../sandlot-fan/fan.css'
import './gp.css'
import { PATHS } from './gp-icons'

// Group gp: two new screens for people who are not the scorer.
//
//  Team card:  after the 7-4 final, a parent who hasn't claimed a player taps
//              Share and gets a card about the team. No child's name is on it
//              (recap spec: the share image names a child only for the family
//              that claimed her). One soft line offers the claim; picking a
//              player turns the same card into that player's card.
//  Plus:       the paid tier. Live score, play-by-play and stat cards are free
//              for good; live video, replays and clips of your own child are
//              paid. A free parent taps Video, sees one offer, picks Yearly,
//              starts the free week, and the video starts playing.
//
// Same Saturday: Mustangs 7, Hawks 4 after six innings, 10U Rec, Field 2.
// Prices on the offer ($4.99 a month, $39.99 a year) are placeholders until
// the streaming cost test sets the real ones.

type IconName = keyof typeof PATHS
const Icon = ({ name, size = 20 }: { name: IconName; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    {PATHS[name]!.map(([d, eo], i) => <path key={i} d={d} fill="currentColor" fillRule={eo ? 'evenodd' : undefined} />)}
  </svg>
)

function Chip({ n, size = 30 }: { n: string; size?: number }) {
  return (
    <span className="ga-chip" style={{ width: size, height: size, fontSize: size * 0.43 }}>
      {n}
    </span>
  )
}

// ---------------------------------------------------------------- the shell
function Shell<T extends object>({ initial, poster, script, rest, tag, children }: { initial: T; poster: T; script: (a: Act<T>) => Promise<void>; rest: { x: number; y: number }; tag: string; children: (s: T) => ReactNode }) {
  return (
    <Stage<T>
      width={440}
      height={820}
      compact={{ below: 440, width: 358, height: 690 }}
      initial={initial}
      poster={poster}
      script={script}
      cursor={{ at: { wide: rest, compact: { x: rest.x - 40, y: Math.min(rest.y, 600) } }, style: 'touch' }}
      className={`fd tv bp yf ob ga fn gp ${tag}`}
    >
      {(s, _rect, layout) => (
        <>
          <div className="gp-wash" />
          <Phone width={layout === 'compact' ? 326 : 340} className="gp-phone">
            {children(s)}
          </Phone>
        </>
      )}
    </Stage>
  )
}

// ---------------------------------------------------------------- the game
// Mustangs 7, Hawks 4, six innings. The Mustangs bat first.
const MUS = [0, 1, 1, 1, 2, 2]
const HAW = [0, 1, 0, 1, 1, 1]
const LINE = [
  { id: 'MUS', runs: MUS, r: 7, h: 9, e: 1 },
  { id: 'HAW', runs: HAW, r: 4, h: 6, e: 2 },
]

function FinalBug({ className = '' }: { className?: string }) {
  return (
    <header className={`tv-bug ga-bug ${className}`}>
      <div className="tv-teams">
        <span className="tv-team" data-bat>
          <i className="tv-team__stripe" />
          <span className="tv-team__name">MUS</span>
          <span className="tv-team__runs">7</span>
        </span>
        <span className="tv-team">
          <i className="tv-team__stripe tv-team__stripe--away" />
          <span className="tv-team__name">HAW</span>
          <span className="tv-team__runs">4</span>
        </span>
      </div>
      <div className="tv-count ga-bug__final">
        <span className="ga-bug__word">Final</span>
        <span className="ga-bug__sub">6 innings</span>
      </div>
    </header>
  )
}

function Linescore() {
  return (
    <div className="ga-ls">
      <div className="ga-ls__row ga-ls__row--head">
        <span />
        {[1, 2, 3, 4, 5, 6].map((n) => <span key={n}>{n}</span>)}
        <span />
        <span>R</span>
        <span>H</span>
        <span>E</span>
      </div>
      {LINE.map((t) => (
        <div key={t.id} className="ga-ls__row">
          <span className="ga-ls__team"><i data-away={t.id === 'HAW' || undefined} />{t.id}</span>
          {t.runs.map((n, i) => <span key={i} className="ga-ls__in" data-zero={n === 0 || undefined}>{n}</span>)}
          <span />
          <span className="ga-ls__r">{t.r}</span>
          <span className="ga-ls__x">{t.h}</span>
          <span className="ga-ls__x">{t.e}</span>
        </div>
      ))}
    </div>
  )
}

function MiniField() {
  return (
    <svg className="ga-mini" viewBox="0 0 200 160" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <path d="M100 150 L-4 46 Q100 -40 204 46 Z" fill="#56a04b" />
      <path d="M-4 46 Q100 -40 204 46" fill="none" stroke="#f4c430" strokeWidth="3" />
      <path d="M100 152 L52 104 Q100 44 148 104 Z" fill="#c8915f" />
      <path d="M100 146 L-4 42 M100 146 L204 42" stroke="rgba(255,255,255,0.85)" strokeWidth="1.2" />
      {[[128, 118], [100, 90], [72, 118]].map(([x, y], i) => (
        <rect key={i} x={x - 3.5} y={y - 3.5} width="7" height="7" fill="#fff" transform={`rotate(45 ${x} ${y})`} />
      ))}
    </svg>
  )
}

/** The field at the foot of a share card. Maya's two hits draw in when `on`; the team card shows the bare field. */
function CardField({ on }: { on: boolean }) {
  const hits = [{ x: 98, y: 36 }, { x: 136, y: 68 }]
  return (
    <svg className="gp-sc__svg" viewBox="0 20 200 130" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <path d="M100 150 L-4 46 Q100 -40 204 46 Z" fill="#56a04b" />
      <path d="M-4 46 Q100 -40 204 46" fill="none" stroke="#f4c430" strokeWidth="3" />
      <path d="M100 152 L52 104 Q100 44 148 104 Z" fill="#c8915f" />
      <path d="M100 146 L-4 42 M100 146 L204 42" stroke="rgba(255,255,255,0.85)" strokeWidth="1.2" />
      {[[128, 118], [100, 90], [72, 118]].map(([x, y], i) => (
        <rect key={i} x={x - 3.5} y={y - 3.5} width="7" height="7" fill="#fff" transform={`rotate(45 ${x} ${y})`} />
      ))}
      {hits.map((h, i) => (
        <g key={i} className="gp-hit" data-on={on || undefined} style={{ ['--d' as string]: `${i * 0.35}s` }}>
          <path d={`M100 144 L${h.x} ${h.y}`} pathLength={1} stroke="#ffb072" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <circle cx={h.x} cy={h.y} r="6" fill="#ff7519" stroke="#fff" strokeWidth="2" />
        </g>
      ))}
    </svg>
  )
}

// ================================================================= Team card

type T = { sheet: boolean; built: number; inn: number; score: boolean; sent: boolean; pick: boolean; chip: string; claimed: boolean; shape: boolean; hits: boolean; fade: boolean }
const TSTART: T = { sheet: false, built: 0, inn: 0, score: false, sent: false, pick: false, chip: '', claimed: false, shape: false, hits: false, fade: false }
const TPOSTER: T = { ...TSTART, sheet: true, built: 4, inn: 6, score: true }
const TREST = { x: 330, y: 330 }

const teamScript = async (a: Act<T>) => {
  await a.wait(1100)
  // Share, from the top of the game page: the sheet comes up and the card builds
  a.mark('open')
  await a.click('navshare')
  a.set({ sheet: true, built: 1 })
  await a.wait(900)
  a.mark('build')
  a.set({ score: true })
  await a.wait(900)
  a.set({ built: 2 })
  await a.wait(400)
  for (let i = 1; i <= 6; i++) {
    a.set({ inn: i })
    await a.wait(240)
  }
  a.set({ built: 3 })
  await a.wait(500)
  a.set({ built: 4 })
  await a.wait(1500)
  a.mark('share')
  await a.click('share')
  a.set({ sent: true })
  await a.wait(1300)
  a.mark('claim')
  await a.click('claim')
  a.set({ pick: true })
  await a.wait(1300)
  a.mark('pick')
  await a.click('p-12')
  a.set({ chip: '12' })
  await a.wait(600)
  a.set({ pick: false })
  await a.wait(450)
  a.mark('maya')
  // Her name and line first; then the team strip folds into her numbers; then her hits draw
  a.set({ claimed: true, sent: false })
  await a.wait(600)
  a.set({ shape: true })
  await a.wait(1000)
  a.set({ hits: true })
  await a.wait(2600)
  a.set({ fade: true })
  await a.wait(450)
  await a.snap({ ...TSTART, fade: true })
  await a.wait(80)
  a.set({ fade: false })
  await a.move(TREST)
}

const ROSTER = [['12', 'Maya'], ['7', 'Liam'], ['3', 'Ava'], ['15', 'Ben'], ['9', 'Noah'], ['22', 'Jack'], ['5', 'Mia'], ['18', 'Leo'], ['4', 'Zoe'], ['11', 'Sam'], ['6', 'Ella'], ['20', 'Max']]

/** The vertical share image. Team version first; claimed, the same card carries the player's name and line. */
function ShareCard({ s }: { s: T }) {
  const c = s.claimed
  return (
    <div className="gp-sc" data-claimed={c || undefined}>
      <div className="gp-sc__top">
        <Wordmark size={22} dark />
        <span className="gp-sc__date">Sat, Nov 7</span>
      </div>

      <div className="gp-sc__id gp-rise" data-in={s.built >= 1 || c || undefined}>
        <States
          value={c ? 'maya' : 'team'}
          align="start"
          states={{
            team: (
              <span className="gp-sc__who">
                <span className="gp-sc__title">Mustangs win</span>
                <span className="gp-sc__sub">10U Rec · Field 2</span>
              </span>
            ),
            maya: (
              <span className="gp-sc__who gp-sc__who--kid">
                <Chip n="12" size={52} />
                <span className="gp-sc__ids">
                  <span className="gp-sc__title">Maya</span>
                  <span className="gp-sc__sub">Mustangs · SS</span>
                </span>
              </span>
            ),
          }}
        />
      </div>

      <div className="gp-sc__line gp-rise" data-in={s.built >= 1 || c || undefined}>
        <span className="gp-sc__label"><Roll>{c ? 'Today' : 'Final · 6 innings'}</Roll></span>
        <States
          value={c ? 'maya' : 'team'}
          align="start"
          states={{
            team: <span className="gp-sc__big"><Count value={s.score ? 74 : 0} duration={900} format={(n) => `${Math.floor(Math.round(n) / 10)}–${Math.round(n) % 10}`} /></span>,
            maya: <span className="gp-sc__big">2-for-3</span>,
          }}
        />
      </div>

      <Collapse open={!s.shape}>
        <div className="gp-strip gp-rise" data-in={s.built >= 2 || undefined}>
          <div className="gp-strip__key">
            <span><i />Mustangs</span>
            <span><i data-away />Hawks</span>
          </div>
          <div className="gp-strip__chart">
            <span className="gp-strip__hl" data-on={s.built >= 3 || undefined} />
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <span key={i} className="gp-strip__col" style={{ gridColumn: i + 1 }}>
                <span className="gp-strip__bars">
                  <i data-on={s.inn > i || undefined} style={{ ['--r' as string]: MUS[i] }} />
                  <i data-away data-on={s.inn > i || undefined} style={{ ['--r' as string]: HAW[i] }} />
                </span>
                <span className="gp-strip__n">{i + 1}</span>
              </span>
            ))}
          </div>
        </div>
        <p className="gp-moment gp-rise" data-in={s.built >= 3 || undefined}>
          <b>Four runs</b> in the last two innings
        </p>
      </Collapse>

      <Collapse open={s.shape}>
        <div className="gp-sc__tiles gp-rise" data-in={s.shape || undefined}>
          {[['1', '2B'], ['2', 'R'], ['1', 'RBI'], ['1', 'BB']].map(([v, k]) => (
            <span key={k} className="gp-sc__tile"><b>{v}</b>{k}</span>
          ))}
        </div>
      </Collapse>

      <div className="gp-sc__foot gp-rise" data-in={s.built >= 4 || c || undefined}>
        <States
          value={s.shape ? 'maya' : 'team'}
          align="start"
          states={{
            team: (
              <span className="gp-sc__pair">
                <span className="gp-sc__tile gp-sc__tile--wide"><em>Record</em><b>7–2</b></span>
                <span className="gp-sc__tile gp-sc__tile--wide"><em>Next</em><b className="gp-sc__next">Sat vs Eagles</b></span>
              </span>
            ),
            maya: (
              <span className="gp-sc__final">
                <span className="gp-sc__label gp-sc__label--dim">Final · 6 innings</span>
                <span className="gp-sc__score"><b>Mustangs 7</b><i>Hawks 4</i></span>
              </span>
            ),
          }}
        />
      </div>

      <div className="gp-sc__field gp-rise" data-in={s.built >= 4 || c || undefined}>
        <CardField on={s.hits} />
      </div>
    </div>
  )
}

export function TeamCard() {
  return (
    <Shell<T> initial={TSTART} poster={TPOSTER} script={teamScript} rest={TREST} tag="gp-team">
      {(s) => (
        <div className="ga-app">
          {/* The game page, as a parent who hasn't claimed anyone sees it */}
          <div className="ga-hero" />
          <div className="ga-nav">
            <span className="ga-round ga-round--glass"><Icon name="arrow-left" size={20} /></span>
            <span className="ga-nav__title">Mustangs vs Hawks</span>
            <span className="ga-round ga-round--glass" data-target="navshare"><Icon name="share" size={20} /></span>
          </div>
          <FinalBug className="ga-bug--page" />
          <div className="ga-body">
            <div className="ga-tabs">
              <span data-on>Summary</span>
              <span>Plays</span>
              <span>Box score</span>
              <span>Video</span>
            </div>
            <div className="ga-teaser">
              <span className="ga-teaser__text">
                <span className="ga-kick">Recap</span>
                <span className="ga-teaser__head">Mustangs pull away late to beat the Hawks 7–4</span>
                <span className="ga-teaser__lead">Four runs in the last two innings.</span>
              </span>
              <span className="ga-teaser__thumb"><MiniField /></span>
            </div>
            <Linescore />
            <div className="ga-dec">
              <div className="ga-dec__row">
                <span className="ga-dec__tag" data-tag="W">W</span>
                <span className="ga-dec__chip">15</span>
                <span className="ga-dec__who">Ben</span>
                <span className="ga-dec__line"><b>4</b> IP · <b>5</b> SO</span>
              </div>
              <div className="ga-dec__row">
                <span className="ga-dec__tag" data-tag="L">L</span>
                <span className="ga-dec__chip" data-away>21</span>
                <span className="ga-dec__who">Hawks pitcher</span>
                <span className="ga-dec__line"><b>4⅓</b> IP · <b>6</b> H</span>
              </div>
            </div>
            <div className="gp-plays" data-under={s.sheet || undefined}>
              <span className="gp-plays__row"><span className="gp-plays__inn">T6</span>Jack singles, Leo scores<b>7–4</b></span>
              <span className="gp-plays__row"><span className="gp-plays__inn">T5</span>Leo singles in Ava<b>5–2</b></span>
              <span className="gp-plays__row"><span className="gp-plays__inn">T5</span>Ava doubles home Mia<b>4–2</b></span>
            </div>
          </div>

          <div className="ga-scrim" data-on={s.sheet || undefined} />
          <div className="gp-sheet" data-open={s.sheet || undefined} data-dim={s.pick || undefined}>
            <div className="gp-sheet__top">
              <span className="gp-sheet__title"><Roll>{s.claimed ? 'Share Maya’s game' : 'Share the game'}</Roll></span>
              <span className="ga-round"><Icon name="close" size={18} /></span>
            </div>
            <ShareCard s={s} />
            <div className="gp-sheet__foot">
            <div className="gp-btns">
              <span className="ga-btn ga-btn--ghost">
                <span className="ga-btn__in"><Icon name="download" size={20} />Save image</span>
              </span>
              <span className="ga-btn ga-btn--primary gp-send" data-ready data-done={s.sent || undefined} data-target="share">
                <States
                  value={s.sent ? 'sent' : 'share'}
                  states={{
                    share: <span className="ga-btn__in"><Icon name="share" size={20} />Share</span>,
                    sent: <span className="ga-btn__in"><Icon name="check" size={18} />Sent</span>,
                  }}
                />
              </span>
            </div>
            <div className="gp-claim">
              <span className="gp-claim__text">
                <States
                  value={s.claimed ? 'yes' : 'no'}
                  align="start"
                  states={{
                    no: <span>Claim your player to get a card with their stats</span>,
                    yes: <span>This card names Maya because she’s your player</span>,
                  }}
                />
              </span>
              <span className="gp-claim__btn" data-target="claim" data-done={s.claimed || undefined}>
                <States
                  value={s.claimed ? 'done' : 'claim'}
                  states={{
                    claim: <span className="gp-claim__in">Claim</span>,
                    done: <span className="gp-claim__in"><Icon name="check" size={16} />Claimed</span>,
                  }}
                />
              </span>
            </div>
            </div>
          </div>

          <div className="gp-pick" data-open={s.pick || undefined}>
            <span className="gp-pick__title">Which player is yours?</span>
            <div className="ob-roster">
              {ROSTER.map(([n, name]) => (
                <span key={n} className="ob-kid" data-target={`p-${n}`} data-on={s.chip === n || undefined}>
                  <span className="ob-kid__n">{n}</span>
                  {name}
                </span>
              ))}
            </div>
          </div>
          <div className="fdx-fade" data-on={s.fade || undefined} />
        </div>
      )}
    </Shell>
  )
}

// ================================================================= Plus

type P = { sheet: 'closed' | 'offer' | 'done'; plan: 'month' | 'year'; busy: boolean; video: boolean; fade: boolean }
const PSTART: P = { sheet: 'closed', plan: 'month', busy: false, video: false, fade: false }
const PPOSTER: P = { ...PSTART, sheet: 'offer', plan: 'year' }
const PREST = { x: 330, y: 380 }

const plusScript = async (a: Act<P>) => {
  await a.wait(1400)
  a.mark('tab')
  await a.click('tab-video')
  a.set({ sheet: 'offer' })
  await a.wait(1900)
  a.mark('yearly')
  await a.click('plan-year')
  a.set({ plan: 'year' })
  await a.wait(1100)
  a.mark('start')
  await a.click('start')
  a.set({ busy: true })
  await a.wait(1500)
  a.mark('done')
  a.set({ sheet: 'done' })
  await a.wait(1700)
  a.mark('video')
  a.set({ sheet: 'closed', video: true, busy: false })
  await a.wait(3400)
  a.set({ fade: true })
  await a.wait(450)
  await a.snap({ ...PSTART, fade: true })
  await a.wait(80)
  a.set({ fade: false })
  await a.move(PREST)
}

const FEED: { inn: string; what: ReactNode; hot?: boolean; mine?: boolean }[] = [
  { inn: 'T4', what: <>Liam at bat<span className="fn-feed__dots"><Dots kind="ball" lit={1} of={3} /><Dots kind="strike" lit={1} of={2} /></span></> },
  { inn: 'T4', what: <><b>Maya</b> doubles to center</> },
  { inn: 'T4', what: <>Ben flies out to right</> },
  { inn: 'T3', what: <>Jack grounds out to short</> },
  { inn: 'B3', what: <>Hawks go down in order</> },
]

const BENEFITS: { icon: IconName; text: string }[] = [
  { icon: 'video', text: 'Live video of every game' },
  { icon: 'history', text: 'Replays' },
  { icon: 'scissors', text: 'Clips of Maya’s plays' },
]

/** The live game, as the fan screen draws it: the Rec field, the score bug, Maya's line, the feed. Video swaps the field for the camera. */
function LiveGame({ s }: { s: P }) {
  const unlocked = s.video
  return (
    <div className="fd-app bp-app" data-variant="rec">
      <FieldLayer s={{ phase: 'set', liam: 0, maya: 2 }} variant="rec" />
      <div className="gp-video" data-crop data-on={s.video || undefined}>
        <div className="gp-video__img" style={{ backgroundImage: `url(${photo})` }} />
      </div>
      <Bug s={YSTART} />
      <span className="fn-live"><i />Live</span>
      <div className="gp-tabs" data-tab={unlocked ? 'video' : 'field'}>
        <i className="gp-tabs__thumb" />
        <span data-on={!unlocked || undefined}>Field</span>
        <span data-on={unlocked || undefined} data-target="tab-video">
          Video
          <span className="gp-tabs__lock" data-off={unlocked || undefined}><Icon name="lock" size={13} /></span>
        </span>
      </div>
      <span className="gp-playflash" data-on={s.video || undefined}><Icon name="play" size={26} /></span>

      <div className="fd-sheet fn-sheet" />
      <div className="fn-follow">
        <Chip n="12" size={40} />
        <span className="fn-follow__who">
          <span className="fn-follow__name">Maya</span>
          <span className="fn-follow__sub">On 2nd base</span>
        </span>
        <span className="fn-mini"><b>1</b>H</span>
        <span className="fn-mini"><b>0</b>R</span>
        <span className="fn-mini"><b>1</b>BB</span>
      </div>
      <div className="fn-feed">
        {FEED.map((f, i) => (
          <div key={i} className="fn-feed__item">
            <span className="fn-feed__inn">{f.inn}</span>
            <span className="fn-feed__text">{f.what}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Plus() {
  return (
    <Shell<P> initial={PSTART} poster={PPOSTER} script={plusScript} rest={PREST} tag="gp-plus">
      {(s) => {
        const offer = s.sheet !== 'closed'
        const done = s.sheet === 'done' || s.video
        return (
          <div className="gp-live">
            <LiveGame s={s} />

            <div className="ga-scrim" data-on={offer || undefined} />
            <div className="gp-pw" data-open={offer || undefined} data-done={done || undefined}>
              <div className="gp-pw__main">
                <div className="gp-pw__top">
                  <span className="gp-pw__title">Watch Maya play, live</span>
                  <span className="gp-pw__x"><Icon name="close" size={16} /></span>
                </div>

                <div className="gp-pw__hero">
                  <div className="gp-pw__photo" style={{ backgroundImage: `url(${photo})` }} />
                  <span className="fn-live"><i />Live</span>
                  <span className="gp-pw__play"><Icon name="play" size={22} /></span>
                </div>

                <div className="gp-pw__list">
                  {BENEFITS.map((b) => (
                    <span key={b.text} className="gp-ben">
                      <span className="gp-ben__icon"><Icon name={b.icon} size={20} /></span>
                      {b.text}
                    </span>
                  ))}
                </div>

                <div className="gp-free">
                  <Icon name="check-circle" size={18} />
                  Scores, play-by-play and stat cards stay free
                </div>

                <div className="gp-plans">
                  <span className="gp-plan" data-target="plan-month" data-on={s.plan === 'month' || undefined}>
                    <span className="gp-plan__top"><span className="gp-plan__name">Monthly</span></span>
                    <span className="gp-plan__price"><b>$4.99</b>/month</span>
                  </span>
                  <span className="gp-plan" data-target="plan-year" data-on={s.plan === 'year' || undefined}>
                    <span className="gp-plan__top">
                      <span className="gp-plan__name">Yearly</span>
                      <span className="gp-plan__save">Save 33%</span>
                    </span>
                    <span className="gp-plan__price"><b>$39.99</b>/year</span>
                  </span>
                </div>

                <span className="gp-cta" data-target="start" data-busy={s.busy || undefined}>
                  <States
                    value={s.busy ? 'busy' : 'idle'}
                    states={{
                      idle: <span className="gp-cta__in">Start your free week</span>,
                      busy: <span className="gp-cta__in"><span className="ob-spin" aria-hidden />Confirming with Apple…</span>,
                    }}
                  />
                </span>
                <p className="gp-fine">Covers your whole family. Cancel anytime.</p>
              </div>

              <div className="gp-pw__ok">
                <span className="gp-pw__disc"><Icon name="check-circle" size={92} /></span>
                <span className="gp-pw__oktitle">You’re in</span>
                <span className="gp-pw__oksub">Free for 7 days, then {s.plan === 'year' ? '$39.99 a year' : '$4.99 a month'}.</span>
                <span className="gp-pw__oksub gp-pw__oksub--dim">Covers your whole family.</span>
              </div>
            </div>
            <div className="fdx-fade" data-on={s.fade || undefined} />
          </div>
        )
      }}
    </Shell>
  )
}
