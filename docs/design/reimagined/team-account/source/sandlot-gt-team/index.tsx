import { States, type Act } from '../../kit'
import { Shell, Icon, Emblem, Tabs, Num, Role, type RoleKind } from '../sandlot-gt/gt'

// Team tab. Coach Dan runs the Mustangs (admin); Christian is on it as the
// scorekeeper and as Maya's dad. The roster says who follows each kid, so a
// team parent can see at a glance who hasn't joined, and Invite parents is
// the one big button: a link the parent texts from the share sheet.

type T = { sheet: boolean; copied: boolean; toast: boolean; fade: boolean }
const START: T = { sheet: false, copied: false, toast: false, fade: false }
const POSTER: T = { sheet: false, copied: true, toast: true, fade: false }

const script = async (a: Act<T>) => {
  await a.wait(700)
  a.mark('invite')
  await a.click('invite')
  a.set({ sheet: true })
  await a.wait(1700)
  a.mark('sheet')
  await a.click('copy')
  a.set({ copied: true })
  await a.wait(750)
  a.set({ sheet: false })
  await a.wait(600)
  a.mark('toast')
  a.set({ toast: true })
  await a.wait(2800)
  a.set({ fade: true })
  await a.wait(450)
  await a.snap({ ...START, fade: true })
  await a.wait(80)
  a.set({ fade: false })
  await a.move({ x: 330, y: 520 })
}

const ROSTER = [
  { n: '12', name: 'Maya', pos: 'SS', who: 'Christian · Dad', mine: true },
  { n: '3', name: 'Ava', pos: '1B', who: 'Jen · Mom' },
  { n: '4', name: 'Zoe', pos: '2B', who: '' },
  { n: '5', name: 'Mia', pos: 'LF', who: 'Sara · Mom' },
]

const PEOPLE: { i: string; name: string; you?: boolean; tone: string; roles: RoleKind[] }[] = [
  { i: 'D', name: 'Coach Dan', tone: '#c8915f', roles: ['Admin'] },
  { i: 'C', name: 'Christian', you: true, tone: '#0c4c39', roles: ['Scorekeeper', 'Parent'] },
  { i: 'J', name: 'Jen', tone: '#4f8a6e', roles: ['Parent'] },
  { i: 'R', name: 'Ruth', tone: '#8a948e', roles: ['Fan'] },
]

export default function Team() {
  return (
    <Shell<T> initial={START} poster={POSTER} script={script} rest={{ x: 330, y: 520 }}>
      {(s) => (
        <div className="ob-page gt-page">
          <div className="gt-title" data-away={s.toast || undefined}>
            <h1 className="ob-h1">Team</h1>
            <span className="ob-avatar">C</span>
          </div>

          <div className="gt-team">
            <div className="gt-team__top">
              <span className="gt-team__badge"><Emblem size={30} /></span>
              <span className="gt-team__text">
                <span className="gt-team__name">Moraga Mustangs</span>
                <span className="gt-team__sub">10U Rec · Fall 2026</span>
              </span>
              <span className="gt-record"><b>6–2</b>Record</span>
            </div>
            <span className="ob-keep" data-target="invite"><Icon name="user-add" size={22} />Invite parents</span>
          </div>

          <div className="gt-sect"><span className="ob-label">Roster · 12</span><span className="gt-link">See all</span></div>
          <div className="ob-list gt-list">
            {ROSTER.map((r) => (
              <span key={r.n} className="gt-rrow">
                <Num n={r.n} mine={r.mine} />
                <span className="gt-rrow__text">
                  <span className="gt-rrow__name">{r.name}</span>
                  <span className="gt-rrow__sub" data-open={!r.who || undefined}>{r.who || 'Not claimed yet'}</span>
                </span>
                <span className="gt-pos">{r.pos}</span>
              </span>
            ))}
          </div>

          <div className="gt-sect"><span className="ob-label">People · 14</span><span className="gt-link">See all</span></div>
          <div className="ob-list gt-list">
            {PEOPLE.map((p) => (
              <span key={p.name} className="gt-prow">
                <span className="gt-ava" style={{ background: p.tone }}>{p.i}</span>
                <span className="gt-prow__name">{p.name}{p.you && <i> · You</i>}</span>
                <span className="gt-prow__roles">{p.roles.map((r) => <Role key={r} kind={r} />)}</span>
              </span>
            ))}
          </div>

          <Tabs on="team" />

          <div className="gt-scrim" data-on={s.sheet || undefined} />
          <div className="gt-sheet" data-open={s.sheet || undefined}>
            <span className="gt-grab" />
            <div className="gt-sheet__head">
              <span className="gt-sheet__tile"><Icon name="user-add" size={26} /></span>
              <h2 className="gt-h2">Invite parents</h2>
              <p className="gt-sheet__p">Anyone with this link joins Moraga Mustangs and picks their player.</p>
            </div>
            <div className="gt-linkcard" data-hot={s.copied || undefined}>
              <span className="gt-linkcard__icon"><Icon name="link" size={20} /></span>
              <span className="gt-linkcard__url">sandlot.app/join/<b>mustangs-10u</b></span>
            </div>
            <div className="gt-btns">
              <span className="gt-btn gt-btn--main" data-target="text"><Icon name="message-circle" size={20} />Text the link</span>
              <span className="gt-btn" data-target="copy" data-done={s.copied || undefined}>
                <States
                  value={s.copied ? 'done' : 'idle'}
                  states={{
                    idle: <span className="gt-btn__in"><Icon name="copy" size={20} />Copy</span>,
                    done: <span className="gt-btn__in"><Icon name="check" size={20} />Copied</span>,
                  }}
                />
              </span>
            </div>
            <p className="gt-fine">Parents sign in with Apple or Google. Accounts are for adults.</p>
          </div>

          <div className="gt-toast" data-on={s.toast || undefined}>
            <span className="gt-toast__icon"><Icon name="check-circle" size={22} /></span>
            Link copied. 3 parents joined this week.
          </div>
          <div className="fdx-fade" data-on={s.fade || undefined} />
        </div>
      )}
    </Shell>
  )
}
