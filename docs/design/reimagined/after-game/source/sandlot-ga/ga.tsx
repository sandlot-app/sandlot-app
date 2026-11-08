import type { ReactNode } from 'react'
import { Stage, Phone, Roll, States, Count, type Act } from '../../kit'
import { Wordmark } from '../sandlot-ob/ob'
import { FieldLayer } from '../sandlot-youth/youth'
import './ga.css'

// After the game, in the Field Day direction. Four screens, one Saturday:
// Mustangs 7, Hawks 4 after six innings.
//
//  Close the book:  the scorer's Final screen. The book can't close while a
//                   play is still sending; then a confirm sheet, then a green
//                   "Book closed" with the stat card one tap away.
//  Fan summary:     what a parent opens after the last out. Maya's line first,
//                   the recap teaser, the linescore and the pitchers.
//  Recap + share:   the story written from the scorebook, and the stat card
//                   for Maya that slides up from Share.
//  Box score:       both teams, one toggle. Our kids by name, the Hawks by
//                   number, pitch counts against the 10U daily limit.
//
// Player names show in the interface only (AGENTS.md, rule 5); the Hawks are
// shown by number, because Sandlot only names its own kids.

// ---------------------------------------------------------------- icons
// icons.download, bold solid round
const P = {
  back: 'M8.00096 15.2322L6.01874 13.25H20.751C21.4413 13.25 22.001 12.6904 22.001 12C22.001 11.3097 21.4413 10.75 20.751 10.75H6.01874L8.00096 8.76779C8.48912 8.27964 8.48912 7.48818 8.00096 7.00003C7.5128 6.51187 6.72135 6.51187 6.23319 7.00003L2.11709 11.1161C1.62894 11.6043 1.62894 12.3958 2.11709 12.8839L6.23319 17C6.72135 17.4882 7.5128 17.4882 8.00096 17C8.48911 16.5119 8.48911 15.7204 8.00096 15.2322Z',
  check: 'M21.1554 7.12211C21.4772 6.6379 21.4258 5.97839 20.9999 5.54996C20.5133 5.06032 19.7218 5.05792 19.2322 5.54459L8.97695 15.7378L4.76769 11.5561C4.27794 11.0695 3.48649 11.0721 2.99994 11.5619C2.76566 11.7977 2.64479 12.1035 2.63711 12.4115C2.63657 12.4333 2.63659 12.4551 2.63718 12.4769C2.64559 12.7867 2.76852 13.094 3.00574 13.3296L8.09619 18.3867C8.58376 18.8711 9.37092 18.871 9.85837 18.3865L20.9946 7.31772C21.0558 7.25688 21.1094 7.19129 21.1554 7.12211Z',
  checkCircle: 'M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12ZM16.5001 8.99997C16.9883 9.48813 16.9883 10.2796 16.5001 10.7677L11.884 15.3839C11.3958 15.872 10.6044 15.872 10.1162 15.3839L8.0001 13.2677C7.51194 12.7796 7.51194 11.9881 8.0001 11.5C8.48825 11.0118 9.27971 11.0118 9.76787 11.5L11.0001 12.7322L14.7323 8.99997C15.2205 8.51182 16.0119 8.51182 16.5001 8.99997Z',
  lock: 'M7 9V6C7 3.23858 9.23858 1 12 1C14.7614 1 17 3.23858 17 6V9H19C20.1046 9 21 9.89543 21 11V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V11C3 9.89543 3.89543 9 5 9H7ZM12 3.5C13.3807 3.5 14.5 4.61929 14.5 6V9H9.5V6C9.5 4.61929 10.6193 3.5 12 3.5ZM12 16.75C12.9665 16.75 13.75 15.9665 13.75 15C13.75 14.0335 12.9665 13.25 12 13.25C11.0335 13.25 10.25 14.0335 10.25 15C10.25 15.9665 11.0335 16.75 12 16.75Z',
  share: 'M22.2932 11.2929C22.6838 11.6834 22.6838 12.3166 22.2932 12.7071L14.7075 20.2929C14.0775 20.9229 13.0003 20.4767 13.0003 19.5858V16C8.84027 16 5.73573 16.8017 3.21353 18.6606C2.34637 19.2997 0.835845 18.5228 1.18803 17.5048C2.88164 12.6092 6.12584 8.00002 13.0003 8.00002L13.0003 4.41424C13.0003 3.52333 14.0775 3.07716 14.7075 3.70713L22.2932 11.2929Z',
  close: 'M17.3049 4.92886C17.7931 4.44071 18.5845 4.4407 19.0727 4.92886C19.5608 5.41701 19.5608 6.20847 19.0727 6.69662L13.7694 11.9999L19.0727 17.3032C19.5608 17.7914 19.5608 18.5829 19.0727 19.071C18.5845 19.5592 17.7931 19.5592 17.3049 19.071L12.0016 13.7677L6.69834 19.071C6.21018 19.5591 5.41872 19.5591 4.93057 19.071C4.44241 18.5828 4.44241 17.7913 4.93057 17.3032L10.2338 11.9999L4.93057 6.69667C4.44242 6.20852 4.44242 5.41706 4.93057 4.92891C5.41873 4.44075 6.21018 4.44076 6.69834 4.92891L12.0016 10.2322L17.3049 4.92886Z',
  download: 'M15.2411 9.9999L13.2589 11.9821V3.24988C13.2589 2.55952 12.6993 1.99988 12.0089 1.99988C11.3185 1.99988 10.7589 2.55952 10.7589 3.24988V11.9821L8.77665 9.99987C8.2885 9.51171 7.49704 9.51171 7.00888 9.99987C6.52073 10.488 6.52073 11.2795 7.00888 11.7676L11.125 15.8838C11.3594 16.1182 11.6774 16.2499 12.0089 16.2499C12.3404 16.2499 12.6584 16.1182 12.8928 15.8838L17.0089 11.7677C17.497 11.2795 17.497 10.4881 17.0089 9.9999C16.5207 9.51175 15.7293 9.51175 15.2411 9.9999ZM20.0088 13.9999C19.3184 13.9999 18.7588 14.5596 18.7588 15.2499V18.7499H5.25879V15.2499C5.25879 14.5596 4.69915 13.9999 4.00879 13.9999C3.31843 13.9999 2.75879 14.5596 2.75879 15.2499V18.9999C2.75879 20.2426 3.76615 21.2499 5.00879 21.2499H19.0088C20.2514 21.2499 21.2588 20.2426 21.2588 18.9999V15.2499C21.2588 14.5596 20.6991 13.9999 20.0088 13.9999Z',
  caret: 'M10.0038 15.2323L13.236 12L10.0038 8.7678C9.51566 8.27964 9.51566 7.48818 10.0038 7.00003C10.492 6.51187 11.2834 6.51187 11.7716 7.00003L15.8877 11.1161C16.1221 11.3506 16.2538 11.6685 16.2538 12C16.2538 12.3316 16.1221 12.6495 15.8877 12.8839L11.7716 17C11.7106 17.061 11.6448 17.1144 11.5755 17.1602C11.0903 17.4806 10.4309 17.4272 10.0038 17C9.94279 16.939 9.8894 16.8733 9.84364 16.8039C9.52329 16.3187 9.57668 15.6594 10.0038 15.2323Z',
  book: 'M10.75 5.65625C10.75 4.77864 10.0042 4 9 4H3.5C2.39543 4 1.5 4.89543 1.5 6V18C1.5 19.1046 2.39543 20 3.5 20H9C9.5593 20 10.0573 20.3461 10.3777 20.825C10.7615 21.3989 11.3096 22 12 22C12.6904 22 13.2385 21.3989 13.6223 20.825C13.9427 20.3461 14.4407 20 15 20H20.5C21.6046 20 22.5 19.1046 22.5 18V6C22.5 4.89543 21.6046 4 20.5 4H15C13.9958 4 13.25 4.77864 13.25 5.65625V17.25C13.25 17.9404 12.6904 18.5 12 18.5C11.3096 18.5 10.75 17.9404 10.75 17.25V5.65625Z',
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
      className={`fd tv bp yf ob ga ${tag}`}
    >
      {(s, _rect, layout) => (
        <>
          <div className="ga-wash" />
          <Phone width={layout === 'compact' ? 326 : 340} className="ga-phone">
            {children(s)}
          </Phone>
        </>
      )}
    </Stage>
  )
}

