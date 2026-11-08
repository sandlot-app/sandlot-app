import { Count, States } from '../../kit'
import { Field, GBug, Ico, Pill, Shell, Tick, loopEnd, type Act } from '../sandlot-gd/gd'
import './delay.css'

// Rain delay: a reason, a timer, then Resume or End for today. Ending a game
// that has not reached its complete length can only be Suspended (Mustang
// counts a game as complete after 4 full innings), so Called says why not yet.

type D = {
  step: 'reason' | 'delayed' | 'end' | 'done'
  pick: boolean
  mins: number
  fade: boolean
}

const START: D = { step: 'reason', pick: false, mins: 0, fade: false }
const POSTER: D = { step: 'done', pick: true, mins: 12, fade: false }

const script = async (a: Act<D>) => {
  await a.wait(1500)
  a.mark('reason')
  await a.click('rain')
  a.set({ pick: true })
  await a.wait(380)
  a.mark('delayed')
  a.set({ step: 'delayed', mins: 1 })
  for (let m = 2; m <= 12; m++) {
    await a.wait(190)
    a.set({ mins: m })
  }
  await a.wait(900)
  a.mark('end')
  await a.click('endday')
  a.set({ step: 'end' })
  await a.wait(1900)
  await a.click('suspended')
  a.set({ step: 'done' })
  a.mark('done')
  await a.wait(3400)
  await loopEnd(a, START)
}

const REASONS: [string, string, 'cloud' | 'lightning' | 'alert' | 'more-horizontal'][] = [
  ['rain', 'Rain', 'cloud'],
  ['lightning', 'Lightning', 'lightning'],
  ['injury', 'Injury', 'alert'],
  ['other', 'Other', 'more-horizontal'],
]

export default function SandlotGdDelay() {
  return (
    <Shell<D> initial={START} poster={POSTER} script={script}>
      {(s) => {
        const away = s.step === 'reason'
        return (
          <>
            <Field liam={1} />
            <div className="gd-dim" data-on={!away || undefined} />
            <div className="gd-fieldlabel" data-on={!away || undefined}>
              <States
                value={s.step === 'done' ? 'susp' : 'rain'}
                states={{
                  rain: <span className="gd-fieldlabel__in"><Ico name="cloud" size={26} />Rain delay</span>,
                  susp: <span className="gd-fieldlabel__in"><Ico name="calendar" size={24} />Resumes later</span>,
                }}
              />
            </div>
            <GBug s={{ bases: [true, false, false], us: 3, them: 1, outs: 1, balls: 0, strikes: 0, inning: 'Top 4' }} />
            <Pill hide={away} id={s.step === 'done' ? 'susp' : 'delayed'} tone={s.step === 'done' ? 'dark' : 'warn'} icon={<Ico name={s.step === 'done' ? 'pause' : 'clock'} size={16} />}>
              {s.step === 'done' ? 'Suspended' : 'Delayed'}
            </Pill>

            <div className="gd-dsheet" data-step={s.step}>
              {/* 1. Why are we stopping? */}
              <div className="gd-pane gd-pane--reason" data-on={s.step === 'reason' || undefined}>
                <div className="gd-dask">
                  <span className="gd-ask"><span className="gd-crumb">Delay</span>What’s the reason?</span>
                </div>
                <div className="gd-dgrid">
                  {REASONS.map(([id, label, icon]) => (
                    <span key={id} className="gd-tile gd-tile--reason" data-target={id === 'rain' ? 'rain' : undefined} data-on={(id === 'rain' && s.pick) || undefined}>
                      <Ico name={icon} size={24} />
                      {label}
                    </span>
                  ))}
                </div>
                <span className="gd-status gd-status--pane"><Tick />Last: Single · All plays saved</span>
              </div>

              {/* 2. Delayed: the timer runs, two big choices */}
              <div className="gd-pane" data-on={s.step === 'delayed' || undefined}>
                <div className="gd-dhead">
                  <span className="gd-dhead__icon"><Ico name="cloud" size={24} /></span>
                  <span className="gd-dhead__text">
                    <span className="gd-dhead__title">Rain delay</span>
                    <span className="gd-dhead__sub">Since 11:18 AM · count frozen</span>
                  </span>
                  <span className="gd-timer"><Count value={s.mins} format={(n) => `${n} min`} duration={260} /></span>
                </div>
                <span className="gd-btn gd-resume">Resume play</span>
                <span className="gd-end" data-target="endday">End for today</span>
              </div>

              {/* 3. End for today: Suspended, or Called when the game is long enough */}
              <div className="gd-pane" data-on={s.step === 'end' || undefined}>
                <div className="gd-sh-head gd-sh-head--who">
                  <span className="gd-round"><Ico name="arrow-left" size={18} /></span>
                  <span className="gd-ask gd-ask--big">How does it end?</span>
                  <span className="gd-round gd-round--ghost" />
                </div>
                <p className="gd-dsub">Record what the umpire decided.</p>
                <span className="gd-opt" data-target="suspended">
                  <span className="gd-opt__icon"><Ico name="pause" size={20} /></span>
                  <span className="gd-opt__text">
                    <span className="gd-opt__title">Suspended</span>
                    <span className="gd-opt__sub">Finish on another day. The game picks up exactly where it stopped.</span>
                  </span>
                </span>
                <span className="gd-opt gd-opt--off">
                  <span className="gd-opt__icon"><Ico name="check" size={20} /></span>
                  <span className="gd-opt__text">
                    <span className="gd-opt__title">Called</span>
                    <span className="gd-opt__sub">Not yet. A game counts after 4 full innings, and this one is in the 4th.</span>
                  </span>
                </span>
              </div>

              {/* 4. Saved: the confirmation */}
              <div className="gd-pane" data-on={s.step === 'done' || undefined}>
                <span className="gd-done">
                  <span className="gd-done__tick"><Tick /></span>
                  <span className="gd-done__text">
                    <span className="gd-done__title">Suspended</span>
                    <span className="gd-done__sub">Mustangs 3, Hawks 1 · resume on another day</span>
                  </span>
                  <span className="gd-undo" data-target="undo">Undo</span>
                </span>
                <span className="gd-admin">
                  <span className="gd-admin__icon"><Ico name="calendar" size={20} /></span>
                  Your team admin picks the day in the schedule.
                </span>
              </div>
            </div>
          </>
        )
      }}
    </Shell>
  )
}
