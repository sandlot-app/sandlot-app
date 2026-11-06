import type { CSSProperties, ReactNode } from 'react'
import { Stage, Phone, Roll, Count, States, Collapse, type Act } from '../../kit'
import { Bases } from '../sandlot-shared/field'
import { FieldLayer } from '../sandlot-youth/youth'
import '../sandlot-ob/ob.css'
import './gb.css'

// Sandlot, before the game. Four screens in the Field Day direction, built
// on the same shell as the onboarding and Home screens (ob.tsx):
//
//  Games:      the Games tab. TODAY, UPCOMING and FINAL, an All / Following
//              toggle, and a dark "Live now" card dressed like the TV score
//              bug at the top of today.
//  Game setup: the scorer's last stop before the first pitch: the game, the
//              season half, both lineups, and the one button.
//  Lineup:     the Mustangs' batting order, reordered by dragging.
//  Pregame:    what a fan sees before first pitch: the TV bug at 0 to 0 with
//              the start time, the field with the Hawks in position, and the
//              batting order with the followed player marked.
//
// Player names show in the interface only; nothing here is an event or a
// stat (AGENTS.md, rule 5).

// icons.download, bold solid round
const P = {
  house: 'M2.18557 11C1.71748 11 1.50603 10.4143 1.86615 10.1153L10.7231 2.76087C11.4638 2.14579 12.5377 2.14579 13.2784 2.76087L22.1353 10.1153C22.4954 10.4143 22.284 11 21.8159 11H20.0007V20C20.0007 20.5522 19.553 21 19.0007 21H15.0007C14.4485 21 14.0007 20.5522 14.0007 20V15C14.0007 14.4477 13.553 14 13.0007 14H11.0007C10.4485 14 10.0007 14.4477 10.0007 15V20C10.0007 20.5522 9.55302 21 9.00074 21H5.00074C4.44845 21 4.00074 20.5522 4.00074 20V11H2.18557Z',
  calendar: 'M2 7C2 5.89543 2.89543 5 4 5H5.75V3.75C5.75 3.05964 6.30964 2.5 7 2.5C7.69036 2.5 8.25 3.05964 8.25 3.75V5H15.75V3.75C15.75 3.05964 16.3096 2.5 17 2.5C17.6904 2.5 18.25 3.05964 18.25 3.75V5H20C21.1046 5 22 5.89543 22 7V9H2V7ZM4 21C2.89543 21 2 20.1046 2 19V11.5H22V19C22 20.1046 21.1046 21 20 21H4Z',
  users: 'M10.75 6.75C10.75 8.82107 9.07107 10.5 7 10.5C4.92893 10.5 3.25 8.82107 3.25 6.75C3.25 4.67893 4.92893 3 7 3C9.07107 3 10.75 4.67893 10.75 6.75ZM17 10.5C19.0711 10.5 20.75 8.82107 20.75 6.75C20.75 4.67893 19.0711 3 17 3C14.9289 3 13.25 4.67893 13.25 6.75C13.25 8.82107 14.9289 10.5 17 10.5ZM16.0322 20C16.3316 19.3975 16.5 18.7184 16.5 18V16.1668C16.5 15.2303 16.2076 14.1862 15.4582 13.3321C15.1581 12.9902 14.8374 12.6665 14.498 12.363C15.2907 12.1268 16.1305 12 17 12C19.6224 12 21.9754 13.1536 23.5791 14.9811C23.8649 15.3068 24 15.7334 24 16.1668V18C24 19.1046 23.1046 20 22 20H16.0322ZM7 12C9.62239 12 11.9754 13.1536 13.5791 14.9811C13.8649 15.3068 14 15.7334 14 16.1668V18C14 19.1046 13.1046 20 12 20H2C0.895431 20 0 19.1046 0 18V16.1668C0 15.7334 0.135133 15.3068 0.420922 14.9811C2.02464 13.1536 4.37761 12 7 12Z',
  user: 'M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11ZM19.5815 16.479C19.8642 16.8074 20 17.2333 20 17.6666V19C20 20.1046 19.1046 21 18 21H6C4.89543 21 4 20.1046 4 19V17.6666C4 17.2333 4.13576 16.8074 4.41847 16.479C6.25235 14.3488 8.96866 13 12 13C15.0313 13 17.7477 14.3488 19.5815 16.479Z',
  back: 'M8.00096 15.2322L6.01874 13.25H20.751C21.4413 13.25 22.001 12.6904 22.001 12C22.001 11.3097 21.4413 10.75 20.751 10.75H6.01874L8.00096 8.76779C8.48912 8.27964 8.48912 7.48818 8.00096 7.00003C7.5128 6.51187 6.72135 6.51187 6.23319 7.00003L2.11709 11.1161C1.62894 11.6043 1.62894 12.3958 2.11709 12.8839L6.23319 17C6.72135 17.4882 7.5128 17.4882 8.00096 17C8.48911 16.5119 8.48911 15.7204 8.00096 15.2322Z',
  search: 'M10.502 1.75C5.66946 1.75 1.75195 5.66751 1.75195 10.5C1.75195 15.3325 5.66946 19.25 10.502 19.25C12.4668 19.25 14.2818 18.6013 15.7421 17.5079L20.2342 22C20.7223 22.4882 21.5138 22.4882 22.002 22C22.4901 21.5118 22.4901 20.7204 22.002 20.2322L17.5099 15.7401C18.6032 14.2798 19.252 12.4649 19.252 10.5C19.252 5.66751 15.3344 1.75 10.502 1.75ZM4.25195 10.5C4.25195 7.04822 7.05017 4.25 10.502 4.25C13.9537 4.25 16.752 7.04822 16.752 10.5C16.752 12.2262 16.0538 13.787 14.9214 14.9194C13.789 16.0518 12.2282 16.75 10.502 16.75C7.05017 16.75 4.25195 13.9518 4.25195 10.5Z',
  grip: 'M8.25 2.5C7.14543 2.5 6.25 3.39543 6.25 4.5C6.25 5.60457 7.14543 6.5 8.25 6.5C9.35457 6.5 10.25 5.60457 10.25 4.5C10.25 3.39543 9.35457 2.5 8.25 2.5ZM6.25 12C6.25 10.8954 7.14543 10 8.25 10C9.35457 10 10.25 10.8954 10.25 12C10.25 13.1046 9.35457 14 8.25 14C7.14543 14 6.25 13.1046 6.25 12ZM6.25 19.5C6.25 18.3954 7.14543 17.5 8.25 17.5C9.35457 17.5 10.25 18.3954 10.25 19.5C10.25 20.6046 9.35457 21.5 8.25 21.5C7.14543 21.5 6.25 20.6046 6.25 19.5ZM13.75 4.5C13.75 3.39543 14.6454 2.5 15.75 2.5C16.8546 2.5 17.75 3.39543 17.75 4.5C17.75 5.60457 16.8546 6.5 15.75 6.5C14.6454 6.5 13.75 5.60457 13.75 4.5ZM13.75 12C13.75 10.8954 14.6454 10 15.75 10C16.8546 10 17.75 10.8954 17.75 12C17.75 13.1046 16.8546 14 15.75 14C14.6454 14 13.75 13.1046 13.75 12ZM13.75 19.5C13.75 18.3954 14.6454 17.5 15.75 17.5C16.8546 17.5 17.75 18.3954 17.75 19.5C17.75 20.6046 16.8546 21.5 15.75 21.5C14.6454 21.5 13.75 20.6046 13.75 19.5Z',
  chevron: 'M8.55069 18.1872L14.7379 12L8.55069 5.81284C8.06253 5.32468 8.06253 4.53323 8.55069 4.04507C8.79476 3.80099 9.11467 3.67896 9.43457 3.67896C9.75447 3.67895 10.0744 3.80099 10.3185 4.04507L17.3895 11.1161C17.6239 11.3506 17.7556 11.6685 17.7556 12C17.7556 12.3315 17.6239 12.6495 17.3895 12.8839L10.3185 19.955C10.2574 20.016 10.1917 20.0694 10.1224 20.1151C9.63717 20.4355 8.97782 20.3821 8.55069 19.955C8.52018 19.9244 8.49157 19.8928 8.46488 19.86C8.27745 19.6302 8.18402 19.3493 8.18457 19.0686C8.18473 18.9894 8.19236 18.9103 8.20745 18.8323C8.25322 18.596 8.36763 18.3703 8.55069 18.1872Z',
  plus: 'M10.7519 19.75C10.7519 20.4403 11.3116 21 12.0019 21C12.6923 21 13.2519 20.4403 13.2519 19.75V13.25H19.7519C20.4423 13.25 21.0019 12.6903 21.0019 12C21.0019 11.3096 20.4423 10.75 19.7519 10.75H13.2519V4.25C13.2519 3.55965 12.6923 3 12.0019 3C11.3116 3 10.7519 3.55964 10.7519 4.25V10.75H4.25195C3.5616 10.75 3.00195 11.3096 3.00195 12C3.00195 12.6903 3.5616 13.25 4.25195 13.25H10.7519V19.75Z',
  check: 'M21.1554 7.12211C21.4772 6.6379 21.4258 5.97839 20.9999 5.54996C20.5133 5.06032 19.7218 5.05792 19.2322 5.54459L8.97695 15.7378L4.76769 11.5561C4.27794 11.0695 3.48649 11.0721 2.99994 11.5619C2.76566 11.7977 2.64479 12.1035 2.63711 12.4115C2.63657 12.4333 2.63659 12.4551 2.63718 12.4769C2.64559 12.7867 2.76852 13.094 3.00574 13.3296L8.09619 18.3867C8.58376 18.8711 9.37092 18.871 9.85837 18.3865L20.9946 7.31772C21.0558 7.25688 21.1094 7.19129 21.1554 7.12211Z',
  clock: 'M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12ZM11.375 13.0825C10.9882 12.8592 10.75 12.4466 10.75 12V8.75C10.75 8.05965 11.3096 7.5 12 7.5C12.6904 7.5 13.25 8.05965 13.25 8.75V11.2783L15.8726 12.7925C16.4705 13.1376 16.6753 13.9021 16.3301 14.5C15.985 15.0979 15.2205 15.3027 14.6226 14.9575L11.375 13.0825Z',
  info: 'M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12ZM11.1739 16.95C10.8977 16.95 10.6739 16.7261 10.6739 16.45V10.5864C10.6739 10.3102 10.8977 10.0864 11.1739 10.0864H12.8202C13.0963 10.0864 13.3202 10.3102 13.3202 10.5864V16.45C13.3202 16.7261 13.0963 16.95 12.8202 16.95H11.1739ZM11.997 8.81932C11.6391 8.81932 11.3322 8.70107 11.0766 8.46456C10.8209 8.22805 10.693 7.94361 10.693 7.61122C10.693 7.27884 10.8209 6.99439 11.0766 6.75788C11.3322 6.52138 11.6391 6.40313 11.997 6.40313C12.3582 6.40313 12.665 6.52138 12.9175 6.75788C13.1731 6.99439 13.301 7.27884 13.301 7.61122C13.301 7.94361 13.1731 8.22805 12.9175 8.46456C12.665 8.70107 12.3582 8.81932 11.997 8.81932Z',
}
const Icon = ({ name, size = 20 }: { name: keyof typeof P; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><path d={P[name]} fill="currentColor" fillRule="evenodd" /></svg>
)
const Spinner = () => <span className="ob-spin" aria-hidden />

/** The orange player number: our player, the one a parent follows (grey for the rest of the team) */
function Chip({ n, size = 30, mine }: { n: string; size?: number; mine?: boolean }) {
  return (
    <span className="gb-chip" data-mine={mine || undefined} style={{ width: size, height: size, fontSize: size * 0.43 }}>
      {n}
    </span>
  )
}

function Tabs({ on }: { on: 'home' | 'games' | 'team' | 'me' }) {
  return (
    <div className="ob-tabs">
      <span className="ob-tab" data-on={on === 'home' || undefined}><Icon name="house" size={22} />Home</span>
      <span className="ob-tab" data-on={on === 'games' || undefined}><Icon name="calendar" size={22} />Games</span>
      <span className="ob-tab" data-on={on === 'team' || undefined}><Icon name="users" size={22} />Team</span>
      <span className="ob-tab" data-on={on === 'me' || undefined}><Icon name="user" size={22} />Me</span>
    </div>
  )
}

function Shell<T extends object>({ initial, poster, script, rest, children }: { initial: T; poster: T; script: (a: Act<T>) => Promise<void>; rest: { x: number; y: number }; children: (s: T) => ReactNode }) {
  return (
    <Stage<T>
      width={440}
      height={820}
      compact={{ below: 440, width: 358, height: 690 }}
      initial={initial}
      poster={poster}
      script={script}
      cursor={{ at: { wide: rest, compact: { x: rest.x - 40, y: Math.min(rest.y, 600) } }, style: 'touch' }}
      className="fd tv bp yf ob gb"
    >
      {(s, _rect, layout) => (
        <>
          <div className="ob-wash" />
          <Phone width={layout === 'compact' ? 326 : 340} className="ob-phone">
            {children(s)}
          </Phone>
        </>
      )}
    </Stage>
  )
}

const fadeOut = async <T extends { fade: boolean }>(a: Act<T>, start: T, rest: { x: number; y: number }) => {
  const fade = (on: boolean) => ({ fade: on }) as unknown as Partial<T>
  a.set(fade(true))
  await a.wait(450)
  await a.snap({ ...start, fade: true })
  await a.wait(80)
  await a.set(fade(false))
  // Back where the stage first put it, so the loop closes on the same frame it opened on
  await a.move(a.layout === 'compact' ? { x: rest.x - 40, y: Math.min(rest.y, 600) } : rest)
}

// The Mustangs, in the order the lineup screen ends on (Maya bats 3rd)
const MUSTANGS: Record<string, { n: string; name: string; pos: string }> = {
  noah: { n: '9', name: 'Noah', pos: 'LF' },
  ben: { n: '15', name: 'Ben', pos: '2B' },
  maya: { n: '12', name: 'Maya', pos: 'SS' },
  liam: { n: '7', name: 'Liam', pos: 'CF' },
  ava: { n: '3', name: 'Ava', pos: '1B' },
  jack: { n: '22', name: 'Jack', pos: '3B' },
  mia: { n: '5', name: 'Mia', pos: 'RF' },
  leo: { n: '18', name: 'Leo', pos: 'C' },
  zoe: { n: '4', name: 'Zoe', pos: 'P' },
  sam: { n: '11', name: 'Sam', pos: 'Bats only' },
}
const ORDER_SET = ['noah', 'ben', 'maya', 'liam', 'ava', 'jack', 'mia', 'leo', 'zoe', 'sam']

// ================= Games =================

type G = { scored: boolean; all: boolean; fade: boolean }
const GSTART: G = { scored: false, all: false, fade: false }
const GREST = { x: 330, y: 600 }

const gamesScript = async (a: Act<G>) => {
  await a.wait(1500)
  // Maya crosses the plate: the card's score, the bases and its line catch up
  a.mark('scored')
  a.set({ scored: true })
  await a.wait(2500)
  a.mark('all')
  await a.click({ at: 'seg-all', x: 0.8, y: 0.62 })
  a.set({ all: true })
  await a.wait(3000)
  a.mark('following')
  await a.click({ at: 'seg-following', x: 0.9, y: 0.62 })
  a.set({ all: false })
  await a.wait(2300)
  await fadeOut(a, GSTART, GREST)
}

type Game = {
  id: string
  away: string
  home: string
  mid: string
  sub: string
  /** the followed team's side: always on the list; the rest only under All */
  follow?: 'away' | 'home'
  win?: 'away' | 'home' | 'tie'
}

const LATER: Game[] = [{ id: 'later-1', away: 'Giants', home: 'Eagles', mid: '12:30 PM', sub: 'Field 1' }]

const UPCOMING: Game[] = [
  { id: 'up-1', away: 'Eagles', home: 'Mustangs', mid: '9:00 AM', sub: 'Nov 14 · Field 1', follow: 'home' },
  { id: 'up-2', away: 'Bears', home: 'Panthers', mid: '10:30 AM', sub: 'Nov 14 · Field 3' },
  { id: 'up-3', away: 'Hawks', home: 'Eagles', mid: '9:00 AM', sub: 'Nov 21 · Field 1' },
  { id: 'up-4', away: 'Mustangs', home: 'Giants', mid: '11:00 AM', sub: 'Nov 21 · Rancho Field', follow: 'away' },
]

const FINAL: Game[] = [
  { id: 'fin-1', away: 'Eagles', home: 'Mustangs', mid: '6 – 9', sub: 'Final · Oct 31', follow: 'home', win: 'home' },
  { id: 'fin-2', away: 'Hawks', home: 'Bears', mid: '8 – 2', sub: 'Final · Oct 31', win: 'away' },
  { id: 'fin-3', away: 'Mustangs', home: 'Giants', mid: '5 – 7', sub: 'Final · Oct 25', follow: 'away', win: 'home' },
  { id: 'fin-4', away: 'Panthers', home: 'Bears', mid: '4 – 4', sub: 'Final · Oct 25', win: 'tie' },
]

function GameRow({ g, sep }: { g: Game; sep: boolean }) {
  return (
    <div className="gb-grow" data-sep={sep || undefined}>
      <span className="gb-side" data-lost={g.win === 'home' || undefined}>
        <i className="gb-fdot" data-on={g.follow === 'away' || undefined} />
        {g.away}
      </span>
      <span className="gb-mid" data-kind={g.win ? 'score' : 'time'}>
        <b>{g.mid}</b>
        <small>{g.sub}</small>
      </span>
      <span className="gb-side gb-side--home" data-lost={g.win === 'away' || undefined}>
        {g.home}
        <i className="gb-fdot" data-on={g.follow === 'home' || undefined} />
      </span>
    </div>
  )
}

/** A card of games: the followed team's rows stay; the others slide in under All */
function GameCard({ rows, all }: { rows: Game[]; all: boolean }) {
  return (
    <div className="gb-gcard">
      {rows.map((g, i) =>
        g.follow ? (
          <GameRow key={g.id} g={g} sep={i > 0} />
        ) : (
          <Collapse key={g.id} open={all}>
            <GameRow g={g} sep={i > 0} />
          </Collapse>
        ),
      )}
    </div>
  )
}

function LiveNow({ s }: { s: G }) {
  return (
    <div className="gb-live">
      <div className="gb-live__head">
        <i className="gb-live__dot" />
        Live now
        <span className="gb-live__where">10U Rec · Field 2</span>
      </div>
      <div className="gb-bug">
        <div className="gb-bug__teams">
          <span className="gb-bug__team">
            <i className="gb-stripe" />
            <span className="gb-bug__name">Mustangs</span>
            <span className="gb-bug__runs"><Count value={s.scored ? 3 : 2} duration={650} /></span>
          </span>
          <span className="gb-bug__team gb-bug__team--away">
            <i className="gb-stripe gb-stripe--away" />
            <span className="gb-bug__name">Hawks</span>
            <span className="gb-bug__runs">1</span>
          </span>
        </div>
        <div className="gb-bug__bases">
          <Bases on={[s.scored, !s.scored, false]} className="gb-bases" />
        </div>
        <div className="gb-bug__count">
          <span className="tv-inning">
            <svg width="9" height="8" viewBox="0 0 9 8" aria-hidden><path d="M4.5 0 9 8H0Z" fill="currentColor" /></svg>
            Top 4
          </span>
          <span className="gb-bug__out">1 out</span>
        </div>
      </div>
      <div className="gb-live__line" data-hot={s.scored || undefined}>
        <States
          value={s.scored ? 'scored' : 'bat'}
          align="start"
          states={{
            bat: (
              <span className="gb-line">
                <Chip n="7" size={24} />
                <span className="gb-line__dim">Liam at bat · Maya on 2nd</span>
              </span>
            ),
            scored: (
              <span className="gb-line">
                <Chip n="12" size={24} mine />
                <b>Maya scored</b>
                <span className="gb-line__dim">Mustangs lead 3–1</span>
              </span>
            ),
          }}
        />
      </div>
      <Collapse open={s.all} reveal="drop">
        <div className="gb-live2">
          <span className="gb-live2__team">Bears</span>
          <span className="gb-live2__mid">
            <span className="gb-live2__score">
              <b>1</b>
              <Bases on={[false, true, true]} className="gb-bases" />
              <b>4</b>
            </span>
            <small>Bottom 3</small>
          </span>
          <span className="gb-live2__team gb-live2__team--home">Panthers</span>
        </div>
      </Collapse>
    </div>
  )
}

export function Games() {
  return (
    <Shell initial={GSTART} poster={{ ...GSTART, scored: true }} script={gamesScript} rest={GREST}>
      {(s) => (
        <div className="ob-page gb-games">
          <div className="gb-head">
            <div className="ob-h1">Games</div>
          </div>
          <div className="gb-search">
            <Icon name="search" size={20} />
            Search teams and fields
          </div>
          <div className="gb-seg">
            <i className="gb-seg__thumb" data-pos={s.all ? 0 : 1} />
            <span data-target="seg-all" data-on={s.all || undefined}>All</span>
            <span data-target="seg-following" data-on={!s.all || undefined}>Following</span>
          </div>

          <div className="gb-list" data-crop>
            <p className="gb-label">Today</p>
            <LiveNow s={s} />
            <Collapse open={s.all} reveal="drop">
              <div className="gb-later">
                <div className="gb-gcard"><GameRow g={LATER[0]!} sep={false} /></div>
              </div>
            </Collapse>
            <p className="gb-label">Upcoming</p>
            <GameCard rows={UPCOMING} all={s.all} />
            <p className="gb-label">Final</p>
            <GameCard rows={FINAL} all={s.all} />
          </div>

          <Tabs on="games" />
          <div className="fdx-fade" data-on={s.fade || undefined} />
        </div>
      )}
    </Shell>
  )
}

// ================= Game setup =================

type U = { hawks: boolean; btn: 'off' | 'ready' | 'busy'; fade: boolean }
const USTART: U = { hawks: false, btn: 'off', fade: false }
const UREST = { x: 330, y: 700 }

const setupScript = async (a: Act<U>) => {
  await a.wait(1700)
  // Opening the Hawks row puts the lineup screen between these two frames
  a.mark('hawks')
  await a.click({ at: 'hawks-row', x: 0.62, y: 0.5 })
  a.set({ hawks: true })
  await a.wait(900)
  a.mark('ready')
  a.set({ btn: 'ready' })
  await a.wait(1700)
  a.mark('start')
  await a.click({ at: 'start', x: 0.92, y: 0.5 })
  a.set({ btn: 'busy' })
  await a.wait(1500)
  await fadeOut(a, USTART, UREST)
}

function LineupRow({ team, navy, set, sub, target }: { team: string; navy?: boolean; set: boolean; sub: string; target?: string }) {
  return (
    <div className="gb-lrow" data-target={target}>
      <i className={`gb-stripe gb-stripe--tall${navy ? ' gb-stripe--away' : ''}`} />
      <span className="gb-lrow__text">
        <span className="gb-lrow__team">{team}</span>
        <span className="gb-lrow__sub" data-set={set || undefined}>
          <Roll>{sub}</Roll>
        </span>
      </span>
      <span className="gb-ok" data-on={set || undefined}><Icon name="check" size={14} /></span>
      <span className="gb-lrow__go"><Icon name="chevron" size={18} /></span>
    </div>
  )
}

export function GameSetup() {
  return (
    <Shell initial={USTART} poster={{ ...USTART, hawks: true, btn: 'ready' }} script={setupScript} rest={UREST}>
      {(s) => (
        <div className="ob-page gb-setup">
          <div className="gb-nav">
            <span className="ob-round"><Icon name="back" size={20} /></span>
            <div className="gb-nav__title">Game setup</div>
            <span />
          </div>

          <div className="gb-body">
            <p className="ob-label gb-first">Game</p>
            <div className="gb-card gb-kv">
              <div className="gb-kv__row"><span>Away</span><b><i className="gb-stripe" />Mustangs</b></div>
              <div className="gb-kv__row"><span>Home</span><b><i className="gb-stripe gb-stripe--away" />Hawks</b></div>
              <div className="gb-kv__row"><span>When</span><b>Sat, Nov 7 · 10:00 AM</b></div>
              <div className="gb-kv__row"><span>Field</span><b>Field 2</b></div>
              <div className="gb-kv__row"><span>Division</span><b>10U Rec</b></div>
            </div>

            <p className="ob-label">Season half</p>
            <div className="gb-seg gb-seg--half">
              <i className="gb-seg__thumb" data-pos={1} />
              <span>First half</span>
              <span data-on>Second half</span>
            </div>
            <p className="gb-note">Second half since Oct 1, so pitchers can get 9 outs a day. Change it if your league switched on another date.</p>

            <p className="ob-label">Lineups</p>
            <div className="gb-card gb-lineups">
              <LineupRow team="Mustangs" set sub="10 players · P Zoe" />
              <LineupRow team="Hawks" navy set={s.hawks} sub={s.hawks ? '10 players · P T. Nguyen' : 'Not set yet'} target="hawks-row" />
            </div>
          </div>

          <div className="gb-foot">
            <div className="gb-count"><Count value={s.hawks ? 2 : 1} duration={500} /> of 2 lineups set</div>
            <span className="ob-cta" data-target="start" data-off={s.btn === 'off' || undefined}>
              <States
                value={s.btn}
                states={{
                  off: <span className="gb-cta__in">Set both lineups to start</span>,
                  ready: <span className="gb-cta__in">Start game</span>,
                  busy: <span className="gb-cta__in"><Spinner />Starting</span>,
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

// ================= Lineup =================

const H = 46
const ORDER_START = ['noah', 'ben', 'liam', 'ava', 'maya', 'jack', 'mia', 'leo', 'zoe', 'sam']
type L = { order: string[]; lifted: string | null; dy: number; save: 'idle' | 'busy' | 'done'; fade: boolean }
const LSTART: L = { order: ORDER_START, lifted: null, dy: 0, save: 'idle', fade: false }
const LREST = { x: 330, y: 700 }
const ord = (n: number) => `${n}${['th', 'st', 'nd', 'rd'][n % 10 > 3 || Math.floor(n / 10) === 1 ? 0 : n % 10]}`

const lineupScript = async (a: Act<L>) => {
  await a.wait(1600)
  a.mark('grab')
  const grip = a.rect('grip-maya')
  const start = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 }
  await a.move(start)
  await a.wait(220)
  // One screen point is this many stage pixels (the phone is drawn at 0.794 of true size)
  const k = (a.layout === 'compact' ? 326 : 340) / 428
  let order = ORDER_START
  await a.drag(
    { x: start.x + 4, y: start.y - 2 * H * k },
    (at, from) => {
      const dy = (at.y - from.y) / k
      // The held row's middle decides the slot it is over
      const slot = Math.max(0, Math.min(ORDER_START.length - 1, Math.round((ORDER_START.indexOf('maya') * H + dy) / H)))
      const rest = ORDER_START.filter((id) => id !== 'maya')
      order = [...rest.slice(0, slot), 'maya', ...rest.slice(slot)]
      a.put({ lifted: 'maya', dy, order })
    },
    { duration: 1100 },
  )
  a.mark('drop')
  a.put({ lifted: null, dy: 0, order })
  await a.wait(1100)
  a.mark('save')
  await a.click({ at: 'save', x: 0.92, y: 0.5 })
  a.set({ save: 'busy' })
  await a.wait(800)
  a.set({ save: 'done' })
  await a.wait(1800)
  await fadeOut(a, LSTART, LREST)
}

export function Lineup() {
  return (
    <Shell initial={LSTART} poster={{ ...LSTART, order: ORDER_SET }} script={lineupScript} rest={LREST}>
      {(s) => {
        const mayaAt = s.order.indexOf('maya')
        const hint = s.lifted ? `Maya to ${ord(mayaAt + 1)}` : mayaAt === 2 ? 'Maya now bats 3rd' : 'Drag to reorder'
        return (
          <div className="ob-page gb-lineup">
            <div className="gb-nav">
              <span className="ob-round"><Icon name="back" size={20} /></span>
              <div className="gb-nav__title">Mustangs lineup</div>
              <span />
            </div>

            <div className="gb-body">
              <div className="gb-hrow">
                <span className="ob-label">Batting order</span>
                <span className="gb-hint" data-hot={(!s.lifted && mayaAt === 2) || undefined}><Roll>{hint}</Roll></span>
              </div>
              <div className="gb-card gb-order" style={{ height: ORDER_START.length * H }}>
                {ORDER_START.map((id) => {
                  const p = MUSTANGS[id]!
                  const slot = s.order.indexOf(id)
                  const lifted = s.lifted === id
                  const y = lifted ? ORDER_START.indexOf(id) * H + s.dy : slot * H
                  return (
                    <div key={id} className="gb-slot" data-lifted={lifted || undefined} style={{ transform: `translateY(${y}px)` }}>
                      <div className="gb-orow">
                        <span className="gb-num"><Count value={slot + 1} duration={420} /></span>
                        <Chip n={p.n} size={28} mine={id === 'maya'} />
                        <span className="gb-orow__name">{p.name}</span>
                        <span className="gb-pos" data-wide={p.pos.length > 2 || undefined}>{p.pos}</span>
                        <span className="gb-grip" data-target={`grip-${id}`}><Icon name="grip" size={22} /></span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="gb-hrow gb-hrow--pitcher">
                <span className="ob-label">Starting pitcher</span>
                <span className="gb-link">Change</span>
              </div>
              <div className="gb-card gb-pitcher">
                <Chip n="4" size={38} />
                <span className="gb-pitcher__text">
                  <span className="gb-pitcher__name">Zoe</span>
                  <span className="gb-pitcher__sub"><b>Fully rested</b> · 75 pitches available today</span>
                </span>
                <span className="gb-pos">P</span>
              </div>

              <span className="gb-add"><Icon name="plus" size={18} />Add a player from the roster</span>
            </div>

            <div className="gb-foot gb-foot--save">
              <span className="ob-cta" data-target="save" data-done={s.save === 'done' || undefined}>
                <States
                  value={s.save}
                  states={{
                    idle: <span className="gb-cta__in">Save lineup</span>,
                    busy: <span className="gb-cta__in"><Spinner />Saving</span>,
                    done: <span className="gb-cta__in"><Icon name="check" size={18} />Lineup saved</span>,
                  }}
                />
              </span>
            </div>
            <div className="fdx-fade" data-on={s.fade || undefined} />
          </div>
        )
      }}
    </Shell>
  )
}

// ================= Fan view before first pitch =================

type F = { open: boolean; mins: number; fade: boolean }
const FSTART: F = { open: false, mins: 25, fade: false }
const FREST = { x: 330, y: 330 }
// No scorer yet: the field is the Rec field with the Hawks where they start and nobody on base
const FIELD = { phase: 'set', liam: 0, maya: 0 } as const

const pregameScript = async (a: Act<F>) => {
  await a.wait(1500)
  // The batting order comes up from the foot of the screen, its rows sliding in
  a.mark('lineup')
  a.set({ open: true })
  await a.wait(2300)
  a.mark('count')
  a.set({ mins: 24 })
  await a.wait(1900)
  a.set({ mins: 23 })
  await a.wait(1800)
  await fadeOut(a, FSTART, FREST)
}

export function Pregame() {
  return (
    <Shell initial={FSTART} poster={{ ...FSTART, open: true, mins: 24 }} script={pregameScript} rest={FREST}>
      {(s) => (
        <div className="fd-app bp-app gb-pregame" data-variant="rec">
          <FieldLayer s={FIELD} variant="rec" />
          <header className="tv-bug gb-bug0">
            <div className="tv-teams">
              <span className="tv-team">
                <i className="tv-team__stripe" />
                <span className="tv-team__name">MUS</span>
                <span className="tv-team__runs">0</span>
              </span>
              <span className="tv-team">
                <i className="tv-team__stripe tv-team__stripe--away" />
                <span className="tv-team__name">HAW</span>
                <span className="tv-team__runs">0</span>
              </span>
            </div>
            <div className="tv-diamond">
              <Bases on={[false, false, false]} className="tv-bases" />
            </div>
            <div className="tv-count">
              <span className="tv-inning"><Icon name="clock" size={14} />10:00 AM</span>
              <span className="tv-row"><span className="tv-label">Field 2</span></span>
            </div>
          </header>

          <span className="gb-soon">
            <Icon name="clock" size={16} />
            <span>Starts in <Count value={s.mins} duration={600} /> min</span>
          </span>

          <div className="gb-sheet" data-open={s.open || undefined}>
           {/* The list runs on under the foot of the screen: a deliberate crop */}
           <div className="gb-sheet__clip" data-crop>
            <i className="gb-grab" />
            <div className="gb-sheet__head">
              <span className="gb-sheet__title">Mustangs batting order</span>
              <span className="gb-tagpill">Bats first</span>
            </div>
            <p className="gb-sheet__cap"><Icon name="info" size={15} />Lineups can change until first pitch.</p>
            <div className="gb-card gb-pcard">
              {ORDER_SET.slice(0, 5).map((id, i) => {
                const p = MUSTANGS[id]!
                const mine = id === 'maya'
                return (
                  <div key={id} className="gb-prow" data-mine={mine || undefined} style={{ '--d': `${0.2 + i * 0.07}s` } as CSSProperties}>
                    <span className="gb-pnum">{i + 1}</span>
                    <Chip n={p.n} size={28} mine={mine} />
                    <span className="gb-pname">
                      {p.name}
                      {mine && <span className="gb-follow">Following</span>}
                    </span>
                    <span className="gb-pos" data-wide={p.pos.length > 2 || undefined}>{p.pos}</span>
                  </div>
                )
              })}
            </div>
           </div>
          </div>
          <div className="fdx-fade" data-on={s.fade || undefined} />
        </div>
      )}
    </Shell>
  )
}
