import { Stage, Phone, Count } from '../../kit'
import { Bases } from '../sandlot-shared/field'
import { Scene, Dots, START, POSTER, REST, script, type S } from '../sandlot-fieldday/scene'
import './tv.css'

// Field Day scoreboard, take A: "TV score bug". The corner graphic every
// parent has seen on a broadcast, made big enough to read in the sun: both
// teams stacked with their runs, the bases with the outs under them, and
// the inning with balls and strikes as dots in the same green and yellow
// as the buttons that fill them.

export default function SandlotBoardTv() {
  return (
    <Stage<S>
      width={440}
      height={700}
      compact={{ below: 440, width: 358, height: 690 }}
      initial={START}
      poster={POSTER}
      script={script}
      cursor={{ at: REST, style: 'touch' }}
      className="fd tv"
    >
      {(s, _rect, layout) => (
        <>
          <div className="fd-wash" />
          <Phone width={layout === 'compact' ? 326 : 340} className="fd-phone">
            <Scene
              s={s}
              board={
                <header className="tv-bug">
                  <div className="tv-teams">
                    <span className="tv-team" data-bat>
                      <i className="tv-team__stripe" />
                      <span className="tv-team__name">MUS</span>
                      <span className="tv-team__runs"><Count value={s.us} duration={650} /></span>
                    </span>
                    <span className="tv-team">
                      <i className="tv-team__stripe tv-team__stripe--away" />
                      <span className="tv-team__name">HAW</span>
                      <span className="tv-team__runs">1</span>
                    </span>
                  </div>
                  <div className="tv-diamond">
                    <Bases on={[s.liam === 1, s.maya === 2, false]} className="tv-bases" />
                    <span className="tv-row">
                      <span className="tv-label">Out</span>
                      <Dots kind="out" lit={s.outs} of={2} />
                    </span>
                  </div>
                  <div className="tv-count">
                    <span className="tv-inning">
                      <svg width="9" height="8" viewBox="0 0 9 8" aria-hidden><path d="M4.5 0 9 8H0Z" fill="currentColor" /></svg>
                      Top 4
                    </span>
                    <span className="tv-row">
                      <span className="tv-label">Ball</span>
                      <Dots kind="ball" lit={s.balls} of={3} />
                    </span>
                    <span className="tv-row">
                      <span className="tv-label">Strike</span>
                      <Dots kind="strike" lit={s.strikes} of={2} />
                    </span>
                  </div>
                </header>
              }
            />
          </Phone>
        </>
      )}
    </Stage>
  )
}
