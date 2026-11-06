import { Count, States, type Act } from '../../kit'
import { Shell, Icon, Who, Verified, Imported, Clip, Spinner, photo, fadeOut } from '../sandlot-gr/gr'

// Scout view: what a verified scout sees when a parent has opted Nico in.
// Read-only. The verified stats come first, on the dark card; the imported
// ones are a muted line apart. There is no phone or email anywhere, and the
// only way to reach the family is the one big button, which sends a request
// to Nico's parent (docs/plan.md: "a scout's contact request goes to the
// parent, who decides").
//
// Beats: a clip plays; the scout taps "Ask to contact Nico's family"; a small
// sheet says the request goes to the parent and offers a one-line note,
// prefilled; Send turns the sheet into "Request sent"; the sheet goes and the
// button on the profile stays as "Request sent".
//
// No real school or brand names: the badge says "College program · verified".

type S = { playing: boolean; progress: number; sheet: boolean; send: 'idle' | 'busy' | 'done'; sent: boolean; fade: boolean }
const START: S = { playing: false, progress: 0, sheet: false, send: 'idle', sent: false, fade: false }
const POSTER: S = { playing: true, progress: 0.55, sheet: true, send: 'idle', sent: false, fade: false }
const REST = { x: 330, y: 560 }

const script = async (a: Act<S>) => {
  await a.wait(1300)
  // A clip plays, with the photo standing in for the video
  a.mark('play')
  await a.click('playclip')
  a.set({ playing: true })
  for (let i = 1; i <= 3; i++) {
    await a.wait(650)
    a.put({ progress: i / 4 })
  }
  await a.wait(500)
  // The scout wants to reach the family
  a.mark('ask')
  await a.click({ at: 'ask', x: 0.85, y: 0.5 })
  a.set({ sheet: true })
  await a.wait(2600)
  a.mark('send')
  await a.click({ at: 'send', x: 0.88, y: 0.5 })
  a.set({ send: 'busy' })
  await a.wait(1000)
  a.mark('sent')
  a.set({ send: 'done' })
  await a.wait(2000)
  a.set({ sheet: false, sent: true })
  await a.wait(2400)
  await fadeOut(a, START, REST)
}

const avg = (n: number) => `.${String(Math.round(n)).padStart(3, '0')}`

export default function ScoutView() {
  return (
    <Shell<S> initial={START} poster={POSTER} script={script} rest={REST} tag="gr-scout">
      {(s) => (
        <div className="ob-page gr-page gr-scout">
          <div className="gr-scoutbar">
            <span className="gr-round"><Icon name="arrow-left" size={20} /></span>
            <span className="gr-badge">
              <span className="gr-badge__tile"><Icon name="shield-check" size={20} /></span>
              <span className="gr-badge__text">
                <b>Verified scout</b>
                <small>College program · verified</small>
              </span>
            </span>
          </div>

          <div className="gr-pcard">
            <Who dark n="8" name="Nico" age={15} sub="Center field · Moraga Mustangs 15U" size={52} />
            <div className="gr-pcard__rule" />
            <div className="gr-stats__top">
              <Verified dark />
              <span className="gr-stats__games">9 games</span>
            </div>
            <div className="gr-stats__row">
              <span className="gr-stat"><b><Count value={386} format={avg} /></b><small>Batting avg</small></span>
              <span className="gr-stat"><b><Count value={22} /></b><small>Hits</small></span>
              <span className="gr-stat"><b><Count value={14} /></b><small>Steals</small></span>
            </div>
          </div>

          <p className="gr-label">Clips</p>
          <div className="gr-player" data-playing={s.playing || undefined} data-crop>
            <div className="gr-player__img" data-snap style={{ backgroundImage: `url(${photo})` }} />
            <div className="gr-player__shade" />
            <span className="gr-player__dur">0:12</span>
            <span className="gr-player__playbtn" data-target="playclip"><Icon name="play" size={24} /></span>
            <div className="gr-player__cap">
              <span className="gr-player__what"><b>Nico</b> steals third, then scores</span>
              <span className="gr-player__game">vs Hawks · Saturday</span>
            </div>
            <span className="gr-player__progress"><i style={{ transform: `scaleX(${s.progress})` }} /></span>
          </div>
          <div className="gr-strip">
            <Clip i={0} now />
            <Clip i={1} />
            <Clip i={2} />
          </div>

          <Imported />

          <span className="gr-cta" data-target="ask" data-done={s.sent || undefined}>
            <States
              value={s.sent ? 'sent' : 'idle'}
              states={{
                idle: <span className="gr-cta__in">Ask to contact Nico’s family</span>,
                sent: <span className="gr-cta__in"><Icon name="check" size={20} />Request sent</span>,
              }}
            />
          </span>
          <div className="gr-help">
            <States
              value={s.sent ? 'sent' : 'idle'}
              states={{
                idle: <span className="gr-help__in"><Icon name="lock" size={14} />Contact info is never shown. Parents decide.</span>,
                sent: <span className="gr-help__in">You’ll hear back here.</span>,
              }}
            />
          </div>

          <div className="gr-scrim" data-on={s.sheet || undefined} />
          <div className="gr-sheet gr-ask" data-open={s.sheet || undefined} data-done={s.send === 'done' || undefined}>
            <span className="gr-grab" />
            <div className="gr-ask__layers">
              <div className="gr-ask__form">
                <h2>Ask Nico’s family</h2>
                <p className="gr-ask__p">Your request goes to Nico’s parent. They decide whether to share contact info.</p>
                <p className="gr-ask__label">Add a note (optional)</p>
                <div className="gr-field">Saw his 3 steals vs Hawks…</div>
                <span className="gr-cta" data-target="send">
                  <States
                    value={s.send === 'busy' ? 'busy' : 'idle'}
                    states={{
                      idle: <span className="gr-cta__in"><Icon name="send" size={20} />Send request</span>,
                      busy: <span className="gr-cta__in"><Spinner />Sending…</span>,
                    }}
                  />
                </span>
              </div>
              <div className="gr-ask__done">
                <span className="gr-ask__check"><Icon name="check" size={34} /></span>
                <b>Request sent</b>
                <span className="gr-ask__sub">You’ll hear back here.</span>
              </div>
            </div>
          </div>

          <div className="fdx-fade" data-on={s.fade || undefined} />
        </div>
      )}
    </Shell>
  )
}
