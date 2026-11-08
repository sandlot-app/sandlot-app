import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Tv from '../examples/sandlot-board-tv'
import Buttons from '../examples/sandlot-board-buttons'
import Park from '../examples/sandlot-board-park'
import './showcase.css'

const DESIGNS = [
  {
    id: 'tv',
    n: 'A',
    name: 'TV score bug',
    line: 'The corner graphic from a broadcast.',
    body: 'Both teams stacked with their runs, the bases with the outs under them, then the inning with balls and strikes as dots. The dots are the same green and yellow as the Ball and Strike buttons, so a tap lights the matching dot.',
    from: 'Best for: seeing everything at once in one small card.',
    Demo: Tv,
  },
  {
    id: 'buttons',
    n: 'B',
    name: 'Count on the buttons',
    line: 'The number you change is under your thumb.',
    body: 'The board on top only answers who’s winning and where: big score, inning, outs and bases. Balls and strikes live on the Ball and Strike buttons, each with its number and a ring that fills one piece per tap.',
    from: 'Best for: the fewest things to read, and the hardest count to lose track of.',
    Demo: Buttons,
  },
  {
    id: 'park',
    n: 'C',
    name: 'Ballpark board',
    line: 'The green board from left field.',
    body: 'Runs by inning, then runs, hits and errors, with a lit strip for balls, strikes and outs. When the run scores, it turns over in the 4th inning box, then the R and H totals follow.',
    from: 'Best for: parents who want the whole game, not just the score.',
    Demo: Park,
  },
]

function Page() {
  return (
    <main className="sc">
      <header className="sc-head">
        <p className="sc-eyebrow">Sandlot · Field Day, round 2</p>
        <h1>Three scoreboards for Field Day</h1>
        <p className="sc-lede">Same field, same mic. Watch each board keep up: a Ball, a Strike, the play said out loud, then Undo.</p>
      </header>
      <section className="sc-grid">
        {DESIGNS.map(({ id, n, name, line, body, from, Demo }) => (
          <article key={id} className="sc-card">
            <div className="sc-demo"><Demo /></div>
            <div className="sc-copy">
              <p className="sc-n">Option {n}</p>
              <h2>{name}</h2>
              <p className="sc-line">{line}</p>
              <p className="sc-body">{body}</p>
              <p className="sc-from">{from}</p>
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<StrictMode><Page /></StrictMode>)