// ---------------------------------------------------------------- the game
// Mustangs 7, Hawks 4, six innings. The Mustangs bat first.
const INNINGS = [
  { id: 'MUS', runs: [0, 1, 1, 1, 2, 2], r: 7, h: 9, e: 1 },
  { id: 'HAW', runs: [0, 1, 0, 1, 1, 1], r: 4, h: 6, e: 2 },
]

function Chip({ n, size = 30 }: { n: string; size?: number }) {
  return (
    <span className="ga-chip" style={{ width: size, height: size, fontSize: size * 0.43 }}>
      {n}
    </span>
  )
}

/** The TV score bug at Final: no bases, no count, the inning slot says Final */
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

/** Linescore by inning, with R H E. With `go` off the totals read 0 and roll up when it turns on. */
function Linescore({ go = true }: { go?: boolean }) {
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
      {INNINGS.map((t) => (
        <div key={t.id} className="ga-ls__row">
          <span className="ga-ls__team"><i data-away={t.id === 'HAW' || undefined} />{t.id}</span>
          {t.runs.map((n, i) => <span key={i} className="ga-ls__in" data-zero={n === 0 || undefined}>{n}</span>)}
          <span />
          <span className="ga-ls__r"><Count value={go ? t.r : 0} duration={900} /></span>
          <span className="ga-ls__x"><Count value={go ? t.h : 0} duration={900} /></span>
          <span className="ga-ls__x"><Count value={go ? t.e : 0} duration={900} /></span>
        </div>
      ))}
    </div>
  )
}

