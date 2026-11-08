import { Ask, Base, Field, GBug, Ico, Result, Shell, loopEnd, type Act } from '../sandlot-s2/s2'
import type { IconName } from '../sandlot-s2/icons'
import './more.css'

// More, simple. Four big tiles for what really happens in a youth game, a
// quiet "Other plays" link, and a hint that you can just say it. Stolen base
// already knows the runner: Liam is the only one on, so the app never asks
// who. The sheet closes, Liam runs, the play saves with Undo.

type M = {
  sheet: 'closed' | 'open'
  pick: boolean
  liam: number
  bases: [boolean, boolean, boolean]
  mode: 'ask' | 'result'
  last: string
  fade: boolean
}

const START: M = { sheet: 'closed', pick: false, liam: 1, bases: [true, false, false], mode: 'ask', last: 'Single', fade: false }
const POSTER: M = { ...START, sheet: 'open' }

const script = async (a: Act<M>) => {
  await a.wait(1100)
  a.mark('more')
  await a.click('more')
  a.set({ sheet: 'open' })
  await a.wait(1900)
  a.mark('steal')
  await a.click('steal')
  a.set({ pick: true })
  await a.wait(320)
  a.set({ sheet: 'closed', mode: 'result', last: 'Steal' })
  await a.wait(520)
  a.mark('runs')
  a.set({ liam: 2 })
  await a.wait(780)
  a.set({ bases: [false, true, false] })
  await a.wait(420)
  a.mark('saved')
  await a.wait(3000)
  await loopEnd(a, START)
}

function Tile({ id, icon, on, children, guess }: { id?: string; icon: IconName; on?: boolean; children: string; guess?: boolean }) {
  return (
    <span className="s2-more-tile" data-target={id} data-on={on || undefined}>
      <span className="s2-more-tile__top">
        <span className="s2-more-icon"><Ico name={icon} size={20} /></span>
        {guess && (
          <span className="s2-more-guess">
            <i className="s2-more-guess__num">7</i>
            Liam on 1st
          </span>
        )}
      </span>
      <span className="s2-more-tile__label">{children}</span>
    </span>
  )
}

export default function SandlotS2MoreSimple() {
  return (
    <Shell<M> initial={START} poster={POSTER} script={script}>
      {(s) => (
        <>
          <Field liam={s.liam} />
          <GBug s={{ bases: s.bases, us: 3, them: 1, outs: 1, balls: 0, strikes: 0, inning: 'Top 4' }} />
          <Base
            mode={s.mode}
            more
            ask={<Ask who="Ben" count="0–0" />}
            result={<Result title="Liam steals 2nd" sub="Only one runner on, so we didn’t ask" />}
            status={`Last: ${s.last} · All plays saved`}
          />

          <div className="gd-scrim" data-on={s.sheet === 'open' || undefined} />
          <div className="s2-more" data-open={s.sheet === 'open' || undefined}>
            <i className="s2-more-grab" />
            <div className="s2-more-head">
              <span className="s2-more-title">More</span>
              <span className="s2-more-close"><Ico name="close" size={18} /></span>
            </div>

            <div className="s2-more-body">
            <div className="s2-more-hint">
              <span className="s2-more-mic"><Ico name="mic" size={18} /></span>
              <span className="s2-more-hint__text">Or just say it: <b>“Liam steals second”</b></span>
            </div>

            <div className="s2-more-tiles">
              <Tile id="steal" icon="lightning" on={s.pick} guess>Stolen base</Tile>
              <Tile icon="alert">Hit by pitch</Tile>
              <Tile icon="repeat">Pitching change</Tile>
              <Tile icon="hourglass">Delay</Tile>
            </div>

            <span className="s2-more-other">
              Other plays
              <Ico name="caret-right" size={16} />
            </span>
            </div>
          </div>
        </>
      )}
    </Shell>
  )
}
