import { Ask, Base, Field, GBug, Ico, Pill, Shell, loopEnd, type Act } from '../sandlot-gd/gd'

// No signal: the scorer keeps working. A pill under the score bug counts the
// plays waiting on the phone; when signal returns they are sent. A failed
// send says so quietly and never blocks the next tap.

type O = {
  pill: 'saved' | 'offline' | 'sending' | 'retry'
  n: number
  balls: number
  strikes: number
  last: string
  fade: boolean
}

const START: O = { pill: 'saved', n: 0, balls: 0, strikes: 0, last: 'Single', fade: false }
const POSTER: O = { pill: 'offline', n: 4, balls: 2, strikes: 2, last: 'Ball', fade: false }

const script = async (a: Act<O>) => {
  await a.wait(1400)
  a.mark('ready')
  await a.click('ball')
  a.set({ balls: 1, last: 'Ball', pill: 'offline', n: 1 })
  await a.wait(650)
  await a.click('strike')
  a.set({ strikes: 1, last: 'Strike', n: 2 })
  await a.wait(650)
  await a.click('foul')
  a.set({ strikes: 2, last: 'Foul', n: 3 })
  await a.wait(1200)
  a.mark('offline')
  await a.click('ball')
  a.set({ balls: 2, last: 'Ball', n: 4 })
  a.mark('four')
  await a.wait(900)
  a.mark('sending')
  a.set({ pill: 'sending' })
  await a.wait(1700)
  a.mark('saved')
  a.set({ pill: 'saved', n: 0 })
  await a.wait(1400)
  await a.click('ball')
  a.set({ balls: 3, last: 'Ball', pill: 'retry', n: 1 })
  a.mark('retry')
  await a.wait(2400)
  await loopEnd(a, START)
}

const plays = (n: number) => `${n} ${n === 1 ? 'play' : 'plays'}`

export default function SandlotGdOffline() {
  return (
    <Shell<O> initial={START} poster={POSTER} script={script}>
      {(s) => (
        <>
          <Field liam={1} />
          <GBug s={{ bases: [true, false, false], us: 3, them: 1, outs: 1, balls: s.balls, strikes: s.strikes, inning: 'Top 4' }} />
          <Pill
            id={s.pill === 'offline' ? `offline-${s.n}` : s.pill}
            tone={s.pill === 'saved' ? 'ok' : s.pill === 'sending' ? 'busy' : 'warn'}
            icon={<Ico name={s.pill === 'saved' ? 'cloud-check' : s.pill === 'offline' ? 'cloud-slash' : s.pill === 'sending' ? 'sync' : 'refresh'} size={18} spin={s.pill === 'sending'} />}
          >
            {s.pill === 'saved' && 'All plays saved'}
            {s.pill === 'offline' && `No signal · ${plays(s.n)} on this phone`}
            {s.pill === 'sending' && `Sending ${plays(s.n)}…`}
            {s.pill === 'retry' && 'Couldn’t send · will retry'}
          </Pill>
          <Base
            ask={<Ask who="Ben" count={`${s.balls}–${s.strikes}`} />}
            status={`Last: ${s.last}`}
          />
        </>
      )}
    </Shell>
  )
}
