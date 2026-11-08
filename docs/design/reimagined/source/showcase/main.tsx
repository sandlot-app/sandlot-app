import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Field from '../examples/sandlot-field'
import Night from '../examples/sandlot-night'
import Book from '../examples/sandlot-book'
import './showcase.css'

const DESIGNS = [
  {
    id: 'field',
    n: '1',
    name: 'Field Day',
    line: 'The field is the app.',
    body: 'A sunny broadcast view of your own diamond. Tap the mic once and say the play: the ball flies off the bat, runners round the bases, the score rolls. One Undo fixes any mistake. Ball and Strike stay one tap away.',
    from: 'Kept from today: the green scoreboard pill, named player chips, “All plays saved”.',
    Demo: Field,
  },
  {
    id: 'night',
    n: '2',
    name: 'Night Game',
    line: 'Your phone becomes the ballpark.',
    body: 'A real LED scoreboard on top, a field glowing under the lights, and one lit button. A home run leaves a comet trail over the fence, the board flashes HOME RUN, and both runners come round to score.',
    from: 'Kept from today: score, inning, count and outs, the little base diamond.',
    Demo: Night,
  },
  {
    id: 'book',
    n: '3',
    name: 'The Book',
    line: 'The paper scorebook, alive.',
    body: 'Every batter gets a square with a printed diamond. Say the play and a pen inks it like a real scorekeeper: the hit line, the path to second, “2B” in the corner. Then the book moves on to the next batter.',
    from: 'Kept from today: the line score and lineup, now in the scorebook parents already know.',
    Demo: Book,
  },
]

function Page() {
  return (
    <main className="sc">
      <header className="sc-head">
        <p className="sc-eyebrow">Sandlot · reimagined</p>
        <h1>Three new ways to keep the book</h1>
        <p className="sc-lede">One big button. Say the play. Watch it happen on the field.</p>
      </header>
      <section className="sc-grid">
        {DESIGNS.map(({ id, n, name, line, body, from, Demo }) => (
          <article key={id} className="sc-card">
            <div className="sc-demo"><Demo /></div>
            <div className="sc-copy">
              <p className="sc-n">Design {n}</p>
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
