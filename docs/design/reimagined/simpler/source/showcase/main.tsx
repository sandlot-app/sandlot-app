import { StrictMode, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import BoxOld from '../examples/sandlot-ga-box'
import BoxNew from '../examples/sandlot-s1-box-simple'
import CloseOld from '../examples/sandlot-ga-close'
import CloseNew from '../examples/sandlot-s1-close-simple'
import FixOld from '../examples/sandlot-gd-fix'
import FixNew from '../examples/sandlot-s2-fix-simple'
import MoreOld from '../examples/sandlot-gd-more'
import MoreNew from '../examples/sandlot-s2-more-simple'
import SetupOld from '../examples/sandlot-gb-setup'
import SetupNew from '../examples/sandlot-s3-setup-simple'
import MeOld from '../examples/sandlot-gt-me'
import MeNew from '../examples/sandlot-s3-me-simple'
import TeamOld from '../examples/sandlot-gt-team'
import TeamNew from '../examples/sandlot-s3-team-simple'
import './showcase.css'
import './simple.css'

type Pair = { id: string; name: string; line: string; removed: string; Old: ComponentType; New: ComponentType }

const PAIRS: Pair[] = [
  { id: 'box', name: 'Box score', line: 'One plain sentence per kid.', removed: 'The 7-column batting and pitching tables, positions, totals and limit notes. Maya’s line comes first (“2-for-3, a double, 2 runs, an RBI”), each pitcher gets one “58 of 75 pitches” bar, and the full table sits behind a link.', Old: BoxOld, New: BoxNew },
  { id: 'close', name: 'End of game', line: 'One card, one button, book closed.', removed: 'The linescore, the status pill, the gray locked button and the confirm sheet. “That’s the game!” waits by itself while the last play saves, then one tap closes the book and sends the recap.', Old: CloseOld, New: CloseNew },
  { id: 'fix', name: 'Fix a play', line: 'Fix the last play with two taps.', removed: 'The play list, the reopened step flow and the review sheet. Fix sits beside Undo on the saved card; pick what it really was, read one line of what changes, Save.', Old: FixOld, New: FixNew },
  { id: 'more', name: 'More menu', line: 'Four plays that really happen, or just say it.', removed: 'Wild pitch, passed ball, pickoff and substitution move behind “Other plays”, the group labels go, and a steal skips “who’s running?” when only one runner is on.', Old: MoreOld, New: MoreNew },
  { id: 'setup', name: 'Start a game', line: 'Everything filled in, one button.', removed: 'Game setup and Lineup become one screen filled from the schedule and last Saturday’s lineup. Season half and division hide behind Details; a missing Hawks lineup no longer blocks the button.', Old: SetupOld, New: SetupNew },
  { id: 'me', name: 'Me', line: 'One switch, one sentence, one account.', removed: 'Extra notification switches, the three-row privacy list and two separate red rows. Privacy is one readable sentence; remove and delete share one quiet link with a calm confirm.', Old: MeOld, New: MeNew },
  { id: 'team', name: 'Team', line: 'The roster at a glance, one button to invite.', removed: 'Roster rows with parents and positions, the people list and role badges (now behind “People and roles”). A small dot marks kids whose parents haven’t joined.', Old: TeamOld, New: TeamNew },
]

function Page() {
  return (
    <main className="sc">
      <header className="sc-head">
        <p className="sc-eyebrow">Sandlot · simpler screens</p>
        <h1>Seven screens, made simpler</h1>
        <p className="sc-lede">Each pair shows the current screen on the left and the simpler version on the right, same look, less to read.</p>
      </header>
      <div className="sp-list">
        {PAIRS.map(({ id, name, line, removed, Old, New }) => (
          <section key={id} className="sp-pair">
            <div className="sp-copy">
              <h2>{name}</h2>
              <p className="sc-line">{line}</p>
              <p className="sc-body"><b>Taken out or hidden:</b> {removed}</p>
            </div>
            <div className="sp-demos">
              <figure><figcaption>Now</figcaption><div className="sp-demo"><Old /></div></figure>
              <figure><figcaption data-new>Simpler</figcaption><div className="sp-demo"><New /></div></figure>
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<StrictMode><Page /></StrictMode>)
