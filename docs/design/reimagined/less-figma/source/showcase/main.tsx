import { StrictMode, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import GamesOld from '../examples/sandlot-gb-games'
import GamesNew from '../examples/sandlot-u1-games-play'
import PreOld from '../examples/sandlot-gb-pregame'
import PreNew from '../examples/sandlot-u1-pregame-play'
import FinalOld from '../examples/sandlot-ga-summary'
import FinalNew from '../examples/sandlot-u2-final-play'
import BoxOld from '../examples/sandlot-s1-box-simple'
import BoxNew from '../examples/sandlot-u2-box-play'
import PlayerOld from '../examples/sandlot-fan-player'
import PlayerNew from '../examples/sandlot-u3-player-play'
import TeamOld from '../examples/sandlot-s3-team-simple'
import TeamNew from '../examples/sandlot-u3-team-play'
import './showcase.css'
import './simple.css'

type Pair = { id: string; name: string; line: string; removed: string; Old: ComponentType; New: ComponentType }

const PAIRS: Pair[] = [
  { id: 'games', name: 'Game day board', line: 'Today’s game is a little live field.', removed: 'Gray list rows, the All / Following toggle and the search field. The live game is a field card with the score bug (“Maya scored” flags at the plate), upcoming games are ticket stubs you swipe, past games are scoreboard plates.', Old: GamesOld, New: GamesNew },
  { id: 'pregame', name: 'Before first pitch', line: 'The Mustangs run out in batting order.', removed: 'The batting-order list card. The orange chips run out of the dugout and line up along the first-base line in order, Maya glowing; the countdown is a pennant on the foul pole.', Old: PreOld, New: PreNew },
  { id: 'final', name: 'Final scoreboard', line: 'The game ends on the field.', removed: 'The tab strip, linescore table and pitcher rows. A FINAL board hangs over the outfield with runs by inning as lit squares, Maya’s hits draw on the grass, and one ticket below holds her line and the recap.', Old: FinalOld, New: FinalNew },
  { id: 'box', name: 'Box score cards', line: 'A deck of baseball cards you swipe.', removed: 'The team toggle and list rows. One card per kid with a mini field of their balls in play and one line; pitchers flip to show pitches used; the Hawks are a small stack to the side.', Old: BoxOld, New: BoxNew },
  { id: 'player', name: 'Maya’s card', line: 'Her own trading card. Tap to flip.', removed: 'The Today / Season control, stat tiles and list card. The front has today on a little field with big numbers; the back is the season on cream card stock with stamped recent games.', Old: PlayerOld, New: PlayerNew },
  { id: 'team', name: 'Team on the field', line: 'The Mustangs, standing where they play.', removed: 'The roster grid and people list. Every kid stands at their position, the bench sits in the dugout, a pennant carries the record, and dots turn into checks as parents join.', Old: TeamOld, New: TeamNew },
]

function Page() {
  return (
    <main className="sc">
      <header className="sc-head">
        <p className="sc-eyebrow">Sandlot · less like Figma</p>
        <h1>Six screens, made out of baseball things</h1>
        <p className="sc-lede">The current screen on the left, the new one on the right: no lists, tables or tab strips, just the field, cards, tickets and scoreboards.</p>
      </header>
      <div className="sp-list">
        {PAIRS.map(({ id, name, line, removed, Old, New }) => (
          <section key={id} className="sp-pair">
            <div className="sp-copy">
              <h2>{name}</h2>
              <p className="sc-line">{line}</p>
              <p className="sc-body"><b>Replaced:</b> {removed}</p>
            </div>
            <div className="sp-demos">
              <figure><figcaption>Now</figcaption><div className="sp-demo"><Old /></div></figure>
              <figure><figcaption data-new>New</figcaption><div className="sp-demo"><New /></div></figure>
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<StrictMode><Page /></StrictMode>)
