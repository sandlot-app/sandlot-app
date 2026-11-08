import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import Day from '../examples/sandlot-park-day'
import Cam from '../examples/sandlot-park-cam'
import Golden from '../examples/sandlot-park-golden'
import './showcase.css'

const DESIGNS = [
  {
    id: 'day',
    n: 'A',
    name: 'Ballpark',
    line: 'A real park on a sunny afternoon.',
    body: 'A standing outfield wall with its distances, stands full of fans, a dark batter’s eye in center, a mowed checkerboard, and chalked batter’s and coach’s boxes. The Hawks play the hit: the left fielder runs the ball down and throws to second while the run scores.',
    from: 'Best for: an every-game look that stays calm.',
    Demo: Day,
  },
  {
    id: 'cam',
    n: 'B',
    name: 'Broadcast cam',
    line: 'The camera follows the ball, like TV.',
    body: 'The same park, but the camera pushes in toward left field as the ball is hit, then pulls back to show the run come home. The ball’s flight is drawn in orange, a tag marks where it landed, and the throw to second is traced in gold.',
    from: 'Best for: the most exciting replay of each play.',
    Demo: Cam,
  },
  {
    id: 'golden',
    n: 'C',
    name: 'Golden hour',
    line: 'The last inning before the lights.',
    body: 'The same park in late light: a warm sky, the stands throwing their shadow across the outfield, and long shadows trailing every player. It feels like a summer evening game.',
    from: 'Best for: the warmest, most cinematic feel.',
    Demo: Golden,
  },
]

function Page() {
  return (
    <main className="sc">
      <header className="sc-head">
        <p className="sc-eyebrow">Sandlot · Field Day, round 3</p>
        <h1>Three ballparks for Field Day</h1>
        <p className="sc-lede">Same TV score bug, same mic. A real park with the Hawks in the field, three ways to film it.</p>
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
