import type { Act } from '../../kit'
import { Shell, Icon, Num, Tabs, AppleMark, Rise, fadeOut } from '../sandlot-s3/s3'

// Me, simple. Three plain cards: Maya (with the one switch that matters),
// Privacy as one sentence, and the account. Deleting lives in one quiet red
// link at the very bottom, and it opens a calm sheet, never a surprise.

type M = { in: boolean; buzz: boolean; toast: boolean; sheet: boolean; fade: boolean }
const START: M = { in: false, buzz: true, toast: false, sheet: false, fade: false }
const POSTER: M = { ...START, in: true, toast: true }
const REST = { x: 330, y: 640 }

const script = async (a: Act<M>) => {
  await a.wait(450)
  a.set({ in: true })
  await a.wait(1700)
  // Off: no buzz when Maya plays
  a.mark('off')
  await a.click({ at: 'sw-buzz', x: 0.5, y: 0.5 })
  a.set({ buzz: false })
  await a.wait(1300)
  // On again: the app says what it will do
  a.mark('on')
  await a.click({ at: 'sw-buzz', x: 0.5, y: 0.5 })
  a.set({ buzz: true, toast: true })
  await a.wait(2300)
  a.set({ toast: false })
  await a.wait(500)
  // The quiet way out opens a calm sheet
  a.mark('delete')
  await a.click({ at: 'delete', x: 0.5, y: 0.5 })
  a.set({ sheet: true })
  await a.wait(2300)
  a.mark('keep')
  await a.click({ at: 'keep', x: 0.9, y: 0.5 })
  a.set({ sheet: false })
  await a.wait(1400)
  await fadeOut(a, START, REST)
}

export default function MeSimple() {
  return (
    <Shell<M> initial={START} poster={POSTER} script={script} rest={REST}>
      {(s) => (
        <div className="ob-page gt-page s3-page s3-me">
          <div className="gt-title" data-away={s.toast || undefined}>
            <h1 className="ob-h1">Me</h1>
          </div>

          <Rise on={s.in} d={0}>
            <p className="ob-label s3-label--first">My player</p>
            <div className="s3-card s3-maya">
              <div className="s3-maya__top">
                <Num n="12" mine size={64} />
                <span className="s3-maya__text">
                  <b>Maya</b>
                  <small>#12 · Shortstop · Mustangs</small>
                </span>
              </div>
              <div className="s3-switchrow">
                <span>Tell me when Maya plays</span>
                <span className="gt-switch" data-on={s.buzz || undefined} data-target="sw-buzz"><i /></span>
              </div>
            </div>
          </Rise>

          <Rise on={s.in} d={0.15}>
            <p className="ob-label">Privacy</p>
            <div className="s3-card s3-priv">
              <div className="s3-priv__top">
                <span className="s3-tile"><Icon name="shield-check" size={22} /></span>
                <span className="s3-link">Change</span>
              </div>
              <p className="s3-priv__text">
                <span>Only <b>Mustangs families</b> see names.</span>
                <span>Public links show <b>numbers</b>.</span>
              </p>
            </div>
          </Rise>

          <Rise on={s.in} d={0.3}>
            <p className="ob-label">Account</p>
            <div className="s3-card s3-acct">
              <span className="s3-ava">C</span>
              <span className="s3-acct__text">
                <b>Christian</b>
                <small><AppleMark size={14} />Signed in with Apple</small>
              </span>
              <span className="s3-pill">Sign out</span>
            </div>
          </Rise>

          <Rise on={s.in} d={0.55} className="s3-delwrap">
            <span className="s3-del" data-target="delete">Delete account or remove Maya</span>
          </Rise>

          <Tabs on="me" />

          <div className="gt-toast" data-on={s.toast || undefined}>
            <span className="gt-toast__icon"><Icon name="bell" size={22} /></span>
            You’ll get a buzz when Maya bats
          </div>

          <div className="gt-scrim" data-on={s.sheet || undefined} />
          <div className="gt-sheet s3-sheet" data-open={s.sheet || undefined}>
            <span className="gt-grab" />
            <div className="gt-sheet__head">
              <span className="gt-sheet__tile gt-sheet__tile--red"><Icon name="bin-x" size={26} /></span>
              <h2 className="gt-h2">What do you want to remove?</h2>
              <p className="gt-sheet__p">Nothing changes until you confirm.</p>
            </div>
            <div className="s3-opts">
              <span className="s3-opt">
                <Num n="12" size={40} />
                <span className="s3-opt__text">
                  <b>Remove Maya</b>
                  <small>Her name and stats are deleted. Team games keep her as #12.</small>
                </span>
                <span className="s3-opt__go"><Icon name="caret-right" size={16} /></span>
              </span>
              <span className="s3-opt">
                <span className="s3-tile"><Icon name="user" size={20} /></span>
                <span className="s3-opt__text">
                  <b>Delete my account</b>
                  <small>You’re signed out and your follows go. The team keeps its games.</small>
                </span>
                <span className="s3-opt__go"><Icon name="caret-right" size={16} /></span>
              </span>
            </div>
            <span className="gt-btn s3-keep" data-target="keep">Keep everything</span>
          </div>

          <div className="fdx-fade" data-on={s.fade || undefined} />
        </div>
      )}
    </Shell>
  )
}
