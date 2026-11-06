import { Roll } from '../../kit'
import { Base, Field, GBug, Ico, Result, Shell, Tick, loopEnd, type Act } from '../sandlot-gd/gd'
import './fix.css'

// Fix a play: pick it from this game's plays, answer the same step again
// under an orange "Fixing" banner, read what the fix changes, save it.

type F = {
  step: 'list' | 'edit' | 'review' | 'saved'
  row: boolean
  pick: 'single' | 'double'
  liam: number
  bases: [boolean, boolean, boolean]
  mode: 'ask' | 'result'
  last: string
  fade: boolean
}

const START: F = { step: 'list', row: false, pick: 'single', liam: 1, bases: [true, false, false], mode: 'ask', last: 'Single', fade: false }
const POSTER: F = { ...START, step: 'review', row: true, pick: 'double' }

const script = async (a: Act<F>) => {
  await a.wait(1700)
  a.mark('pick')
  await a.click('play')
  a.set({ row: true })
  await a.wait(380)
  a.mark('edit')
  a.set({ step: 'edit' })
  await a.wait(1500)
  await a.click('double')
  a.set({ pick: 'double' })
  await a.wait(750)
  a.mark('review')
  a.set({ step: 'review' })
  await a.wait(2600)
  await a.click('savefix')
  a.set({ step: 'saved' })
  await a.wait(420)
  a.mark('runs')
  a.set({ liam: 2 })
  await a.wait(780)
  a.set({ bases: [false, true, false] })
  await a.wait(400)
  a.mark('saved')
  a.set({ mode: 'result', last: 'Fixed Liam’s play' })
  await a.wait(3000)
  await loopEnd(a, START)
}

type Play = { n: string; away?: boolean; title: string; sub: string; target?: string }
const GROUPS: { label: string; plays: Play[] }[] = [
  {
    label: 'Top 4 · Mustangs batting',
    plays: [
      { n: '7', title: 'Liam singles to left', sub: 'Maya scores · 1 out', target: 'play' },
      { n: '12', title: 'Maya doubles to right center', sub: 'Runner on 2nd · 1 out' },
      { n: '3', title: 'Ava grounds out to short', sub: '1 out' },
    ],
  },
  {
    label: 'Bottom 3 · Hawks batting',
    plays: [
      { n: '21', away: true, title: 'T. Nguyen strikes out looking', sub: '3 outs · inning over' },
      { n: '14', away: true, title: 'S. Bell grounds out to short', sub: '2 outs' },
      { n: '9', away: true, title: 'D. Park flies out to center', sub: '1 out' },
    ],
  },
]

const TILES: [string, string][] = [['single', 'Single'], ['double', 'Double'], ['triple', 'Triple'], ['homer', 'Home run'], ['out', 'Out'], ['error', 'Error']]

export default function SandlotGdFix() {
  return (
    <Shell<F> initial={START} poster={POSTER} script={script}>
      {(s) => (
        <>
          <Field liam={s.liam} />
          <GBug s={{ bases: s.bases, us: 3, them: 1, outs: 1, balls: 0, strikes: 0, inning: 'Top 4' }} />
          <Base
            mode={s.mode}
            ask={<span className="gd-ask">Ben batting<span className="gd-crumb">0–0</span></span>}
            result={<Result title="Play fixed" sub="Liam doubles to left · on 2nd" />}
            status={`Last: ${s.last} · All plays saved`}
          />

          <div className="gd-scrim" data-on={s.step === 'list' || s.step === 'review' || undefined} />

          {/* The step sheet, reopened: same tiles, prefilled, under the banner */}
          <div className="gd-edit" data-show={s.step === 'edit' || s.step === 'review' || undefined}>
            <span className="gd-banner">
              <span className="gd-banner__icon"><Ico name="pencil" size={16} /></span>
              <span className="gd-banner__text">Fixing · Top 4 · Liam singles to left</span>
              <span className="gd-banner__icon"><Ico name="close" size={14} /></span>
            </span>
            <p className="gd-q">What really happened?</p>
            <div className="gd-etiles">
              {TILES.map(([id, label]) => (
                <span key={id} className="gd-et" data-target={id === 'double' ? 'double' : undefined} data-on={s.pick === id || undefined}>
                  {label}
                  <i className="gd-et__check"><Tick /></i>
                </span>
              ))}
            </div>
            <span className="gd-remove"><Ico name="bin" size={16} />Remove this play</span>
          </div>

          {/* This game's plays, newest first */}
          <div className="gd-list" data-show={s.step === 'list' || undefined}>
            <i className="gd-grab" />
            <div className="gd-sh-head">
              <span className="gd-sh-title">Fix a play</span>
              <span className="gd-round"><Ico name="close" size={18} /></span>
            </div>
            <p className="gd-list__sub">Tap the play that was wrong.</p>
            <div className="gd-plays">
              {GROUPS.map((g) => (
                <div key={g.label} className="gd-group">
                  <p className="gd-glabel">{g.label}</p>
                  <div className="gd-card">
                    {g.plays.map((p) => (
                      <span key={p.title} className="gd-prow" data-target={p.target} data-on={(p.target && s.row) || undefined}>
                        <span className={`gd-num${p.away ? ' gd-num--away' : ''}`}>{p.n}</span>
                        <span className="gd-prow__text">
                          <span className="gd-prow__title">{p.title}</span>
                          <span className="gd-prow__sub">{p.sub}</span>
                        </span>
                        <Ico name="caret-right" size={18} />
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              <span className="gd-earlier">
                <Ico name="history" size={18} />
                Earlier innings
                <Ico name="caret-right" size={18} />
              </span>
            </div>
          </div>

          {/* Review the fix: was, now, and what changes */}
          <div className="gd-review" data-show={s.step === 'review' || undefined}>
            <i className="gd-grab" />
            <div className="gd-sh-head">
              <span className="gd-sh-title">Review the fix</span>
              <span className="gd-cancel">Cancel</span>
            </div>
            <div className="gd-wn">
              <span className="gd-wn__line">
                <span className="gd-tag">Was</span>
                <span className="gd-wn__text gd-wn__text--was">Liam singles to left</span>
              </span>
              <span className="gd-wn__line gd-wn__line--now">
                <span className="gd-tag gd-tag--now">Now</span>
                <span className="gd-wn__text">Liam doubles to left</span>
              </span>
            </div>
            <p className="gd-glabel gd-changes-label">What changes</p>
            <div className="gd-card gd-changes">
              <span className="gd-ch"><span className="gd-ch__k">Liam</span><span className="gd-ch__v">Ends on 2nd, not 1st</span></span>
              <span className="gd-ch"><span className="gd-ch__k">Liam today</span><span className="gd-ch__v">1-for-2 · now a double</span></span>
              <span className="gd-ch"><span className="gd-ch__k">Score</span><span className="gd-ch__v gd-ch__v--quiet">No change · 3–1</span></span>
            </div>
            <p className="gd-note gd-note--review">The box score and stats update. Undo brings the old play back.</p>
            <span className="gd-btn gd-savefix" data-target="savefix"><Roll variant="fade">Save fix</Roll></span>
          </div>
        </>
      )}
    </Shell>
  )
}
