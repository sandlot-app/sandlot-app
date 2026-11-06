import { Count, States, type Act } from '../../kit'
import { Shell, Icon, Who, Verified, Imported, Clip, Rise, fadeOut } from '../sandlot-gr/gr'

// Recruiting profile, the parent's side. One calm screen about Nico (15):
// who he is, one big choice (who can see this), his verified stats with the
// imported ones kept apart, three clips, and one button to share.
//
// Beats: the screen opens and the stats count up; the parent picks "Plus
// verified scouts" and one plain sentence says what that means; a verified
// scout asks to contact the family and a card drops in from the top; Approve
// turns the card into "Shared your email with this scout"; the card leaves.
// The decision always stays with the parent: the profile never shows contact
// details and the scout's request comes to the parent (docs/plan.md).

type Choice = 'link' | 'scouts' | 'off'
type P = { in: boolean; choice: Choice; card: boolean; done: boolean; fade: boolean }
const START: P = { in: true, choice: 'link', card: false, done: false, fade: false }
const POSTER: P = { in: true, choice: 'scouts', card: true, done: false, fade: false }
const REST = { x: 330, y: 700 }

const script = async (a: Act<P>) => {
  await a.wait(1600)
  // The parent picks who can see Nico's profile
  a.mark('pick')
  await a.click({ at: 'opt-scouts', x: 0.58, y: 0.2 })
  a.set({ choice: 'scouts' })
  await a.wait(2300)
  // A verified scout wants to reach the family: the card drops in
  a.mark('request')
  a.set({ card: true })
  await a.wait(2100)
  // Approve: the same card says it's done
  a.mark('approve')
  await a.click({ at: 'approve', x: 0.5, y: 0.5 })
  a.set({ done: true })
  await a.wait(2400)
  a.mark('done')
  a.set({ card: false })
  await a.wait(1200)
  await fadeOut(a, START, REST)
}

const OPTS: { id: Choice; icon: 'users' | 'shield-check' | 'eye-slash'; label: string }[] = [
  { id: 'link', icon: 'users', label: 'Only people I share with' },
  { id: 'scouts', icon: 'shield-check', label: 'Plus verified scouts' },
  { id: 'off', icon: 'eye-slash', label: 'Off' },
]

const NOTES: Record<Choice, string> = {
  link: 'Only people with your link can open Nico’s profile.',
  scouts: 'Verified scouts can find Nico. They never see your contact info; requests come to you.',
  off: 'Nobody can open Nico’s profile, and your link stops working.',
}

const avg = (n: number) => `.${String(Math.round(n)).padStart(3, '0')}`

export default function RecruitingProfile() {
  return (
    <Shell<P> initial={START} poster={POSTER} script={script} rest={REST} tag="gr-profile">
      {(s) => (
        <div className="ob-page gr-page gr-profile">
          <div className="gr-nav">
            <span className="gr-round"><Icon name="arrow-left" size={20} /></span>
            <span className="gr-nav__title">Recruiting profile</span>
            <span className="gr-round gr-round--ghost" />
          </div>

          <Rise on={s.in} d={0}>
            <Who n="8" name="Nico" age={15} sub="Center field · Moraga Mustangs 15U" />
          </Rise>

          <Rise on={s.in} d={0.12}>
            <h2 className="gr-h2">Who can see this</h2>
            <div className="gr-opts">
              {OPTS.map((o) => (
                <span key={o.id} className="gr-opt" data-target={`opt-${o.id}`} data-on={s.choice === o.id || undefined}>
                  <span className="gr-opt__icon"><Icon name={o.icon} size={22} /></span>
                  <span className="gr-opt__label">{o.label}</span>
                  <span className="gr-opt__check"><Icon name="check" size={14} /></span>
                </span>
              ))}
            </div>
            <div className="gr-note">
              <States value={s.choice} align="start" states={{ link: <span>{NOTES.link}</span>, scouts: <span>{NOTES.scouts}</span>, off: <span>{NOTES.off}</span> }} />
            </div>
          </Rise>

          <Rise on={s.in} d={0.26}>
            <div className="gr-stats">
              <div className="gr-stats__top">
                <Verified />
                <span className="gr-stats__games">9 games</span>
              </div>
              <div className="gr-stats__row">
                <span className="gr-stat"><b><Count value={s.in ? 386 : 0} format={avg} duration={900} /></b><small>Batting avg</small></span>
                <span className="gr-stat"><b><Count value={s.in ? 22 : 0} duration={900} /></b><small>Hits</small></span>
                <span className="gr-stat"><b><Count value={s.in ? 14 : 0} duration={900} /></b><small>Steals</small></span>
              </div>
            </div>
            <Imported />
          </Rise>

          <Rise on={s.in} d={0.4}>
            <p className="gr-label">Clips</p>
            <div className="gr-clips">
              <Clip i={0} tall />
              <Clip i={1} tall />
              <Clip i={2} tall />
            </div>
          </Rise>

          <Rise on={s.in} d={0.52}>
            <span className="gr-cta" data-target="share"><span className="gr-cta__in"><Icon name="share" size={20} />Share Nico’s profile</span></span>
          </Rise>

          <div className="gr-req" data-open={s.card || undefined} data-done={s.done || undefined}>
            <div className="gr-req__layers">
              <div className="gr-req__ask">
                <div className="gr-req__top">
                  <span className="gr-req__tile"><Icon name="shield-check" size={24} /></span>
                  <span className="gr-req__text">A verified college scout wants to contact you about Nico</span>
                </div>
                <div className="gr-req__btns">
                  <span className="gr-btn gr-btn--main" data-target="approve">Approve</span>
                  <span className="gr-btn gr-btn--soft">Not now</span>
                </div>
              </div>
              <div className="gr-req__ok">
                <span className="gr-req__check"><Icon name="check" size={24} /></span>
                <span className="gr-req__okt">
                  <b>Shared your email with this scout</b>
                  <small>They’ll write to you directly.</small>
                </span>
              </div>
            </div>
          </div>

          <div className="fdx-fade" data-on={s.fade || undefined} />
        </div>
      )}
    </Shell>
  )
}
