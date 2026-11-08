import { Ask, Base, Field, GBug, Ico, Result, Shell, loopEnd, type Act } from '../sandlot-gd/gd'
import './more.css'

// More: the scorer's other tools, grouped. A Steal is picked there, then
// "who's running?", and the sheet drops to show the play.

type M = {
  sheet: 'closed' | 'menu' | 'who'
  liam: number
  bases: [boolean, boolean, boolean]
  mode: 'ask' | 'result'
  last: string
  fade: boolean
}

const START: M = { sheet: 'closed', liam: 1, bases: [true, false, false], mode: 'ask', last: 'Single', fade: false }
const POSTER: M = { ...START, sheet: 'menu' }

const script = async (a: Act<M>) => {
  await a.wait(1100)
  a.mark('more')
  await a.click('more')
  a.set({ sheet: 'menu' })
  await a.wait(1600)
  a.mark('steal')
  await a.click('steal')
  a.set({ sheet: 'who' })
  await a.wait(1300)
  a.mark('who')
  await a.click('liam')
  a.set({ sheet: 'closed' })
  await a.wait(380)
  a.mark('runs')
  a.set({ liam: 2 })
  await a.wait(780)
  a.set({ bases: [false, true, false] })
  await a.wait(420)
  a.mark('saved')
  a.set({ mode: 'result', last: 'Steal' })
  await a.wait(3000)
  await loopEnd(a, START)
}

function Tile({ id, children }: { id?: string; children: string }) {
  return <span className="gd-mt" data-target={id}>{children}</span>
}

export default function SandlotGdMore() {
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
            result={<Result title="Liam steals 2nd" sub="Safe at 2nd · runner on 2nd" />}
            status={`Last: ${s.last} · All plays saved`}
          />

          <div className="gd-scrim" data-on={s.sheet !== 'closed' || undefined} />
          <div className="gd-more" data-sheet={s.sheet}>
            <i className="gd-grab" />
            <div className="gd-pane" data-on={s.sheet === 'menu' || undefined}>
              <div className="gd-sh-head">
                <span className="gd-sh-title">More</span>
                <span className="gd-round"><Ico name="close" size={18} /></span>
              </div>
              <div className="gd-menu">
                <div className="gd-group">
                  <p className="gd-glabel">Runners</p>
                  <div className="gd-mgrid">
                    <Tile id="steal">Steal</Tile>
                    <Tile>Wild pitch</Tile>
                    <Tile>Passed ball</Tile>
                    <Tile>Pickoff</Tile>
                  </div>
                </div>
                <div className="gd-group">
                  <p className="gd-glabel">Batter</p>
                  <div className="gd-mgrid gd-mgrid--1"><Tile>Hit by pitch</Tile></div>
                </div>
                <div className="gd-group">
                  <p className="gd-glabel">Lineup</p>
                  <div className="gd-mgrid">
                    <Tile>Pitching change</Tile>
                    <Tile>Substitution</Tile>
                  </div>
                </div>
                <div className="gd-group">
                  <p className="gd-glabel">Game</p>
                  <div className="gd-mgrid gd-mgrid--1"><Tile>Delay</Tile></div>
                </div>
              </div>
            </div>
            <div className="gd-pane" data-on={s.sheet === 'who' || undefined}>
              <div className="gd-sh-head gd-sh-head--who">
                <span className="gd-round"><Ico name="arrow-left" size={18} /></span>
                <span className="gd-ask gd-ask--big"><span className="gd-crumb">Steal</span>Who’s running?</span>
                <span className="gd-round gd-round--ghost" />
              </div>
              <span className="gd-runner" data-target="liam">
                <span className="gd-num gd-num--big">7</span>
                <span className="gd-runner__text">
                  <span className="gd-runner__name">Liam</span>
                  <span className="gd-runner__sub">On 1st base</span>
                </span>
                <Ico name="caret-right" size={20} />
              </span>
              <p className="gd-note">Only runners on base show up here.</p>
            </div>
          </div>
        </>
      )}
    </Shell>
  )
}
