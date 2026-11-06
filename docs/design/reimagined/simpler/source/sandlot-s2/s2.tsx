import type { ReactNode } from 'react'
import { Phone, Stage, type Act } from '../../kit'
import { REST, loopEnd } from '../sandlot-gd/gd'
import { ICONS, type IconName } from './icons'
import './s2.css'

// Group s2, the simple versions of "Fix a play" and "More". Both sit on the
// approved Big buttons scorer exactly as the old versions do: the Rec field,
// the TV score bug, a bottom sheet with Ball / Strike / Foul / In play. This
// module holds the Shell and the little pieces the two screens share; the
// scorer parts themselves come from sandlot-gd/gd.

export { REST, loopEnd }
export type { Act }
export { Field, GBug, Tiles, Result, Base, Ask, Tick } from '../sandlot-gd/gd'

export function Ico({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg className="s2-ico" width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {ICONS[name].map((d, i) => <path key={i} d={d} fill="currentColor" fillRule="evenodd" clipRule="evenodd" />)}
    </svg>
  )
}

/** Same stage as the gd screens (Phone 340, 326 compact), plus our own scope class */
export function Shell<T extends { fade: boolean }>({ initial, poster, script, children }: { initial: T; poster: T; script: (a: Act<T>) => Promise<void>; children: (s: T) => ReactNode }) {
  return (
    <Stage<T>
      width={440}
      height={700}
      compact={{ below: 440, width: 358, height: 690 }}
      initial={initial}
      poster={poster}
      script={script}
      cursor={{ at: REST, style: 'touch' }}
      className="fd tv bp yf gd s2"
    >
      {(s, _rect, layout) => (
        <>
          <div className="fd-wash" />
          <Phone width={layout === 'compact' ? 326 : 340} className="fd-phone">
            <div className="fd-app bp-app gd-app" data-variant="rec">
              {children(s)}
              <div className="fdx-fade" data-on={s.fade || undefined} />
            </div>
          </Phone>
        </>
      )}
    </Stage>
  )
}
