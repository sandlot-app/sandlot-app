import { Stage, Phone, Count, Roll } from '../../kit'
import { Bases } from '../sandlot-shared/field'
import { Scene, Dots, START, POSTER, REST, script, type S } from '../sandlot-fieldday/scene'
import './buttons.css'

// Field Day scoreboard, take B: "The count lives on the buttons". The board
// on top only answers who's winning and where: the score, the inning, the
// outs and the bases, in today's green. Balls and strikes move down onto
// the Ball and Strike buttons themselves, so the number you are changing
// is under your thumb: each button carries its count and a ring that fills
// one segment per tap (three balls, two strikes; the next one ends the
// at-bat).

// One ring segment per possible ball or strike, drawn round a 76 circle
function Ring({ lit, of, kind }: { lit: number; of: number; kind: 'ball' | 'strike' }) {
  const r = 35
  const c = 2 * Math.PI * r
  const gap = 7
  const seg = c / of - gap
  return (
    <svg className={`bt-ring bt-ring--${kind}`} width="76" height="76" viewBox="0 0 76 76" aria-hidden>
      {Array.from({ length: of }, (_, i) => (
        <circle
          key={i}
          cx="38"
          cy="38"
          r={r}
          strokeDasharray={`${seg} ${c - seg}`}
          strokeDashoffset={-(i * (c / of)) - gap / 2 + c / 4}
          data-on={i < lit || undefined}
        />
      ))}
    </svg>
  )
}

function CountButton({ kind, lit }: { kind: 'ball' | 'strike'; lit: number }) {
  return (
    <span className="bt-tap" data-target={kind}>
      <span className="bt-tap__btn">
        <Ring kind={kind} lit={lit} of={kind === 'ball' ? 3 : 2} />
        <span className="bt-tap__n"><Roll>{String(lit)}</Roll></span>
      </span>
      <span className="bt-tap__label">{kind === 'ball' ? (lit === 1 ? 'Ball' : 'Balls') : lit === 1 ? 'Strike' : 'Strikes'}</span>
    </span>
  )
}

export default function SandlotBoardButtons() {
  return (
    <Stage<S>
      width={440}
      height={700}
      compact={{ below: 440, width: 358, height: 690 }}
      initial={START}
      poster={{ ...POSTER, balls: 0, strikes: 0 }}
      script={script}
      cursor={{ at: REST, style: 'touch' }}
      className="fd bt"
    >
      {(s, _rect, layout) => (
        <>
          <div className="fd-wash" />
          <Phone width={layout === 'compact' ? 326 : 340} className="fd-phone">
            <Scene
              s={s}
              board={
                <header className="bt-board">
                  <span className="bt-team">
                    <span className="bt-team__name">Mustangs</span>
                    <span className="bt-team__runs"><Count value={s.us} duration={650} /></span>
                  </span>
                  <span className="bt-mid">
                    <span className="bt-inning">Top 4</span>
                    <Bases on={[s.liam === 1, s.maya === 2, false]} className="bt-bases" />
                    <span className="bt-outs">
                      <Dots kind="out" lit={s.outs} of={2} />
                      1 out
                    </span>
                  </span>
                  <span className="bt-team bt-team--away">
                    <span className="bt-team__name">Hawks</span>
                    <span className="bt-team__runs">1</span>
                  </span>
                </header>
              }
              ball={<CountButton kind="ball" lit={s.balls} />}
              strike={<CountButton kind="strike" lit={s.strikes} />}
            />
          </Phone>
        </>
      )}
    </Stage>
  )
}
