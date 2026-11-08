import type { CSSProperties, ReactNode } from 'react'
import { Stage, Phone, Count, type Act } from '../../kit'
import { Bases } from '../sandlot-shared/field'
import { FieldLayer, Bug, START as YSTART, type S as YS } from '../sandlot-youth/youth'
import '../sandlot-ob/ob.css'
import '../sandlot-fan/fan.css'
import './u1.css'

// Sandlot, less like Figma. Two screens that show baseball things instead of
// app widgets:
//
//  Game day board:  the Games tab. Today's game is a little live field with
//                   the score bug on it; the next games are ticket stubs you
//                   swipe; the last games are scoreboard plates like the
//                   outfield board.
//  Before first pitch: the Rec field, the Hawks in position, and the Mustangs
//                   running out of the dugout one by one to line up along the
//                   first-base line in batting order.
//
// Player names show in the interface only; nothing here is an event or a
// stat (AGENTS.md, rule 5).

// icons.download, bold solid round
const P = {
  house: 'M2.18557 11C1.71748 11 1.50603 10.4143 1.86615 10.1153L10.7231 2.76087C11.4638 2.14579 12.5377 2.14579 13.2784 2.76087L22.1353 10.1153C22.4954 10.4143 22.284 11 21.8159 11H20.0007V20C20.0007 20.5522 19.553 21 19.0007 21H15.0007C14.4485 21 14.0007 20.5522 14.0007 20V15C14.0007 14.4477 13.553 14 13.0007 14H11.0007C10.4485 14 10.0007 14.4477 10.0007 15V20C10.0007 20.5522 9.55302 21 9.00074 21H5.00074C4.44845 21 4.00074 20.5522 4.00074 20V11H2.18557Z',
  calendar: 'M2 7C2 5.89543 2.89543 5 4 5H5.75V3.75C5.75 3.05964 6.30964 2.5 7 2.5C7.69036 2.5 8.25 3.05964 8.25 3.75V5H15.75V3.75C15.75 3.05964 16.3096 2.5 17 2.5C17.6904 2.5 18.25 3.05964 18.25 3.75V5H20C21.1046 5 22 5.89543 22 7V9H2V7ZM4 21C2.89543 21 2 20.1046 2 19V11.5H22V19C22 20.1046 21.1046 21 20 21H4Z',
  users: 'M10.75 6.75C10.75 8.82107 9.07107 10.5 7 10.5C4.92893 10.5 3.25 8.82107 3.25 6.75C3.25 4.67893 4.92893 3 7 3C9.07107 3 10.75 4.67893 10.75 6.75ZM17 10.5C19.0711 10.5 20.75 8.82107 20.75 6.75C20.75 4.67893 19.0711 3 17 3C14.9289 3 13.25 4.67893 13.25 6.75C13.25 8.82107 14.9289 10.5 17 10.5ZM16.0322 20C16.3316 19.3975 16.5 18.7184 16.5 18V16.1668C16.5 15.2303 16.2076 14.1862 15.4582 13.3321C15.1581 12.9902 14.8374 12.6665 14.498 12.363C15.2907 12.1268 16.1305 12 17 12C19.6224 12 21.9754 13.1536 23.5791 14.9811C23.8649 15.3068 24 15.7334 24 16.1668V18C24 19.1046 23.1046 20 22 20H16.0322ZM7 12C9.62239 12 11.9754 13.1536 13.5791 14.9811C13.8649 15.3068 14 15.7334 14 16.1668V18C14 19.1046 13.1046 20 12 20H2C0.895431 20 0 19.1046 0 18V16.1668C0 15.7334 0.135133 15.3068 0.420922 14.9811C2.02464 13.1536 4.37761 12 7 12Z',
  user: 'M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11ZM19.5815 16.479C19.8642 16.8074 20 17.2333 20 17.6666V19C20 20.1046 19.1046 21 18 21H6C4.89543 21 4 20.1046 4 19V17.6666C4 17.2333 4.13576 16.8074 4.41847 16.479C6.25235 14.3488 8.96866 13 12 13C15.0313 13 17.7477 14.3488 19.5815 16.479Z',
  clock: 'M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12ZM11.375 13.0825C10.9882 12.8592 10.75 12.4466 10.75 12V8.75C10.75 8.05965 11.3096 7.5 12 7.5C12.6904 7.5 13.25 8.05965 13.25 8.75V11.2783L15.8726 12.7925C16.4705 13.1376 16.6753 13.9021 16.3301 14.5C15.985 15.0979 15.2205 15.3027 14.6226 14.9575L11.375 13.0825Z',
  info: 'M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12ZM11.1739 16.95C10.8977 16.95 10.6739 16.7261 10.6739 16.45V10.5864C10.6739 10.3102 10.8977 10.0864 11.1739 10.0864H12.8202C13.0963 10.0864 13.3202 10.3102 13.3202 10.5864V16.45C13.3202 16.7261 13.0963 16.95 12.8202 16.95H11.1739ZM11.997 8.81932C11.6391 8.81932 11.3322 8.70107 11.0766 8.46456C10.8209 8.22805 10.693 7.94361 10.693 7.61122C10.693 7.27884 10.8209 6.99439 11.0766 6.75788C11.3322 6.52138 11.6391 6.40313 11.997 6.40313C12.3582 6.40313 12.665 6.52138 12.9175 6.75788C13.1731 6.99439 13.301 7.27884 13.301 7.61122C13.301 7.94361 13.1731 8.22805 12.9175 8.46456C12.665 8.70107 12.3582 8.81932 11.997 8.81932Z',
}
const Icon = ({ name, size = 20 }: { name: keyof typeof P; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><path d={P[name]} fill="currentColor" fillRule="evenodd" /></svg>
)

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

type Rest = { x: number; y: number }

function Shell<T extends object>({ initial, poster, script, rest, children }: { initial: T; poster: T; script: (a: Act<T>) => Promise<void>; rest: Rest; children: (s: T) => ReactNode }) {
  return (
    <Stage<T>
      width={440}
      height={820}
      compact={{ below: 440, width: 358, height: 690 }}
      initial={initial}
      poster={poster}
      script={script}
      cursor={{ at: { wide: rest, compact: { x: rest.x - 40, y: Math.min(rest.y, 600) } }, style: 'touch' }}
      className="fd tv bp yf ob fn u1"
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

const fadeOut = async <T extends { fade: boolean }>(a: Act<T>, start: T, rest: Rest) => {
  const fade = (on: boolean) => ({ fade: on }) as unknown as Partial<T>
  a.set(fade(true))
  await a.wait(450)
  await a.snap({ ...start, fade: true })
  await a.wait(80)
  await a.set(fade(false))
  // Back where the stage first put it, so the loop closes on the same frame it opened on
  await a.move(a.layout === 'compact' ? { x: rest.x - 40, y: Math.min(rest.y, 600) } : rest)
}

// ================= Game day board =================

type G = YS & { flag: boolean; sx: number; drag: boolean; open: boolean }
const GSTART: G = { ...YSTART, flag: false, sx: 0, drag: false, open: false }
const GREST = { x: 330, y: 560 }
// One stub and the gap after it, in screen points
const STEP = 180

const gamesScript = async (a: Act<G>) => {
  await a.wait(900)
  // Liam singles to left; Maya scores from second
  a.mark('hit')
  a.set({ phase: 'hit' })
  await a.wait(380)
  a.set({ liam: 1, maya: 4 })
  await a.wait(1070)
  a.set({ phase: 'throw' })
  await a.wait(650)
  // The run is in: the score ticks and the flag goes up
  a.mark('scored')
  a.set({ us: 3, balls: 0, strikes: 0, flag: true })
  await a.wait(2300)
  // Swipe the ticket stubs: the next games slide by
  a.mark('swipe')
  const r = a.rect('stubs')
  const from = { x: r.x + r.width * 0.84, y: r.y + r.height * 0.5 }
  await a.move(from)
  await a.wait(180)
  // One screen point is this many stage pixels
  const k = (a.layout === 'compact' ? 326 : 340) / 428
  await a.drag(
    { x: from.x - 120 * k, y: from.y },
    (at, f) => a.put({ drag: true, sx: Math.min(0, (at.x - f.x) / k) }),
    { duration: 480 },
  )
  a.put({ drag: false, sx: -STEP })
  await a.wait(1700)
  // Tap the live game: it grows to the full screen
  a.mark('open')
  await a.click({ at: 'live', x: 0.5, y: 0.66 })
  a.set({ open: true })
  await a.wait(3300)
  await fadeOut(a, GSTART, GREST)
}

const STUBS = [
  { id: 'n14', mon: 'Nov', day: '14', dow: 'Sat', vs: 'vs', opp: 'Eagles', time: '9:00 AM', field: 'Field 1' },
  { id: 'n21', mon: 'Nov', day: '21', dow: 'Sat', vs: 'at', opp: 'Giants', time: '11:00 AM', field: 'Rancho Field' },
  { id: 'd05', mon: 'Dec', day: '5', dow: 'Sat', vs: 'vs', opp: 'Panthers', time: '9:30 AM', field: 'Field 2' },
  { id: 'd12', mon: 'Dec', day: '12', dow: 'Sat', vs: 'at', opp: 'Bears', time: '10:30 AM', field: 'Field 3' },
]

const FINALS = [
  { id: 'o31', date: 'Oct 31', us: 9, them: 6, code: 'EAG' },
  { id: 'o25', date: 'Oct 24', us: 5, them: 7, code: 'GIA' },
  { id: 'o18', date: 'Oct 17', us: 11, them: 4, code: 'PAN' },
]

function Stub({ t }: { t: (typeof STUBS)[number] }) {
  return (
    <div className="u1-stub">
      <div className="u1-stub__body">
        <div className="u1-stub__date">
          <span className="u1-stub__mon">{t.mon}</span>
          <b>{t.day}</b>
          <span className="u1-stub__dow">{t.dow}</span>
        </div>
        <div className="u1-stub__info">
          <span className="u1-stub__vs">{t.vs}</span>
          <span className="u1-stub__opp">{t.opp}</span>
          <span className="u1-stub__time">{t.time}</span>
          <span className="u1-stub__field">{t.field}</span>
        </div>
      </div>
    </div>
  )
}

function Plate({ f }: { f: (typeof FINALS)[number] }) {
  const won = f.us > f.them
  return (
    <div className="u1-plate">
      <span className="u1-plate__date">{f.date}</span>
      <span className="u1-plate__row"><span className="u1-plate__code">MUS</span><b className="u1-plate__num" data-win={won || undefined}>{f.us}</b></span>
      <span className="u1-plate__row"><span className="u1-plate__code">{f.code}</span><b className="u1-plate__num" data-win={!won || undefined}>{f.them}</b></span>
    </div>
  )
}

function Chip({ n, size = 30 }: { n: string; size?: number }) {
  return <span className="fn-chip" style={{ width: size, height: size, fontSize: size * 0.43 }}>{n}</span>
}

export function Games() {
  return (
    <Shell initial={GSTART} poster={{ ...GSTART, phase: 'throw', liam: 1, maya: 4, us: 3, balls: 0, strikes: 0, flag: true }} script={gamesScript} rest={GREST}>
      {(s) => (
        <div className="ob-page u1-games">
          <div className="u1-title">
            <div className="ob-h1">Games</div>
            <span className="u1-following"><i />Following:<b>Mustangs</b></span>
          </div>

          {/* Where the live card sits; it casts the shadow, the live layer below is the card */}
          <span className="u1-slot" data-target="live" />

          <div className="u1-stubs" data-target="stubs" data-crop>
            <div className="u1-strip" data-drag={s.drag || undefined} style={{ transform: `translateX(${s.sx}px)` }}>
              {STUBS.map((t) => <Stub key={t.id} t={t} />)}
            </div>
          </div>

          <div className="u1-plates">
            {FINALS.map((f) => <Plate key={f.id} f={f} />)}
          </div>

          <Tabs on="games" />

          {/* The live game: a little field with the score bug on it. Opened, the same layer is the full screen. */}
          <div className="u1-live" data-open={s.open || undefined}>
            <div className="u1-zoom">
              <FieldLayer s={s} variant="rec" />
              <div className="u1-sheet" data-open={s.open || undefined}>
                <div className="u1-follow">
                  <Chip n="12" size={40} />
                  <span className="u1-follow__who">
                    <span className="u1-follow__name">Maya</span>
                    <span className="u1-follow__sub">Scored in the 4th</span>
                  </span>
                </div>
                <div className="u1-play" data-hot>
                  <span className="u1-play__inn">T4</span>
                  <span>Liam singles to left. <b>Maya scores!</b></span>
                  <span className="u1-play__score">3–1</span>
                </div>
                <div className="u1-play">
                  <span className="u1-play__inn">T4</span>
                  <span><b>Maya</b> doubles to center</span>
                  <span className="u1-play__score">2–1</span>
                </div>
                <div className="u1-play">
                  <span className="u1-play__inn">T4</span>
                  <span><b>Ben</b> flies out to right</span>
                  <span className="u1-play__score">2–1</span>
                </div>
              </div>
            </div>
            <Bug s={s} />
            <span className="fn-live"><i />Live</span>
            <span className="u1-flag" data-on={(s.flag && !s.open) || undefined}>
              Maya scored
            </span>
          </div>

          <div className="fdx-fade" data-on={s.fade || undefined} />
        </div>
      )}
    </Shell>
  )
}

// ================= Before first pitch, on the field =================

// The Mustangs in batting order (Maya bats 3rd). The first to run out goes to the far end of the line.
const LINEUP = [
  { n: '9', name: 'Noah' },
  { n: '15', name: 'Ben' },
  { n: '12', name: 'Maya', mine: true },
  { n: '7', name: 'Liam' },
  { n: '3', name: 'Ava' },
  { n: '22', name: 'Jack' },
  { n: '5', name: 'Mia' },
  { n: '18', name: 'Leo' },
  { n: '4', name: 'Zoe' },
]

// The 400 box the field is drawn in, and the scale it is laid out at
const K = 1.4
const k = (n: number) => +(n * K).toFixed(2)
const HOME = { x: 200, y: 330 }
// The first-base line runs from home toward the right-field corner. The Mustangs stand in two
// staggered files along it, just on the foul side, so every name pill stays clear of the next chip.
const U = { x: Math.SQRT1_2, y: -Math.SQRT1_2 }
const N = { x: Math.SQRT1_2, y: Math.SQRT1_2 }
const DUGOUT = { x: 306, y: 338 }
const spot = (i: number) => {
  const s = 262 - i * 29
  const o = 8 + (i % 2) * 36
  return { x: HOME.x + U.x * s + N.x * o, y: HOME.y + U.y * s + N.y * o }
}

type F = { out: number; glow: boolean; mins: number; fade: boolean }
const FSTART: F = { out: 0, glow: false, mins: 25, fade: false }
const FREST = { x: 330, y: 330 }
// No scorer yet: the Rec field with the Hawks where they start and nobody on base
const FIELD = { phase: 'set', liam: 0, maya: 0 } as const

const pregameScript = async (a: Act<F>) => {
  await a.wait(1200)
  // The Mustangs come out of the dugout one at a time, in batting order
  a.mark('run')
  for (let i = 0; i < LINEUP.length; i++) {
    a.set({ out: i + 1 })
    await a.wait(i === 2 ? 520 : 440)
  }
  await a.wait(900)
  // Maya's chip: the one a parent follows
  a.mark('glow')
  a.set({ glow: true })
  await a.wait(1300)
  a.mark('count')
  a.set({ mins: 24 })
  await a.wait(2300)
  await fadeOut(a, FSTART, FREST)
}

// Trees past the right-field corner, where the fence ends and the camera now looks
const TREES = [
  { x: 392, y: 28, size: 92, tone: 2 },
  { x: 430, y: 52, size: 84, tone: 0 },
  { x: 452, y: 84, size: 78, tone: 1 },
  { x: 418, y: 90, size: 66, tone: 2 },
  { x: 470, y: 122, size: 70, tone: 0 },
  { x: 346, y: 8, size: 88, tone: 1 },
  { x: 410, y: -22, size: 104, tone: 0 },
  { x: 450, y: -6, size: 100, tone: 2 },
  { x: 490, y: 16, size: 96, tone: 1 },
  { x: 520, y: 52, size: 92, tone: 0 },
  { x: 372, y: -30, size: 100, tone: 2 },
]

function ExtraTrees() {
  return (
    <>
      {TREES.map((tr, i) => (
        <span key={i} className="yf-tree" data-tone={tr.tone} style={{ transform: `translate3d(${k(tr.x)}px, ${k(tr.y)}px, 0)` }}>
          <span className="yf-tree__art" style={{ width: tr.size, height: tr.size * 1.1, marginLeft: -tr.size / 2 }}>
            <i /><i /><i /><b />
          </span>
        </span>
      ))}
    </>
  )
}

function Lineup({ out, glow }: { out: number; glow: boolean }) {
  return (
    <>
      {LINEUP.map((p, i) => {
        const out_ = i < out
        const to = spot(i)
        const at = out_ ? to : DUGOUT
        const dist = Math.hypot(to.x - DUGOUT.x, to.y - DUGOUT.y) * K
        return (
          <span
            key={p.n}
            className="bp-fielder u1-lu"
            data-out={out_ || undefined}
            data-mine={p.mine || undefined}
            data-glow={(p.mine && glow) || undefined}
            style={{ transform: `translate3d(${k(at.x)}px, ${k(at.y)}px, 0)`, transitionDuration: out_ ? `${Math.round(300 + dist * 2.6)}ms` : '0ms', '--u1-hops': Math.max(2, Math.round((300 + dist * 2.6) / 340)) } as CSSProperties}
          >
            <span className="bp-shadow" />
            <span className="bp-stand">
              <span className="bp-runner__chip u1-lu__chip">{p.n}</span>
              <span className="bp-runner__name"><b>{i + 1}</b>{p.name}</span>
            </span>
          </span>
        )
      })}
    </>
  )
}

export function Pregame() {
  return (
    <Shell initial={FSTART} poster={{ ...FSTART, out: 9, glow: true, mins: 24 }} script={pregameScript} rest={FREST}>
      {(s) => (
        <div className="fd-app bp-app u1-pre" data-variant="rec">
          <FieldLayer s={FIELD} variant="rec" extra={<><ExtraTrees /><i className="u1-dugout"><i className="u1-dugout__in" /><span className="u1-dugout__wall">Mustangs</span><i className="u1-dugout__roof" /></i><Lineup out={s.out} glow={s.glow} /></>} />
          <header className="tv-bug u1-bug0">
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

          <div className="u1-pennant">
            <i className="u1-pennant__pole" />
            <span className="u1-pennant__flag">
              <span>Starts in</span>
              <Count value={s.mins} duration={600} />
              <span>min</span>
            </span>
          </div>

          <span className="u1-note"><Icon name="info" size={15} />Lineups can change until first pitch.</span>
          <div className="fdx-fade" data-on={s.fade || undefined} />
        </div>
      )}
    </Shell>
  )
}
