import { type Act } from '../../kit'
import { Shell, Icon, Emblem, Who, Switch, Rise, Tabs, fadeOut } from '../sandlot-gr/gr'

// Under 13: Christian opens "Recruiting profile" for Maya, who is 10. The
// plan is firm: profiles are for players 13 and up, and no player under 13
// can be published or scouted. So there is nothing to set up. The screen says
// so kindly, says her stats keep counting, offers one quiet reminder, and
// points to Nico's profile for anyone curious how it will look.
//
// Beats: the card rises; the cursor flips the reminder on; a toast says it's
// set; it holds.

type U = { in: boolean; on: boolean; toast: boolean; fade: boolean }
const START: U = { in: false, on: false, toast: false, fade: false }
const POSTER: U = { in: true, on: true, toast: true, fade: false }
const REST = { x: 330, y: 760 }

const script = async (a: Act<U>) => {
  await a.wait(500)
  // The card rises over the paper
  a.mark('card')
  a.set({ in: true })
  await a.wait(2300)
  // Flip the reminder on
  a.mark('remind')
  await a.click({ at: 'sw-remind', x: 0.5, y: 0.5 })
  a.set({ on: true, toast: true })
  await a.wait(2600)
  a.mark('set')
  a.set({ toast: false })
  await a.wait(1600)
  await fadeOut(a, START, REST)
}

export default function Under13() {
  return (
    <Shell<U> initial={START} poster={POSTER} script={script} rest={REST} tag="gr-u13">
      {(s) => (
        <div className="ob-page gr-page gr-u13">
          <div className="gr-nav" data-away={s.toast || undefined}>
            <span className="gr-round"><Icon name="arrow-left" size={20} /></span>
            <span className="gr-nav__title">Recruiting profile</span>
            <span className="gr-round gr-round--ghost" />
          </div>

          <Who n="12" name="Maya" age={10} sub="Shortstop · Moraga Mustangs 10U" />

          <div className="gr-empty">
            <Rise on={s.in} d={0}>
              <div className="gr-ecard">
                <div className="gr-hero13">
                  <div className="gr-tile"><Emblem size={84} /></div>
                  <span className="gr-tile__13">13</span>
                </div>
                <h1>Profiles open at 13</h1>
                <p>Kids under 13 can’t be published or scouted. Maya’s stats keep counting, so her profile will be ready when she turns 13.</p>
                <div className="gr-remind">
                  <Icon name="bell" size={20} />
                  <span>Remind me when Maya turns 13</span>
                  <Switch on={s.on} target="sw-remind" />
                </div>
              </div>
            </Rise>
            <Rise on={s.in} d={0.25}>
              <span className="gr-seelink">See Nico’s profile<Icon name="caret-right" size={18} /></span>
            </Rise>
          </div>

          <Tabs on="me" />

          <div className="gr-toast" data-on={s.toast || undefined}>
            <span className="gr-toast__icon"><Icon name="bell" size={22} /></span>
            We’ll remind you when Maya turns 13
          </div>

          <div className="fdx-fade" data-on={s.fade || undefined} />
        </div>
      )}
    </Shell>
  )
}
