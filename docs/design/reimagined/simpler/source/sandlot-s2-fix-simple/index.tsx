import { Roll, States } from '../../kit'
import { Field, GBug, Ico, Shell, Tick, Tiles, loopEnd, type Act } from '../sandlot-s2/s2'
import './fix.css'

// Fix a play, simple. No list, no reopened steps, no review sheet. The last
// play is already on screen in its saved card, so the fix starts there: Fix
// next to Undo turns that same card into one chooser with four big tiles and
// one plain line about what changes. One tap on Double, one tap on Save.

type F = {
  card: 'saved' | 'fix'
  pick: 'none' | 'double'
  liam: number
  bases: [boolean, boolean, boolean]
  play: 'single' | 'double'
  fade: boolean
}

const START: F = { card: 'saved', pick: 'none', liam: 1, bases: [true, false, false], play: 'single', fade: false }
const POSTER: F = { ...START, card: 'fix', pick: 'double' }

const script = async (a: Act<F>) => {
  await a.wait(1500)
  a.mark('fix')
  await a.click('fix')
  a.set({ card: 'fix' })
  await a.wait(1500)
  a.mark('pick')
  await a.click('double')
  a.set({ pick: 'double' })
  await a.wait(1800)
  a.mark('save')
  await a.click('save')
  a.set({ card: 'saved' })
  await a.wait(560)
  a.mark('runs')
  a.set({ liam: 2, play: 'double' })
  await a.wait(780)
  a.set({ bases: [false, true, false] })
  await a.wait(420)
  a.mark('saved')
  await a.wait(3000)
  await loopEnd(a, START)
}

const TILES: [string, string][] = [['double', 'Double'], ['triple', 'Triple'], ['error', 'Error'], ['out', 'Out']]

export default function SandlotS2FixSimple() {
  return (
    <Shell<F> initial={START} poster={POSTER} script={script}>
      {(s) => (
        <>
          <Field liam={s.liam} />
          <GBug s={{ bases: s.bases, us: 3, them: 1, outs: 1, balls: 0, strikes: 0, inning: 'Top 4' }} />

          {/* The scorer underneath is the approved Big buttons sheet, untouched */}
          <div className="gd-sheet" />
          <div className="gd-deck"><Tiles /></div>
          <span className="gd-status">
            <Tick />
            <Roll>{s.play === 'double' ? 'Last: Double, fixed · All plays saved' : 'Last: Single · All plays saved'}</Roll>
          </span>

          {/* One card: the saved play, and the same card opened as the chooser */}
          <div className="s2-fix-plate" data-open={s.card === 'fix' || undefined} />
          <div className="s2-fix-card" data-open={s.card === 'fix' || undefined}>
            <div className="s2-fix-saved">
              <span className="s2-fix-tick"><Tick /></span>
              <span className="s2-fix-text">
                <span className="s2-fix-title"><Roll>{s.play === 'double' ? 'Double to left' : 'Single to left'}</Roll></span>
                <span className="s2-fix-sub"><Roll>{s.liam === 2 ? 'Maya scores · Liam on 2nd' : 'Maya scores · Liam on 1st'}</Roll></span>
              </span>
              <span className="gd-undo" data-target="undo">Undo</span>
              <span className="s2-fix-btn" data-target="fix"><Ico name="pencil" size={14} />Fix</span>
            </div>

            <div className="s2-fix-choose">
              <div className="s2-fix-head">
                <span className="s2-fix-q">What was it really?</span>
                <span className="s2-fix-cancel">Cancel</span>
              </div>
              <div className="s2-fix-tiles">
                {TILES.map(([id, label]) => (
                  <span key={id} className="s2-fix-tile" data-target={id === 'double' ? 'double' : undefined} data-on={s.pick === id || undefined}>
                    <span className="s2-fix-tile__label">
                      <i className="s2-fix-check"><Tick /></i>
                      {label}
                    </span>
                  </span>
                ))}
              </div>
              <div className="s2-fix-line">
                <States
                  value={s.pick}
                  states={{
                    none: <span className="s2-fix-say"><b>Was a single.</b> Pick the real play.</span>,
                    double: <span className="s2-fix-say"><b>Liam ends on 2nd.</b> Score stays 3–1.</span>,
                  }}
                />
              </div>
              <span className="s2-fix-save" data-target="save" data-ready={s.pick !== 'none' || undefined}>
                <span className="s2-fix-save__text">Save</span>
              </span>
            </div>
          </div>
        </>
      )}
    </Shell>
  )
}
