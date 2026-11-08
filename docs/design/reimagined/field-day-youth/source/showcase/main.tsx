import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import League from '../examples/sandlot-youth-league'
import Rec from '../examples/sandlot-youth-rec'
import Park from '../examples/sandlot-youth-park'
import './showcase.css'

const DESIGNS = [
  {
    id: 'league',
    n: 'A',
    name: 'Little League field',
    line: 'The field most kids play on.',
    body: 'A grass infield with a dirt arc, a chain-link outfield fence with a yellow safety top, trees past the fence, and aluminum bleachers down each line with parents in them. The grass is worn where the outfielders stand.',
    from: 'Best for: the classic Saturday-morning look.',
    Demo: League,
  },
  {
    id: 'rec',
    n: 'B',
    name: 'Rec field',
    line: 'An all-dirt infield and team banners.',
    body: 'The same field with a full dirt infield, like many rec and softball fields, and team-colored banners hung on the outfield fence.',
    from: 'Best for: town rec leagues and softball.',
    Demo: Rec,
  },
  {
    id: 'park',
    n: 'C',
    name: 'Park field',
    line: 'No real fence, just the park.',
    body: 'An orange temporary fence staked out on the grass, with the park and its trees beyond. The simplest, most open of the three.',
    from: 'Best for: younger divisions and pick-up games.',
    Demo: Park,
  },
]

function Page() {
  return (
    <main className="sc">
      <header className="sc-head">
        <p className="sc-eyebrow">Sandlot · Field Day, round 4</p>
        <h1>Three youth fields for Field Day</h1>
        <p className="sc-lede">Same TV score bug, same mic. A real youth field with the Hawks in the field: the left fielder runs it down and throws to second.</p>
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
