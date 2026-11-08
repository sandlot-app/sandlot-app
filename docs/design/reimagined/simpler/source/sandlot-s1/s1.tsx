import type { ReactNode } from 'react'
import { Stage, Phone, Roll, States, Count, Spinner, type Act } from '../../kit'
import { FieldLayer } from '../sandlot-youth/youth'
import './s1.css'

// Group s1: two after-the-game screens, made simpler.
//
//  Box score, simple:  plain sentences instead of the seven-column tables.
//                      Maya first (the player Christian follows), then what
//                      happened for everyone else. Pitching is one line and
//                      one bar. The dense table is one quiet link away.
//  End of game, simple: one card, one button. The last out is recorded, the
//                      card says so, and "Finish and share" closes the book
//                      with no confirm sheet.
//
// Same Saturday: Mustangs 7, Hawks 4 after six innings. Player names show in
// the interface only (AGENTS.md, rule 5); the Hawks are shown by number.

// icons.download, bold solid round
const P = {
  back: 'M8.00096 15.2322L6.01874 13.25H20.751C21.4413 13.25 22.001 12.6904 22.001 12C22.001 11.3097 21.4413 10.75 20.751 10.75H6.01874L8.00096 8.76779C8.48912 8.27964 8.48912 7.48818 8.00096 7.00003C7.5128 6.51187 6.72135 6.51187 6.23319 7.00003L2.11709 11.1161C1.62894 11.6043 1.62894 12.3958 2.11709 12.8839L6.23319 17C6.72135 17.4882 7.5128 17.4882 8.00096 17C8.48911 16.5119 8.48911 15.7204 8.00096 15.2322Z',
  check: 'M21.1554 7.12211C21.4772 6.6379 21.4258 5.97839 20.9999 5.54996C20.5133 5.06032 19.7218 5.05792 19.2322 5.54459L8.97695 15.7378L4.76769 11.5561C4.27794 11.0695 3.48649 11.0721 2.99994 11.5619C2.76566 11.7977 2.64479 12.1035 2.63711 12.4115C2.63657 12.4333 2.63659 12.4551 2.63718 12.4769C2.64559 12.7867 2.76852 13.094 3.00574 13.3296L8.09619 18.3867C8.58376 18.8711 9.37092 18.871 9.85837 18.3865L20.9946 7.31772C21.0558 7.25688 21.1094 7.19129 21.1554 7.12211Z',
  checkCircle: 'M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12ZM16.5001 8.99997C16.9883 9.48813 16.9883 10.2796 16.5001 10.7677L11.884 15.3839C11.3958 15.872 10.6044 15.872 10.1162 15.3839L8.0001 13.2677C7.51194 12.7796 7.51194 11.9881 8.0001 11.5C8.48825 11.0118 9.27971 11.0118 9.76787 11.5L11.0001 12.7322L14.7323 8.99997C15.2205 8.51182 16.0119 8.51182 16.5001 8.99997Z',
  share: 'M22.2932 11.2929C22.6838 11.6834 22.6838 12.3166 22.2932 12.7071L14.7075 20.2929C14.0775 20.9229 13.0003 20.4767 13.0003 19.5858V16C8.84027 16 5.73573 16.8017 3.21353 18.6606C2.34637 19.2997 0.835845 18.5228 1.18803 17.5048C2.88164 12.6092 6.12584 8.00002 13.0003 8.00002L13.0003 4.41424C13.0003 3.52333 14.0775 3.07716 14.7075 3.70713L22.2932 11.2929Z',
  caret: 'M10.0038 15.2323L13.236 12L10.0038 8.7678C9.51566 8.27964 9.51566 7.48818 10.0038 7.00003C10.492 6.51187 11.2834 6.51187 11.7716 7.00003L15.8877 11.1161C16.1221 11.3506 16.2538 11.6685 16.2538 12C16.2538 12.3316 16.1221 12.6495 15.8877 12.8839L11.7716 17C11.7106 17.061 11.6448 17.1144 11.5755 17.1602C11.0903 17.4806 10.4309 17.4272 10.0038 17C9.94279 16.939 9.8894 16.8733 9.84364 16.8039C9.52329 16.3187 9.57668 15.6594 10.0038 15.2323Z',
}
type IconName = keyof typeof P
const Icon = ({ name, size = 20 }: { name: IconName; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path d={P[name]} fill="currentColor" fillRule="evenodd" />
  </svg>
)

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
      className={`fd tv bp yf s1 ${tag}`}
    >
      {(s, _rect, layout) => (
        <>
          <div className="s1-wash" />
          <Phone width={layout === 'compact' ? 326 : 340} className="s1-phone">
            {children(s)}
          </Phone>
        </>
      )}
    </Stage>
  )
}

