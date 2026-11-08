import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import TapField from '../examples/sandlot-tap-field'
import TapTiles from '../examples/sandlot-tap-tiles'
import TapSentence from '../examples/sandlot-tap-sentence'
import './showcase.css'

const DESIGNS = [
  {
    id: 'field',
    n: 'A',
    name: 'Tap the field',
    line: 'Show where it went, then say what it was.',
    body: 'Ball, Strike and Foul are one tap each. When the ball is hit, tap the spot on the field where it went. A pin drops there and a small menu opens beside it: Single, Double, Out or More. Two taps, and the play runs on the field.',
    from: 'Taps for this play: 2 (the spot, then Single).',
    Demo: TapField,
  },
  {
    id: 'tiles',
    n: 'B',
    name: 'Big buttons',
    line: 'One question at a time.',
    body: 'Four big tiles: Ball, Strike, Foul and In play. In play asks what happened (Single, Double, Triple, Home run, Out, Error), then where it went (Left, Center, Right). Each step is one easy question with big targets.',
    from: 'Taps for this play: 3 (In play, Single, Left).',
    Demo: TapTiles,
  },
  {
    id: 'sentence',
    n: 'C',
    name: 'Tap the sentence',
    line: 'Build what you would have said.',
    body: 'The play reads as a sentence while you tap word chips: “Liam singles”, then “to left”. The app fills in the runners (“Maya scores”) and asks once if that’s right before you save. Same result as saying it out loud.',
    from: 'Taps for this play: 3 (singles, to left, Save play).',
    Demo: TapSentence,
  },
]

function Page() {
  return (
    <main className="sc">
      <header className="sc-head">
        <p className="sc-eyebrow">Sandlot · Field Day without voice</p>
        <h1>Three ways to score by tapping</h1>
        <p className="sc-lede">Same Rec field, same TV score bug. No mic: each option records the same single to left, then Undo.</p>
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
