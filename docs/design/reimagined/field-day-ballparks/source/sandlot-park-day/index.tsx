import { Stage, Phone } from '../../kit'
import { Scene, START, POSTER, REST, script, type S } from '../sandlot-ballpark/park'

export default function SandlotParkDay() {
  return (
    <Stage<S>
      width={440}
      height={700}
      compact={{ below: 440, width: 358, height: 690 }}
      initial={START}
      poster={POSTER}
      script={script}
      cursor={{ at: REST, style: 'touch' }}
      className="fd tv bp"
    >
      {(s, _rect, layout) => (
        <>
          <div className="fd-wash" />
          <Phone width={layout === 'compact' ? 326 : 340} className="fd-phone">
            <Scene s={s} variant="day" />
          </Phone>
        </>
      )}
    </Stage>
  )
}
