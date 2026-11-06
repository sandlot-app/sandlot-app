import { Avatar, type Act } from '../../kit'
import { Shell, Icon, AppleMark, Tabs, Num, Tick } from '../sandlot-gt/gt'

// Me. Christian's settings: who he is, which kid is his, what pings his phone,
// and what stays private. Removing a child or the account lives here and
// takes a calm sheet that says exactly what goes and what stays (plan:
// "In-app deletion of a child or an account"). The story ends on Keep: the
// sheet is the point, and deletion never plays out on screen.

type M = { reminders: boolean; sheet: boolean; fade: boolean }
const START: M = { reminders: false, sheet: false, fade: false }
const POSTER: M = { reminders: true, sheet: true, fade: false }

const script = async (a: Act<M>) => {
  await a.wait(700)
  a.mark('toggle')
  await a.click('sw-reminders')
  a.set({ reminders: true })
  await a.wait(1500)
  a.mark('remove')
  await a.click({ at: 'remove', x: 0.9, y: 0.5 })
  a.set({ sheet: true })
  await a.wait(2600)
  a.mark('confirm')
  await a.click('keep')
  a.set({ sheet: false })
  await a.wait(1800)
  a.set({ fade: true })
  await a.wait(450)
  await a.snap({ ...START, fade: true })
  await a.wait(80)
  a.set({ fade: false })
  await a.move({ x: 330, y: 330 })
}

function Switch({ on, id }: { on: boolean; id: string }) {
  return (
    <span className="gt-switch" data-on={on || undefined} data-target={id}>
      <i />
    </span>
  )
}

function Tile({ icon, tone }: { icon: string; tone: 'orange' | 'green' | 'red' }) {
  return (
    <span className="gt-tile" data-tone={tone}>
      <Icon name={icon} size={18} />
    </span>
  )
}

export default function Me() {
  return (
    <Shell<M> initial={START} poster={POSTER} script={script} rest={{ x: 330, y: 330 }}>
      {(s) => (
        <div className="ob-page gt-page">
          <div className="gt-title">
            <h1 className="ob-h1">Me</h1>
          </div>

          <div className="gt-profile">
            <Avatar name="Christian" size={48} tone="ink" className="gt-profile__ava" />
            <span className="gt-profile__text">
              <span className="gt-profile__name">Christian</span>
              <span className="gt-profile__sub"><AppleMark size={14} />Signed in with Apple</span>
            </span>
          </div>

          <p className="ob-label">My players</p>
          <div className="ob-list gt-list">
            <span className="gt-kid">
              <Num n="12" mine size={42} />
              <span className="gt-kid__text">
                <span className="gt-kid__name">Maya</span>
                <span className="gt-kid__sub">Shortstop · Moraga Mustangs</span>
              </span>
              <span className="gt-claimed"><Tick size={12} />Claimed</span>
            </span>
          </div>

          <p className="ob-label">Notifications</p>
          <div className="ob-list gt-list">
            <span className="gt-srow">
              <Tile icon="bell" tone="orange" />
              <span className="gt-srow__label">When Maya plays</span>
              <Switch on id="sw-plays" />
            </span>
            <span className="gt-srow">
              <Tile icon="flag" tone="orange" />
              <span className="gt-srow__label">Final scores</span>
              <Switch on id="sw-finals" />
            </span>
            <span className="gt-srow">
              <Tile icon="alarm" tone="orange" />
              <span className="gt-srow__label">Game reminders</span>
              <Switch on={s.reminders} id="sw-reminders" />
            </span>
          </div>

          <p className="ob-label">Privacy</p>
          <div className="ob-list gt-list">
            <span className="gt-srow">
              <Tile icon="users" tone="green" />
              <span className="gt-srow__label">Who sees names</span>
              <span className="gt-srow__val">Team families only</span>
              <span className="gt-srow__go"><Icon name="caret-right" size={14} /></span>
            </span>
            <span className="gt-srow">
              <Tile icon="globe" tone="green" />
              <span className="gt-srow__label">Public link</span>
              <span className="gt-srow__val">Numbers only</span>
            </span>
            <span className="gt-srow">
              <Tile icon="mic" tone="green" />
              <span className="gt-srow__label">Voice clips</span>
              <span className="gt-srow__val">Deleted after 30 days</span>
            </span>
          </div>

          <div className="ob-list gt-list gt-danger">
            <span className="gt-srow" data-danger data-target="remove">
              <Tile icon="bin-x" tone="red" />
              <span className="gt-srow__label">Remove Maya from Sandlot</span>
            </span>
            <span className="gt-srow" data-danger>
              <Tile icon="bin" tone="red" />
              <span className="gt-srow__label">Delete my account</span>
            </span>
          </div>

          <Tabs on="me" />

          <div className="gt-scrim" data-on={s.sheet || undefined} />
          <div className="gt-sheet" data-open={s.sheet || undefined}>
            <span className="gt-grab" />
            <div className="gt-sheet__head">
              <span className="gt-sheet__tile gt-sheet__tile--red"><Icon name="bin-x" size={26} /></span>
              <h2 className="gt-h2">Remove Maya from Sandlot?</h2>
              <p className="gt-sheet__p">Here is what happens.</p>
            </div>
            <div className="gt-facts">
              <span className="gt-fact">
                <span className="gt-fact__lead gt-fact__lead--bin"><Icon name="bin" size={18} /></span>
                <span className="gt-fact__text">
                  <span className="gt-fact__title">Her name and stats are deleted</span>
                  <span className="gt-fact__sub">That includes her .412 season.</span>
                </span>
              </span>
              <span className="gt-fact">
                <Num n="12" size={36} />
                <span className="gt-fact__text">
                  <span className="gt-fact__title">Team games keep her as #12</span>
                  <span className="gt-fact__sub">Scores and box scores stay right.</span>
                </span>
              </span>
            </div>
            <div className="gt-stack">
              <span className="gt-btn gt-btn--red" data-target="removeok">Remove Maya</span>
              <span className="gt-btn" data-target="keep">Keep</span>
            </div>
          </div>

          <div className="fdx-fade" data-on={s.fade || undefined} />
        </div>
      )}
    </Shell>
  )
}