// ================================================================= Close the book

type C = { stage: 'sending' | 'ready' | 'confirm' | 'closing' | 'closed'; fade: boolean }
const CSTART: C = { stage: 'sending', fade: false }
const CPOSTER: C = { stage: 'closed', fade: false }
const CREST = { x: 330, y: 330 }

const closeScript = async (a: Act<C>) => {
  await a.wait(2200)
  // The last play reaches the server: the pill turns, the button wakes up
  a.mark('saved')
  a.set({ stage: 'ready' })
  await a.wait(1400)
  a.mark('close')
  await a.click('close')
  a.set({ stage: 'confirm' })
  await a.wait(2300)
  a.mark('confirm')
  await a.click('confirm')
  a.set({ stage: 'closing' })
  await a.wait(950)
  a.mark('closed')
  a.set({ stage: 'closed' })
  await a.wait(2800)
  a.set({ fade: true })
  await a.wait(450)
  await a.snap({ ...CSTART, fade: true })
  await a.wait(80)
  a.set({ fade: false })
  await a.move(CREST)
}

const FIELD_AT_FINAL = { phase: 'set' as const, liam: 0, maya: 0 }

export function CloseBook() {
  return (
    <Shell<C> initial={CSTART} poster={CPOSTER} script={closeScript} rest={CREST} tag="ga-close">
      {(s) => {
        const sending = s.stage === 'sending'
        const closed = s.stage === 'closed'
        const sheet = s.stage === 'confirm' || s.stage === 'closing'
        return (
          <div className="ga-app">
            <FieldLayer s={FIELD_AT_FINAL} variant="rec" />
            <FinalBug />

            <div className="ga-panel">
              <span className="ga-kick"><Roll>{closed ? 'Official box score' : 'Check the book'}</Roll></span>
              <div className="ga-title">Mustangs win 7–4</div>
              <span className="ga-meta">Sat, Nov 7 · 10U Rec · Field 2</span>

              <div className="ga-gap" />
              <Linescore />

              <div className="ga-gap" />
              <div className="ga-status">
                <States
                  value={closed ? 'closed' : 'check'}
                  align="start"
                  states={{
                    check: (
                      <div className="ga-checkblock">
                        <span className="ga-pill" data-tone={sending ? 'wait' : 'ok'}>
                          <States
                            value={sending ? 'sending' : 'saved'}
                            states={{
                              sending: <span className="ga-pill__in"><span className="ga-spin" />1 play still sending</span>,
                              saved: <span className="ga-pill__in"><Icon name="check" size={14} />All plays saved</span>,
                            }}
                          />
                        </span>
                        <span className="ga-help">
                          <States
                            value={sending ? 'sending' : 'saved'}
                            align="start"
                            states={{
                              sending: <span>Close the book unlocks when every play has saved.</span>,
                              saved: <span>Fix any play that’s wrong, then close the book. After that, this game can’t be changed.</span>,
                            }}
                          />
                        </span>
                      </div>
                    ),
                    closed: (
                      <div className="ga-closed">
                        <span className="ga-closed__badge"><Icon name="checkCircle" size={30} /></span>
                        <span className="ga-closed__text">
                          <span className="ga-closed__title">Book closed</span>
                          <span className="ga-closed__sub">Sat, Nov 7 · 10:46 AM. The box score and stats are official.</span>
                        </span>
                      </div>
                    ),
                  }}
                />
              </div>

              <div className="ga-gap ga-gap--s" />
              <span className="ga-btn ga-btn--primary" data-target="close" data-ready={!sending || undefined}>
                <States
                  value={closed ? 'share' : 'close'}
                  states={{
                    close: <span className="ga-btn__in"><Icon name="lock" size={20} />Close the book</span>,
                    share: <span className="ga-btn__in"><Icon name="share" size={20} />Share the stat card</span>,
                  }}
                />
              </span>
              <span className="ga-btn ga-btn--ghost">
                <States
                  value={closed ? 'view' : 'fix'}
                  states={{
                    fix: <span className="ga-btn__in">Fix a play</span>,
                    view: <span className="ga-btn__in">View box score</span>,
                  }}
                />
              </span>
            </div>

            <div className="ga-scrim" data-on={sheet || undefined} />
            <div className="ga-confirm" data-open={sheet || undefined}>
              <div className="ga-confirm__top">
                <span className="ga-confirm__title">Close the book</span>
                <span className="ga-confirm__cancel">Cancel</span>
              </div>
              <p className="ga-confirm__lead">Check the summary. Closing can’t be undone.</p>
              <div className="ga-sumcard">
                <span className="ga-sumcard__row"><span>Final</span><b>Mustangs 7, Hawks 4</b></span>
                <span className="ga-sumcard__row"><span>Plays recorded</span><b>96</b></span>
                <span className="ga-sumcard__row"><span>Plays fixed</span><b>2</b></span>
                <span className="ga-sumcard__row"><span>Uploaded</span><b className="ga-ok"><Icon name="check" size={14} />All 96 plays</b></span>
              </div>
              <p className="ga-confirm__note">The box score and stats become official, and plays can’t be fixed after this.</p>
              <span className="ga-btn ga-btn--primary" data-ready data-target="confirm">
                <States
                  value={s.stage === 'closing' ? 'busy' : 'idle'}
                  states={{
                    idle: <span className="ga-btn__in">Close the book</span>,
                    busy: <span className="ga-btn__in"><span className="ga-spin ga-spin--white" />Closing</span>,
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

// ================================================================= The recap story

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

/** Where Maya's hits went today: a double to center in the 4th, a single to right-center in the 6th */
function HitField() {
  const hits = [{ x: 98, y: 36 }, { x: 136, y: 68 }]
  return (
    <svg className="ga-hits" viewBox="0 20 200 130" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <path d="M100 150 L-4 46 Q100 -40 204 46 Z" fill="#56a04b" />
      <path d="M-4 46 Q100 -40 204 46" fill="none" stroke="#f4c430" strokeWidth="3" />
      <path d="M100 152 L52 104 Q100 44 148 104 Z" fill="#c8915f" />
      <path d="M100 146 L-4 42 M100 146 L204 42" stroke="rgba(255,255,255,0.85)" strokeWidth="1.2" />
      {[[128, 118], [100, 90], [72, 118]].map(([x, y], i) => (
        <rect key={i} x={x - 3.5} y={y - 3.5} width="7" height="7" fill="#fff" transform={`rotate(45 ${x} ${y})`} />
      ))}
      {hits.map((h, i) => (
        <g key={i}>
          <path d={`M100 144 L${h.x} ${h.y}`} stroke="#ffb072" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <circle cx={h.x} cy={h.y} r="6" fill="#ff7519" stroke="#fff" strokeWidth="2" />
        </g>
      ))}
    </svg>
  )
}

function Plink({ children }: { children: ReactNode }) {
  return <span className="ga-plink">{children}</span>
}

function RecapPage({ children }: { children?: ReactNode }) {
  return (
    <div className="ga-app ga-recap">
      <div className="ga-nav ga-nav--paper">
        <span className="ga-round"><Icon name="back" size={20} /></span>
        <span className="ga-nav__title ga-nav__title--ink">Mustangs vs Hawks</span>
        <span className="ga-round ga-round--ghost" />
      </div>
      <article className="ga-story">
        <span className="ga-kick">Recap · Final</span>
        <div className="ga-story__head">Mustangs pull away late to beat the Hawks 7–4</div>
        <div className="ga-story__by"><Icon name="book" size={14} />Written from the scorebook · 10:42 AM</div>
        <p className="ga-story__p">
          A 3–2 game stayed close until the 5th, when <Plink>Ava doubled home Mia</Plink> and <Plink>Leo singled in Ava</Plink> to make it 5–2.
          Two more runs in the 6th sealed a 7–4 win over the Hawks on Field 2.
        </p>
        <p className="ga-story__p">
          <b className="ga-me">Maya</b> went 2 for 3 with a walk and scored twice. Her <Plink>double in the 4th</Plink> set up Liam’s single,
          and her <Plink>RBI single in the 6th</Plink> made it 6–3.
        </p>
        <span className="ga-playcard">
          <span className="ga-playcard__text">
            <b>Liam singles to left, Maya scores</b>
            <small>Top 4</small>
          </span>
          <span className="ga-playcard__score">3–1</span>
          <Icon name="caret" size={18} />
        </span>
        <p className="ga-story__p">
          The Hawks scored in four different innings, and #21 worked 4⅓ for them. Ben got the win with Leo closing it out.
          The Mustangs play the Eagles next Saturday at 9:00 AM.
        </p>
        <p className="ga-story__fine">Only Mustangs and Hawks families can read this.</p>
      </article>
      <div className="ga-sharebar">
        <span className="ga-btn ga-btn--primary" data-ready data-target="share">
          <span className="ga-btn__in"><Icon name="share" size={20} />Share Maya’s game</span>
        </span>
      </div>
      {children}
    </div>
  )
}

/** The vertical share image for Maya: brand green, the logo, her line, the final, her hits */
function StatCard() {
  return (
    <div className="ga-sc">
      <div className="ga-sc__top">
        <Wordmark size={22} dark />
        <span className="ga-sc__date">Sat, Nov 7</span>
      </div>
      <div className="ga-sc__who">
        <Chip n="12" size={54} />
        <span className="ga-sc__id">
          <span className="ga-sc__name">Maya</span>
          <span className="ga-sc__team">Mustangs · SS</span>
        </span>
      </div>
      <div className="ga-sc__line">
        <span className="ga-sc__label">Today</span>
        <span className="ga-sc__big">2-for-3</span>
      </div>
      <div className="ga-sc__tiles">
        {[['1', '2B'], ['2', 'R'], ['1', 'RBI'], ['1', 'BB']].map(([v, k]) => (
          <span key={k} className="ga-sc__tile"><b>{v}</b>{k}</span>
        ))}
      </div>
      <div className="ga-sc__final">
        <span className="ga-sc__label">Final · 6 innings</span>
        <span className="ga-sc__score"><b>Mustangs 7</b><i>Hawks 4</i></span>
      </div>
      <div className="ga-sc__field"><HitField /></div>
    </div>
  )
}

type R = { sheet: boolean; saved: boolean; fade: boolean }
const RSTART: R = { sheet: false, saved: false, fade: false }
const RPOSTER: R = { sheet: true, saved: false, fade: false }
const RREST = { x: 330, y: 560 }

const recapScript = async (a: Act<R>) => {
  await a.wait(2400)
  a.mark('share')
  await a.click('share')
  a.set({ sheet: true })
  await a.wait(2600)
  a.mark('save')
  await a.click('save')
  a.set({ saved: true })
  await a.wait(2400)
  a.set({ fade: true })
  await a.wait(450)
  await a.snap({ ...RSTART, fade: true })
  await a.wait(80)
  a.set({ fade: false })
  await a.move(RREST)
}

export function RecapShare() {
  return (
    <Shell<R> initial={RSTART} poster={RPOSTER} script={recapScript} rest={RREST} tag="ga-recapdemo">
      {(s) => (
        <RecapPage>
          <div className="ga-scrim" data-on={s.sheet || undefined} />
          <div className="ga-share" data-open={s.sheet || undefined}>
            <div className="ga-share__top">
              <span className="ga-share__title">Share Maya’s game</span>
              <span className="ga-round"><Icon name="close" size={18} /></span>
            </div>
            <StatCard />
            <p className="ga-share__note">Maya’s name is on this card because she’s your player.</p>
            <div className="ga-share__btns">
              <span className="ga-btn ga-btn--ghost" data-target="save">
                <States
                  value={s.saved ? 'saved' : 'save'}
                  states={{
                    save: <span className="ga-btn__in"><Icon name="download" size={20} />Save image</span>,
                    saved: <span className="ga-btn__in ga-btn__in--ok"><Icon name="check" size={16} />Saved</span>,
                  }}
                />
              </span>
              <span className="ga-btn ga-btn--primary" data-ready>
                <span className="ga-btn__in"><Icon name="share" size={20} />Share</span>
              </span>
            </div>
          </div>
          <div className="fdx-fade" data-on={s.fade || undefined} />
        </RecapPage>
      )}
    </Shell>
  )
}

// ================================================================= Fan summary

type U = { shown: number; open: boolean; fade: boolean }
const USTART: U = { shown: 0, open: false, fade: false }
const UPOSTER: U = { shown: 4, open: false, fade: false }
const UREST = { x: 330, y: 700 }

const summaryScript = async (a: Act<U>) => {
  await a.wait(500)
  a.set({ shown: 1 })
  await a.wait(320)
  a.set({ shown: 2 })
  await a.wait(320)
  a.set({ shown: 3 })
  await a.wait(320)
  a.set({ shown: 4 })
  await a.wait(2300)
  a.mark('tap')
  await a.click('teaser')
  a.set({ open: true })
  await a.wait(3000)
  a.set({ fade: true })
  await a.wait(450)
  await a.snap({ ...USTART, fade: true })
  await a.wait(80)
  a.set({ fade: false })
  await a.move(UREST)
}

function Pitcher({ tag, n, who, line, away }: { tag: 'W' | 'L'; n: string; who: string; line: ReactNode; away?: boolean }) {
  return (
    <div className="ga-dec__row">
      <span className="ga-dec__tag" data-tag={tag}>{tag}</span>
      <span className="ga-dec__chip" data-away={away || undefined}>{n}</span>
      <span className="ga-dec__who">{who}</span>
      <span className="ga-dec__line">{line}</span>
    </div>
  )
}

export function FanSummary() {
  return (
    <Shell<U> initial={USTART} poster={UPOSTER} script={summaryScript} rest={UREST} tag="ga-summary">
      {(s) => (
        <div className="ga-app">
          <div className="ga-hero" />
          <div className="ga-nav">
            <span className="ga-round ga-round--glass"><Icon name="back" size={20} /></span>
            <span className="ga-nav__title">Mustangs vs Hawks</span>
            <span className="ga-round ga-round--glass"><Icon name="share" size={20} /></span>
          </div>
          <FinalBug className="ga-bug--page" />

          <div className="ga-body">
            <div className="ga-tabs">
              <span data-on>Summary</span>
              <span>Plays</span>
              <span>Box score</span>
              <span>Video</span>
            </div>

            <div className="ga-rise ga-me-card" data-in={s.shown >= 1 || undefined}>
              <div className="ga-me-card__top">
                <Chip n="12" size={52} />
                <span className="ga-me-card__who">
                  <span className="ga-me-card__name">Maya</span>
                  <span className="ga-me-card__sub">SS · bats 3rd</span>
                </span>
                <span className="ga-me-card__big">
                  <Count value={s.shown >= 1 ? 2 : 0} duration={700} />-for-<Count value={s.shown >= 1 ? 3 : 0} duration={700} />
                </span>
              </div>
              <div className="ga-tiles">
                {[['2B', 1], ['R', 2], ['RBI', 1], ['BB', 1]].map(([k, v]) => (
                  <span key={k} className="ga-tile">
                    <span className="ga-tile__v"><Count value={s.shown >= 1 ? (v as number) : 0} duration={700} /></span>
                    <span className="ga-tile__k">{k}</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="ga-rise ga-teaser" data-target="teaser" data-in={s.shown >= 2 || undefined}>
              <span className="ga-teaser__text">
                <span className="ga-kick">Recap</span>
                <span className="ga-teaser__head">Mustangs pull away late to beat the Hawks 7–4</span>
                <span className="ga-teaser__lead">Maya went 2 for 3 and scored twice.</span>
              </span>
              <span className="ga-teaser__thumb"><MiniField /></span>
            </div>

            <div className="ga-rise" data-in={s.shown >= 3 || undefined}>
              <Linescore go={s.shown >= 3} />
            </div>

            <div className="ga-rise ga-dec" data-in={s.shown >= 4 || undefined}>
              <Pitcher tag="W" n="15" who="Ben" line={<><b>4</b> IP · <b>5</b> SO</>} />
              <Pitcher tag="L" n="21" who="Hawks pitcher" line={<><b>4⅓</b> IP · <b>6</b> H</>} away />
            </div>
          </div>

          <div className="ga-push" data-open={s.open || undefined}>
            <RecapPage />
          </div>
          <div className="fdx-fade" data-on={s.fade || undefined} />
        </div>
      )}
    </Shell>
  )
}

// ================================================================= Box score

type B = { team: 'mus' | 'haw' }
const BSTART: B = { team: 'mus' }
const BREST = { x: 330, y: 700 }

const boxScript = async (a: Act<B>) => {
  await a.wait(2600)
  a.mark('hawks')
  await a.click('t-haw')
  a.set({ team: 'haw' })
  await a.wait(3000)
  a.mark('back')
  await a.click('t-mus')
  a.set({ team: 'mus' })
  await a.wait(2000)
  await a.move(BREST)
}

type Bat = { who: string; pos: string; ab: number; r: number; h: number; rbi: number; bb: number; so: number; me?: boolean }
const MUS_BAT: Bat[] = [
  { who: 'Jack', pos: 'CF', ab: 4, r: 1, h: 1, rbi: 0, bb: 0, so: 1 },
  { who: 'Ben', pos: 'P', ab: 3, r: 1, h: 1, rbi: 1, bb: 1, so: 0 },
  { who: 'Maya', pos: 'SS', ab: 3, r: 2, h: 2, rbi: 1, bb: 1, so: 0, me: true },
  { who: 'Liam', pos: '1B', ab: 4, r: 1, h: 2, rbi: 2, bb: 0, so: 1 },
  { who: 'Ava', pos: 'C', ab: 3, r: 1, h: 1, rbi: 1, bb: 1, so: 0 },
  { who: 'Noah', pos: 'RF', ab: 3, r: 0, h: 1, rbi: 0, bb: 0, so: 1 },
  { who: 'Mia', pos: 'LF', ab: 3, r: 1, h: 0, rbi: 0, bb: 1, so: 2 },
  { who: 'Leo', pos: '2B', ab: 3, r: 0, h: 1, rbi: 1, bb: 0, so: 1 },
  { who: 'Zoe', pos: '3B', ab: 3, r: 0, h: 0, rbi: 0, bb: 1, so: 1 },
]
const HAW_BAT: Bat[] = [
  { who: '#8', pos: 'CF', ab: 3, r: 1, h: 1, rbi: 0, bb: 1, so: 0 },
  { who: '#3', pos: 'SS', ab: 3, r: 1, h: 1, rbi: 1, bb: 0, so: 1 },
  { who: '#14', pos: '1B', ab: 3, r: 1, h: 2, rbi: 1, bb: 0, so: 0 },
  { who: '#21', pos: 'P', ab: 3, r: 0, h: 1, rbi: 1, bb: 0, so: 1 },
  { who: '#5', pos: 'C', ab: 3, r: 1, h: 1, rbi: 0, bb: 0, so: 1 },
  { who: '#17', pos: 'LF', ab: 3, r: 0, h: 0, rbi: 0, bb: 1, so: 1 },
  { who: '#11', pos: '3B', ab: 3, r: 0, h: 0, rbi: 0, bb: 0, so: 2 },
  { who: '#30', pos: 'RF', ab: 3, r: 0, h: 0, rbi: 0, bb: 0, so: 1 },
  { who: '#26', pos: '2B', ab: 3, r: 0, h: 0, rbi: 0, bb: 1, so: 1 },
]
const sum = (rows: Bat[], k: 'ab' | 'r' | 'h' | 'rbi' | 'bb' | 'so') => rows.reduce((n, r) => n + r[k], 0)

type Pit = { who: string; tag?: 'W' | 'L'; ip: string; p: number; h: number; r: number; bb: number; so: number }
const MUS_PIT: Pit[] = [
  { who: 'Ben', tag: 'W', ip: '4.0', p: 58, h: 4, r: 2, bb: 2, so: 5 },
  { who: 'Leo', ip: '2.0', p: 29, h: 2, r: 2, bb: 1, so: 3 },
]
const HAW_PIT: Pit[] = [
  { who: '#21', tag: 'L', ip: '4.1', p: 66, h: 6, r: 5, bb: 3, so: 4 },
  { who: '#14', ip: '1.2', p: 31, h: 3, r: 2, bb: 2, so: 3 },
]
const LIMIT = 75

function BatPane({ rows, on }: { rows: Bat[]; on: boolean }) {
  return (
    <div className="ga-pane" data-on={on || undefined}>
      {rows.map((r, i) => (
        <div key={r.who} className="ga-bt__row" data-me={r.me || undefined}>
          <span className="ga-bt__n">{i + 1}</span>
          <span className="ga-bt__p">
            <b>{r.who}</b>
            {r.me && <em>12</em>}
            <i>{r.pos}</i>
          </span>
          <span>{r.ab}</span>
          <span>{r.r}</span>
          <span>{r.h}</span>
          <span>{r.rbi}</span>
          <span>{r.bb}</span>
          <span>{r.so}</span>
        </div>
      ))}
      <div className="ga-bt__row ga-bt__row--total">
        <span className="ga-bt__p ga-bt__span"><b>Totals</b></span>
        <span>{sum(rows, 'ab')}</span>
        <span>{sum(rows, 'r')}</span>
        <span>{sum(rows, 'h')}</span>
        <span>{sum(rows, 'rbi')}</span>
        <span>{sum(rows, 'bb')}</span>
        <span>{sum(rows, 'so')}</span>
      </div>
    </div>
  )
}

function PitPane({ rows, on }: { rows: Pit[]; on: boolean }) {
  return (
    <div className="ga-pane" data-on={on || undefined}>
      {rows.map((r) => {
        const pct = Math.round((r.p / LIMIT) * 100)
        return (
          <div key={r.who} className="ga-pt__row">
            <div className="ga-pt__line">
              <span className="ga-pt__p">
                <b>{r.who}</b>
                {r.tag && <em data-tag={r.tag}>{r.tag}</em>}
              </span>
              <span>{r.ip}</span>
              <span>{r.p}</span>
              <span>{r.h}</span>
              <span>{r.r}</span>
              <span>{r.bb}</span>
              <span>{r.so}</span>
            </div>
            <div className="ga-pt__meter">
              <span className="ga-bar">
                <i data-warn={pct >= 85 || undefined} style={{ ['--p' as string]: on ? pct : 0 }} />
              </span>
              <span className="ga-pt__left">{LIMIT - r.p} left</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function BoxScore() {
  return (
    <Shell<B> initial={BSTART} poster={BSTART} script={boxScript} rest={BREST} tag="ga-box">
      {(s) => (
        <div className="ga-app">
          <div className="ga-nav ga-nav--paper ga-nav--box">
            <span className="ga-round"><Icon name="back" size={20} /></span>
            <span className="ga-nav__stack">
              <span className="ga-nav__big">Box score</span>
              <span className="ga-nav__small">Final · Mustangs 7, Hawks 4</span>
            </span>
            <span className="ga-round"><Icon name="share" size={20} /></span>
          </div>

          <div className="ga-box__body">
            <div className="ga-seg">
              <i className="ga-seg__thumb" data-team={s.team} />
              <span data-target="t-mus" data-on={s.team === 'mus' || undefined}><i className="ga-seg__stripe" />Mustangs</span>
              <span data-target="t-haw" data-on={s.team === 'haw' || undefined}><i className="ga-seg__stripe ga-seg__stripe--away" />Hawks</span>
            </div>

            <div className="ga-card ga-bt">
              <div className="ga-bt__row ga-bt__row--head">
                <span className="ga-bt__title ga-bt__span">Batting</span>
                <span>AB</span><span>R</span><span>H</span><span>RBI</span><span>BB</span><span>SO</span>
              </div>
              <div className="ga-clip">
                <div className="ga-track" data-team={s.team}>
                  <BatPane rows={MUS_BAT} on={s.team === 'mus'} />
                  <BatPane rows={HAW_BAT} on={s.team === 'haw'} />
                </div>
              </div>
            </div>

            <div className="ga-card ga-pt">
              <div className="ga-pt__line ga-pt__line--head">
                <span className="ga-bt__title">Pitching</span>
                <span>IP</span><span>P</span><span>H</span><span>R</span><span>BB</span><span>SO</span>
              </div>
              <div className="ga-clip">
                <div className="ga-track" data-team={s.team}>
                  <PitPane rows={MUS_PIT} on={s.team === 'mus'} />
                  <PitPane rows={HAW_PIT} on={s.team === 'haw'} />
                </div>
              </div>
              <span className="ga-pt__note">10U daily limit: {LIMIT} pitches</span>
            </div>
          </div>
        </div>
      )}
    </Shell>
  )
}