// ================================================================= Box score, simple

type B = { team: 'mus' | 'haw'; go: boolean; fade: boolean }
const BSTART: B = { team: 'mus', go: false, fade: false }
const BPOSTER: B = { team: 'mus', go: true, fade: false }
const BREST = { x: 330, y: 700 }

const boxScript = async (a: Act<B>) => {
  await a.wait(250)
  // The lines rise in and Maya's counts up
  a.mark('lines')
  a.set({ go: true })
  await a.wait(3000)
  a.mark('hawks')
  await a.click('t-haw')
  a.set({ team: 'haw' })
  await a.wait(2800)
  a.mark('back')
  await a.click('t-mus')
  a.set({ team: 'mus' })
  await a.wait(2200)
  a.set({ fade: true })
  await a.wait(450)
  await a.snap({ ...BSTART, fade: true })
  await a.wait(80)
  a.set({ fade: false })
  await a.move(BREST)
}

/** One plain line: who, then what happened. `t` is the team's tone: the Hawks' numbers are navy. */
function Line({ who, what, i, away }: { who: string; what: string; i: number; away?: boolean }) {
  return (
    <div className="s1-line" style={{ ['--i' as string]: i }}>
      <b data-away={away || undefined}>{who}</b>
      <i>·</i>
      <span>{what}</span>
    </div>
  )
}

/** Pitching in one line and one bar: "Ben · 58 of 75 pitches · won" */
function Arm({ who, p, tag, i, on, away }: { who: string; p: number; tag?: 'won' | 'lost'; i: number; on: boolean; away?: boolean }) {
  const pct = Math.round((p / 75) * 100)
  return (
    <div className="s1-arm" style={{ ['--i' as string]: i }}>
      <div className="s1-arm__line">
        <b data-away={away || undefined}>{who}</b>
        <i>·</i>
        <span>{p} of 75 pitches</span>
        {tag && (
          <>
            <i>·</i>
            <em data-tag={tag}>{tag}</em>
          </>
        )}
      </div>
      <span className="s1-bar">
        <u data-warn={pct >= 85 || undefined} style={{ ['--p' as string]: on ? pct : 0 }} />
      </span>
    </div>
  )
}

// Only what happened, most first. A kid with one quiet hit is just "1-for-3".
const MUS: [string, string][] = [
  ['Liam', '2-for-4, 2 RBIs, a run'],
  ['Ben', '1-for-3, a walk, an RBI'],
  ['Leo', '1-for-3, an RBI'],
  ['Jack', '1-for-4, a run'],
  ['Ava', '1-for-3, a walk, an RBI, a run'],
  ['Noah', '1-for-3'],
  ['Mia and Zoe', '0-for-3, a walk each'],
]
const HAW: [string, string][] = [
  ['#14', '2-for-3, an RBI, a run'],
  ['#3', '1-for-3, an RBI, a run'],
  ['#8', '1-for-3, a walk, a run'],
  ['#21', '1-for-3, an RBI'],
  ['#5', '1-for-3, a run'],
  ['#17', '0-for-3, a walk'],
  ['#26', '0-for-3, a walk'],
  ['#11 and #30', '0-for-3'],
]

