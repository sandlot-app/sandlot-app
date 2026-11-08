import { Stage, Phone, Roll } from '../../kit'
import { Bases } from '../sandlot-shared/field'
import { Scene, Dots, START, POSTER, REST, script, type S } from '../sandlot-fieldday/scene'
import './park.css'

// Field Day scoreboard, take C: "The ballpark board". The green board in
// left field, shrunk onto the phone: runs by inning, then R H E, then a
// lit strip for balls, strikes and outs with the bases beside it. When
// Maya scores, the run turns over in the 4th, then R and H follow it.

const INNINGS = [1, 2, 3, 4, 5, 6]
const NOW = 4

function Tile({ children, now }: { children: string; now?: boolean }) {
  return (
    <span className="pk-tile" data-now={now || undefined}>
      <Roll>{children}</Roll>
    </span>
  )
}

export default function SandlotBoardPark() {
  return (
    <Stage<S>
      width={440}
      height={700}
      compact={{ below: 440, width: 358, height: 690 }}
      initial={START}
      poster={POSTER}
      script={script}
      cursor={{ at: REST, style: 'touch' }}
      className="fd pk"
    >
      {(s, _rect, layout) => {
        const mus = ['0', '1', '1', String(s.us - 2), '', '']
        const haw = ['1', '0', '0', '', '', '']
        return (
          <>
            <div className="fd-wash" />
            <Phone width={layout === 'compact' ? 326 : 340} className="fd-phone">
              <Scene
                s={s}
                board={
                  <header className="pk-board">
                    <div className="pk-grid">
                      <span />
                      {INNINGS.map((n) => (
                        <span key={n} className="pk-head" data-now={n === NOW || undefined}>{n}</span>
                      ))}
                      <span className="pk-head pk-head--sum">R</span>
                      <span className="pk-head">H</span>
                      <span className="pk-head">E</span>

                      <span className="pk-team" data-bat>
                        <i className="pk-team__bat" />
                        MUS
                      </span>
                      {mus.map((r, i) => <Tile key={i} now={i + 1 === NOW}>{r}</Tile>)}
                      <span className="pk-sum"><Tile>{String(s.us)}</Tile></span>
                      <Tile>{String(s.hits)}</Tile>
                      <Tile>0</Tile>

                      <span className="pk-team">HAW</span>
                      {haw.map((r, i) => <Tile key={i}>{r}</Tile>)}
                      <span className="pk-sum"><Tile>1</Tile></span>
                      <Tile>3</Tile>
                      <Tile>1</Tile>
                    </div>
                    <div className="pk-strip">
                      <span className="pk-light">Ball <Dots kind="ball" lit={s.balls} of={3} /></span>
                      <span className="pk-light">Strike <Dots kind="strike" lit={s.strikes} of={2} /></span>
                      <span className="pk-light">Out <Dots kind="out" lit={s.outs} of={2} /></span>
                      <Bases on={[s.liam === 1, s.maya === 2, false]} className="pk-bases" />
                    </div>
                  </header>
                }
              />
            </Phone>
          </>
        )
      }}
    </Stage>
  )
}
