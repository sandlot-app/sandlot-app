import { States, type Act } from '../../kit'
import { FieldLayer, Bug, type S as YS } from '../sandlot-youth/youth'
import { Dots } from '../sandlot-fieldday/scene'
import { Shell, Icon, Emblem } from '../sandlot-gt/gt'

// Public link, signed out. A parent texts the live link to grandma; she opens
// it in her phone's browser with no account. She sees the score bug, the Rec
// field with the same plays, and every player as a number: chips carry the
// position, the play-by-play says "#7 singles to left, #12 scores". Names stay
// with team families (plan: Privacy; spec: Public game states).

type L = YS & { atbat: 'live' | 'done'; next: boolean }
const START: L = { mic: 'idle', cap: 'hint', heard: 0, phase: 'set', cam: 'wide', liam: 0, maya: 2, us: 2, balls: 1, strikes: 1, outs: 1, last: 'Strike', fade: false, atbat: 'live', next: false }
const POSTER: L = { ...START, phase: 'throw', liam: 1, maya: 4, us: 3, balls: 0, strikes: 0, atbat: 'done', next: true }

const script = async (a: Act<L>) => {
  await a.wait(1300)
  a.mark('ball')
  a.set({ balls: 2 })
  await a.wait(1200)
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
  // The run is in: the score ticks and the feed catches up
  a.mark('scored')
  a.set({ us: 3, balls: 0, strikes: 0, atbat: 'done' })
  await a.wait(1100)
  a.mark('next')
  a.set({ next: true })
  await a.wait(3400)
  a.set({ fade: true })
  await a.wait(450)
  await a.snap({ ...START, fade: true })
  await a.wait(80)
  a.set({ fade: false })
  await a.wait(500)
}

function Feed({ s }: { s: L }) {
  return (
    <div className="gt-feed">
     <div className="gt-feed__track" data-on={s.next || undefined}>
      <div className="gt-feed__item gt-feed__item--next" data-on={s.next || undefined}>
        <span className="gt-feed__inn">T4</span>
        <span className="gt-feed__text">#3 at bat</span>
        <span className="gt-feed__count">0–0</span>
      </div>
      <div className="gt-feed__item" data-hot={s.atbat === 'done' || undefined}>
        <span className="gt-feed__inn">T4</span>
        <States
          value={s.atbat}
          align="start"
          states={{
            live: (
              <span className="gt-feed__text">
                #7 at bat
                <span className="gt-feed__dots"><Dots kind="ball" lit={s.balls} of={3} /><Dots kind="strike" lit={s.strikes} of={2} /></span>
              </span>
            ),
            done: <span className="gt-feed__text"><b>#7 singles to left, #12 scores</b></span>,
          }}
        />
      </div>
      <div className="gt-feed__item">
        <span className="gt-feed__inn">T4</span>
        <span className="gt-feed__text">#12 doubles to center</span>
      </div>
      <div className="gt-feed__item">
        <span className="gt-feed__inn">T4</span>
        <span className="gt-feed__text">#15 flies out to right</span>
      </div>
      <div className="gt-feed__item">
        <span className="gt-feed__inn">T3</span>
        <span className="gt-feed__text">#9 strikes out swinging</span>
      </div>
      <div className="gt-feed__item gt-feed__item--old">
        <span className="gt-feed__inn">T3</span>
        <span className="gt-feed__text">#22 grounds out to short</span>
      </div>
     </div>
    </div>
  )
}

export default function Public() {
  return (
    <Shell<L> initial={START} poster={POSTER} script={script}>
      {(s) => (
        <div className="ob-page gt-pub">
          <div className="gt-safari">
            <span className="gt-url">
              <span className="gt-url__aa">aA</span>
              <span className="gt-url__text"><span className="gt-url__lock"><Icon name="lock" size={12} /></span>sandlot.app/live/mus-haw</span>
              <span className="gt-url__reload"><Icon name="refresh" size={16} /></span>
            </span>
          </div>

          <div className="gt-pfield">
            <FieldLayer s={s} variant="rec" />
            <Bug s={s} />
            <span className="gt-live"><i />Live</span>
          </div>

          <div className="gt-banner">
            <span className="gt-banner__icon"><Icon name="eye-slash" size={20} /></span>
            <span className="gt-banner__text">
              <b>Names are hidden</b>
              <span>Kids’ names stay with their team’s families.</span>
            </span>
          </div>

          <Feed s={s} />

          <div className="gt-getapp">
            <span className="gt-getapp__icon"><Emblem size={28} /></span>
            <span className="gt-getapp__text">Get the app to follow a player</span>
            <span className="gt-getapp__btn">Get app</span>
          </div>
          <div className="fdx-fade" data-on={s.fade || undefined} />
        </div>
      )}
    </Shell>
  )
}