export function BoxSimple() {
  return (
    <Shell<B> initial={BSTART} poster={BPOSTER} script={boxScript} rest={BREST} tag="s1-box">
      {(s) => {
        const mus = s.team === 'mus' && s.go
        const haw = s.team === 'haw' && s.go
        return (
          <div className="s1-app">
            <div className="s1-nav">
              <span className="s1-round"><Icon name="back" size={20} /></span>
              <span className="s1-nav__stack">
                <span className="s1-nav__big">Box score</span>
                <span className="s1-nav__small">Final · Mustangs 7, Hawks 4</span>
              </span>
              <span className="s1-round"><Icon name="share" size={20} /></span>
            </div>

            <div className="s1-box">
              <div className="s1-seg">
                <i className="s1-seg__thumb" data-team={s.team} />
                <span data-target="t-mus" data-on={s.team === 'mus' || undefined}><i className="s1-seg__stripe" />Mustangs</span>
                <span data-target="t-haw" data-on={s.team === 'haw' || undefined}><i className="s1-seg__stripe s1-seg__stripe--away" />Hawks</span>
              </div>

              <p className="s1-label">Batting</p>
              <div className="s1-card s1-bat" data-team={s.team}>
                <div className="s1-stack">
                  <div className="s1-pane" data-on={mus || undefined}>
                    <div className="s1-me s1-line" style={{ ['--i' as string]: 0 }}>
                      <span className="s1-chip">12</span>
                      <span className="s1-me__text">
                        <span className="s1-me__top">
                          <b>Maya</b>
                          <em><Icon name="check" size={12} />Following</em>
                        </span>
                        <span className="s1-me__what">
                          <Count value={s.go ? 2 : 0} duration={900} />-for-<Count value={s.go ? 3 : 0} duration={900} />, a double, <Count value={s.go ? 2 : 0} duration={900} /> runs, an RBI
                        </span>
                      </span>
                    </div>
                    {MUS.map(([who, what], n) => <Line key={who} who={who} what={what} i={n + 1} />)}
                  </div>
                  <div className="s1-pane" data-on={haw || undefined}>
                    {HAW.map(([who, what], n) => <Line key={who} who={who} what={what} i={n} away />)}
                  </div>
                </div>
              </div>

              <p className="s1-label">Pitching</p>
              <div className="s1-card s1-pit">
                <div className="s1-stack">
                  <div className="s1-pane" data-on={mus || undefined}>
                    <Arm who="Ben" p={58} tag="won" i={4} on={mus} />
                    <Arm who="Leo" p={29} i={5} on={mus} />
                  </div>
                  <div className="s1-pane" data-on={haw || undefined}>
                    <Arm who="#21" p={66} tag="lost" i={4} on={haw} away />
                    <Arm who="#14" p={31} i={5} on={haw} away />
                  </div>
                </div>
              </div>

              <span className="s1-rise s1-full" style={{ ['--d' as string]: 6 }} data-in={s.go || undefined}>Full table<Icon name="caret" size={16} /></span>
            </div>
            <div className="fdx-fade" data-on={s.fade || undefined} />
          </div>
        )
      }}
    </Shell>
  )
}

// ================================================================= End of game, simple

type C = { card: boolean; stage: 'sending' | 'ready' | 'closing' | 'closed'; fade: boolean }
const CSTART: C = { card: false, stage: 'sending', fade: false }
const CPOSTER: C = { card: true, stage: 'closed', fade: false }
const CREST = { x: 330, y: 420 }

const closeScript = async (a: Act<C>) => {
  await a.wait(350)
  // The last out is in: the card rises over the field
  a.mark('out')
  a.set({ card: true })
  await a.wait(2600)
  // The last play reaches the server: the button wakes itself up
  a.mark('saved')
  a.set({ stage: 'ready' })
  await a.wait(1500)
  a.mark('finish')
  await a.click('finish')
  a.set({ stage: 'closing' })
  await a.wait(1000)
  a.mark('closed')
  a.set({ stage: 'closed' })
  await a.wait(3000)
  a.set({ fade: true })
  await a.wait(450)
  await a.snap({ ...CSTART, fade: true })
  await a.wait(80)
  a.set({ fade: false })
  await a.move(CREST)
}

