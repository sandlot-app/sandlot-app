import type { CSSProperties } from 'react'
import { Count, type Act } from '../../kit'
import { Shell, Icon, Num, Tabs, Tick, Emblem, Rise, MUSTANGS, fadeOut } from '../sandlot-s3/s3'

// Team, simple. The header says who we are and how we're doing; the roster is
// twelve big chips, with a small dot on the kids whose parents haven't joined;
// one big Invite parents button. Roles and the people list sit behind a link.

type T = { in: boolean; sheet: boolean; copied: boolean; toast: boolean; joined: string[]; fade: boolean }
const START: T = { in: false, sheet: false, copied: false, toast: false, joined: [], fade: false }
const POSTER: T = { ...START, in: true, copied: true, toast: true, joined: ['zoe', 'ella'] }
const REST = { x: 338, y: 690 }

/** Kids whose parents haven't joined yet */
const WAITING = ['leo', 'zoe', 'sam', 'ella', 'max']

const script = async (a: Act<T>) => {
  await a.wait(450)
  a.set({ in: true })
  await a.wait(2000)
  a.mark('invite')
  await a.click({ at: 'invite', x: 0.9, y: 0.5 })
  a.set({ sheet: true })
  await a.wait(1500)
  a.mark('copy')
  await a.click({ at: 'link', x: 0.9, y: 0.5 })
  a.set({ copied: true })
  await a.wait(800)
  a.set({ sheet: false })
  await a.wait(550)
  a.mark('toast')
  a.set({ toast: true })
  await a.wait(900)
  // Parents tap the link: their kid's dot becomes a check
  a.mark('joined')
  a.set({ joined: ['zoe'] })
  await a.wait(1000)
  a.set({ joined: ['zoe', 'ella'] })
  await a.wait(1100)
  a.set({ toast: false })
  await a.wait(1200)
  await fadeOut(a, START, REST)
}

export default function TeamSimple() {
  const left = WAITING.length
  return (
    <Shell<T> initial={START} poster={POSTER} script={script} rest={REST}>
      {(s) => (
        <div className="ob-page gt-page s3-page s3-team">
          <div className="gt-title" data-away={s.toast || undefined}>
            <h1 className="ob-h1">Team</h1>
            <span className="ob-avatar">C</span>
          </div>

          <Rise on={s.in} d={0}>
            <div className="gt-team">
              <div className="gt-team__top">
                <span className="gt-team__badge"><Emblem size={30} /></span>
                <span className="gt-team__text">
                  <span className="gt-team__name">Moraga Mustangs</span>
                  <span className="gt-team__sub">10U Rec · Fall 2026</span>
                </span>
                <span className="gt-record"><b>6–2</b>Record</span>
              </div>
            </div>
          </Rise>

          <Rise on={s.in} d={0.15}>
            <div className="gt-sect">
              <span className="ob-label">Roster · 12</span>
              <span className="s3-legend"><i /><span className="s3-legend__n"><Count value={left - s.joined.length} duration={500} /></span><span>parents haven’t joined</span></span>
            </div>
          </Rise>

          <div className="s3-grid">
            {MUSTANGS.map((p, i) => (
              <Rise key={p.id} on={s.in} d={0.25 + Math.floor(i / 3) * 0.1 + (i % 3) * 0.04} className="s3-cell">
                <span className="s3-kid">
                  <Num n={p.n} mine={p.id === 'maya'} size={40} />
                  {p.name}
                  {WAITING.includes(p.id) && (
                    <span className="s3-mark" data-joined={s.joined.includes(p.id) || undefined}>
                      <i className="s3-mark__dot" />
                      <i className="s3-mark__ok"><Tick size={10} /></i>
                    </span>
                  )}
                </span>
              </Rise>
            ))}
          </div>

          <Rise on={s.in} d={0.8}>
            <span className="s3-big" data-target="invite"><Icon name="user-add" size={22} />Invite parents</span>
          </Rise>
          <Rise on={s.in} d={0.95}>
            <span className="s3-more"><Icon name="users" size={16} />People and roles<Icon name="caret-right" size={14} /></span>
          </Rise>

          <Tabs on="team" />

          <div className="gt-scrim" data-on={s.sheet || undefined} />
          <div className="gt-sheet" data-open={s.sheet || undefined}>
            <span className="gt-grab" />
            <div className="gt-sheet__head">
              <span className="gt-sheet__tile"><Icon name="user-add" size={26} /></span>
              <h2 className="gt-h2">Invite parents</h2>
              <p className="gt-sheet__p">Anyone with this link joins the Mustangs and picks their player.</p>
            </div>
            <div className="gt-linkcard" data-hot={s.copied || undefined} data-target="link">
              <span className="gt-linkcard__icon"><Icon name="link" size={20} /></span>
              <span className="s3-linkline">sandlot.app/join/<b>mustangs</b></span>
              <span className="s3-swap" data-done={s.copied || undefined}>
                <span className="s3-copy"><Icon name="copy" size={20} /></span>
                <span className="s3-copied"><Icon name="check" size={16} />Copied</span>
              </span>
            </div>
            <div className="s3-textbtn">
              <span className="gt-btn gt-btn--main" data-target="text"><Icon name="message-circle" size={20} />Text the link</span>
            </div>
          </div>

          <div className="gt-toast" data-on={s.toast || undefined}>
            <span className="gt-toast__icon"><Icon name="check-circle" size={22} /></span>
            Link copied
          </div>
          <div className="fdx-fade" data-on={s.fade || undefined} />
        </div>
      )}
    </Shell>
  )
}
