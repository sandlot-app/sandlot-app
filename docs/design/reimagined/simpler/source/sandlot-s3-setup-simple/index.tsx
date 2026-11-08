import type { CSSProperties } from 'react'
import { States, type Act } from '../../kit'
import { Shell, Icon, Num, Tick, Spinner, Rise, MUSTANGS, fadeOut } from '../sandlot-s3/s3'

// Start a game, simple. Replaces Game setup and Lineup as one screen. The app
// already knows the game (the schedule), the lineup (last Saturday's) and the
// pitcher (rested), so the screen says what it filled in and offers one big
// button. Changing the lineup is a quiet link; season half and division live
// behind Details; a missing Hawks lineup is a plain sentence, not a block.

type S = { in: boolean; sheet: boolean; btn: 'ready' | 'busy' | 'done'; fade: boolean }
const START: S = { in: false, sheet: false, btn: 'ready', fade: false }
const POSTER: S = { ...START, in: true }
const REST = { x: 338, y: 590 }

const script = async (a: Act<S>) => {
  await a.wait(450)
  // The game card rises, then last Saturday's lineup fills in chip by chip
  a.set({ in: true })
  await a.wait(2500)
  a.mark('filled')
  await a.wait(900)
  // The quiet path: Edit lineup opens a plain drag list
  a.mark('edit')
  await a.click({ at: 'edit', x: 0.88, y: 0.7 })
  a.set({ sheet: true })
  await a.wait(2300)
  a.mark('done')
  await a.click({ at: 'done', x: 0.9, y: 0.5 })
  a.set({ sheet: false })
  await a.wait(900)
  // The main path: one tap
  a.mark('start')
  await a.click({ at: 'start', x: 0.9, y: 0.5 })
  a.set({ btn: 'busy' })
  await a.wait(1000)
  a.mark('started')
  a.set({ btn: 'done' })
  await a.wait(2000)
  await fadeOut(a, START, REST)
}

const mustang = (id: string) => MUSTANGS.find((p) => p.id === id)!
// Last Saturday's batting order: Maya bats 3rd, Zoe pitches
const ORDER = ['noah', 'ben', 'maya', 'liam', 'ava', 'jack', 'mia', 'leo', 'zoe'].map(mustang)

export default function StartGame() {
  return (
    <Shell<S> initial={START} poster={POSTER} script={script} rest={REST}>
      {(s) => (
        <div className="ob-page s3-page s3-setup">
          <div className="s3-nav">
            <span className="ob-round"><Icon name="arrow-left" size={20} /></span>
          </div>
          <h1 className="ob-h1">Ready to score?</h1>
          <p className="s3-sub">Filled in from the schedule and last game.</p>

          <Rise on={s.in} d={0}>
            <div className="s3-game">
              <span className="s3-game__when">Today · 10:00 AM · Field 2</span>
              <span className="s3-game__vs">Mustangs <i>vs</i> Hawks</span>
              <span className="s3-game__chips">
                <span className="s3-chip">Mustangs bat first</span>
              </span>
            </div>
          </Rise>

          <Rise on={s.in} d={0.3}>
            <div className="s3-card s3-lineup">
              <div className="s3-lineup__top">
                <span className="s3-label">Batting order</span>
                <span className="s3-link" data-target="edit">Edit lineup</span>
              </div>
              <div className="s3-lineup__title">Same lineup as last Saturday</div>
              <div className="s3-chips">
                {ORDER.map((p, i) => (
                  <span key={p.id} className="s3-pop" data-in={s.in || undefined} style={{ '--d': `${0.8 + i * 0.085}s` } as CSSProperties}>
                    <Num n={p.n} mine={p.id === 'maya'} size={32} />
                  </span>
                ))}
              </div>
              <Rise on={s.in} d={1.65}>
                <div className="s3-sep" />
                <div className="s3-pitch">
                  <Num n="4" size={44} />
                  <span className="s3-pitch__text">Zoe pitching<i> · fully rested</i></span>
                </div>
              </Rise>
            </div>
          </Rise>

          <Rise on={s.in} d={1.95}>
            <div className="s3-note">
              <span className="s3-note__icon"><Icon name="clock" size={18} /></span>
              <span className="s3-note__text"><b>Hawks lineup:</b> we’ll ask at their first batter.</span>
            </div>
          </Rise>

          <div className="s3-foot">
            <span className="s3-big" data-target="start" data-done={s.btn === 'done' || undefined}>
              <States
                value={s.btn}
                states={{
                  ready: <span className="s3-big__in">Start game</span>,
                  busy: <span className="s3-big__in"><Spinner />Starting</span>,
                  done: <span className="s3-big__in"><Tick size={18} />Game started</span>,
                }}
              />
            </span>
            <span className="s3-more">Details<Icon name="caret-right" size={14} /></span>
          </div>

          <div className="gt-scrim" data-on={s.sheet || undefined} />
          <div className="gt-sheet s3-sheet" data-open={s.sheet || undefined}>
            <span className="gt-grab" />
            <div className="s3-sheet__top">
              <h2 className="gt-h2">Batting order</h2>
              <span className="s3-hint">Hold and drag to move</span>
            </div>
            <div className="s3-elist">
              {ORDER.map((p, i) => (
                <div key={p.id} className="s3-erow">
                  <span className="s3-erow__n">{i + 1}</span>
                  <Num n={p.n} mine={p.id === 'maya'} size={30} />
                  <span className="s3-erow__name">{p.name}</span>
                  <span className="s3-erow__grip"><Icon name="drag-vertical" size={22} /></span>
                </div>
              ))}
            </div>
            <span className="gt-btn gt-btn--main" data-target="done">Done</span>
          </div>

          <div className="fdx-fade" data-on={s.fade || undefined} />
        </div>
      )}
    </Shell>
  )
}