const FIELD_AT_FINAL = { phase: 'set' as const, liam: 0, maya: 0 }

/** The TV score bug at Final: no bases, no count, the inning slot says Final */
function FinalBug() {
  return (
    <header className="tv-bug s1-bug">
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
      <div className="tv-count s1-bug__final">
        <span className="s1-bug__word">Final</span>
        <span className="s1-bug__sub">6 innings</span>
      </div>
    </header>
  )
}

const Spin = () => <Spinner size={20} />

// A few paper scraps in the team colors, thrown once when the card arrives
const SCRAPS: [number, number, string, number, number][] = [
  // left, delay (ms), color, rotation, drift
  [6, 0, '#ff7519', 220, 18], [14, 140, '#f4c430', -160, -14], [22, 60, '#ffffff', 300, 22], [30, 260, '#25447e', -240, 12],
  [38, 100, '#2fb862', 180, -20], [46, 320, '#ff7519', -300, 16], [54, 40, '#f4c430', 260, -12], [62, 220, '#ffffff', -180, 20],
  [70, 120, '#25447e', 320, -18], [78, 300, '#ff7519', -220, 14], [86, 20, '#2fb862', 200, -16], [94, 180, '#f4c430', -280, 18],
  [10, 380, '#25447e', 240, -10], [26, 460, '#ff7519', -200, 14], [42, 420, '#ffffff', 280, -22], [58, 500, '#2fb862', -260, 10],
  [74, 440, '#f4c430', 210, 16], [90, 360, '#ff7519', -310, -14],
]

export function CloseSimple() {
  return (
    <Shell<C> initial={CSTART} poster={CPOSTER} script={closeScript} rest={CREST} tag="s1-close">
      {(s) => {
        const closed = s.stage === 'closed'
        return (
          <div className="s1-app">
            <FieldLayer s={FIELD_AT_FINAL} variant="rec" />
            <FinalBug />

            <div className="s1-scraps" data-on={s.card || undefined} aria-hidden>
              {SCRAPS.map(([x, d, c, r, dx], i) => (
                <i key={i} style={{ ['--x' as string]: `${x}%`, ['--d' as string]: `${d}ms`, ['--c' as string]: c, ['--r' as string]: `${r}deg`, ['--dx' as string]: `${dx}px`, ['--w' as string]: `${7 + (i % 3) * 2}px` }} />
              ))}
            </div>

            <div className="s1-end" data-open={s.card || undefined} data-closed={closed || undefined}>
              <span className="s1-end__green" />
              <States
                value={closed ? 'closed' : 'open'}
                align="start"
                className="s1-end__words"
                states={{
                  open: (
                    <span className="s1-words">
                      <span className="s1-h">That’s the game!</span>
                      <span className="s1-h2">Mustangs win 7–4</span>
                      <span className="s1-p">The box score becomes official and families get the recap.</span>
                    </span>
                  ),
                  closed: (
                    <span className="s1-words">
                      <span className="s1-h"><span className="s1-badge"><Icon name="check" size={18} /></span>Book closed</span>
                      <span className="s1-h2">Recap sent to 23 families</span>
                      <span className="s1-p">The box score is official. Maya’s stat card is ready when you are.</span>
                    </span>
                  ),
                }}
              />

              <span className="s1-btn" data-target="finish" data-wait={s.stage === 'sending' || undefined}>
                <States
                  value={s.stage}
                  states={{
                    sending: <span className="s1-btn__in"><Spin />Saving the last play…</span>,
                    ready: <span className="s1-btn__in">Finish and share</span>,
                    closing: <span className="s1-btn__in"><Spin />Finishing…</span>,
                    closed: <span className="s1-btn__in"><Icon name="share" size={20} />Share Maya’s stat card</span>,
                  }}
                />
              </span>

              <span className="s1-link">
                <Roll variant="fade">{closed ? 'See the box score' : 'Fix a play first'}</Roll>
              </span>
            </div>
            <div className="fdx-fade" data-on={s.fade || undefined} />
          </div>
        )
      }}
    </Shell>
  )
}
