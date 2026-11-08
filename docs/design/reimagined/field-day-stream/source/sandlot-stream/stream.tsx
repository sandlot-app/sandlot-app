import type { ReactNode } from 'react'
import { Stage, Phone, Count, Roll, type Act } from '../../kit'
import { Bases } from '../sandlot-shared/field'
import { Dots } from '../sandlot-fieldday/scene'
import type { Phase } from '../sandlot-youth/youth'
import photo from './live-stream.jpg'
import '../sandlot-field/field.css'
import '../sandlot-fieldday/fieldday.css'
import './stream.css'

// The camera view is a still photo of a real youth game standing in for the
// live video; everything drawn over it is the design.
//
// Sandlot for the person filming: a parent with a second phone on the
// backstop, streaming the game to families. This is the in-app broadcaster
// the plan puts at milestone 13; the first version streams through an
// existing app. The phone sits sideways on the fence, so every screen is
// landscape.
//
//  Set up: line up home plate in the camera, check the score link, signal,
//          battery and who can watch, then Go live after a countdown.
//  Live:   the camera with the score drawn on it as viewers see it; plays
//          from the scorer's phone land on the video by themselves. The
//          streamer sees the timer, viewers, signal, mute and End.
//  End:    confirm, then a summary: how long, who watched, replay saved.

// icons.download, bold solid round
const I = {
  eye: <path d="M22.6058 12.7781C21.501 14.7886 18.0534 20 12.0001 20C5.94677 20 2.49915 14.7886 1.39435 12.7781C1.12571 12.2893 1.12571 11.7107 1.39435 11.2219C2.49915 9.21141 5.94677 4 12.0001 4C18.0534 4 21.501 9.21142 22.6058 11.2219C22.8745 11.7107 22.8745 12.2893 22.6058 12.7781ZM15.5001 12C15.5001 13.933 13.9331 15.5 12.0001 15.5C10.0671 15.5 8.5001 13.933 8.5001 12C8.5001 10.067 10.0671 8.5 12.0001 8.5C13.9331 8.5 15.5001 10.067 15.5001 12Z" fill="currentColor" fillRule="evenodd" />,
  mic: (
    <>
      <path d="M12.0003 1C9.79116 1 8.0003 2.79086 8.0003 5V12C8.0003 14.2091 9.79116 16 12.0003 16C14.2094 16 16.0003 14.2091 16.0003 12V5C16.0003 2.79086 14.2094 1 12.0003 1Z" fill="currentColor" />
      <path d="M4.75286 11C4.06309 11 3.50192 11.5602 3.50391 12.25C3.62398 16.4071 6.72885 19.8161 10.7503 20.4087V21.75C10.7503 22.4404 11.3099 23 12.0003 23C12.6907 23 13.2503 22.4404 13.2503 21.75V20.4087C17.2718 19.8161 20.3766 16.4071 20.4967 12.25C20.4987 11.5602 19.9375 11 19.2477 11C18.5594 11 17.998 11.5616 17.9952 12.25C17.9776 12.6799 17.9147 13.0981 17.8113 13.5C17.1452 16.0878 14.7961 18 12.0003 18C9.20454 18 6.85539 16.0878 6.18933 13.5C6.08589 13.0981 6.02304 12.6799 6.00542 12.25C6.0026 11.5616 5.44122 11 4.75286 11Z" fill="currentColor" />
    </>
  ),
  stop: <path d="M5 3C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V5C21 3.89543 20.1046 3 19 3H5Z" fill="currentColor" />,
  link: (
    <>
      <path d="M10 7.25C10 7.94036 9.44036 8.5 8.75 8.5H6C4.067 8.5 2.5 10.067 2.5 12C2.5 13.933 4.067 15.5 6 15.5H8.75C9.44036 15.5 10 16.0596 10 16.75C10 17.4404 9.44036 18 8.75 18H6C2.68629 18 0 15.3137 0 12C0 8.68629 2.68629 6 6 6H8.75C9.44036 6 10 6.55964 10 7.25Z" fill="currentColor" />
      <path d="M15.25 8.5C14.5596 8.5 14 7.94036 14 7.25C14 6.55964 14.5596 6 15.25 6H18C21.3137 6 24 8.68629 24 12C24 15.3137 21.3137 18 18 18H15.25C14.5596 18 14 17.4404 14 16.75C14 16.0596 14.5596 15.5 15.25 15.5H18C19.933 15.5 21.5 13.933 21.5 12C21.5 10.067 19.933 8.5 18 8.5H15.25Z" fill="currentColor" />
      <path d="M18 12C18 12.6904 17.4404 13.25 16.75 13.25H7.25C6.55965 13.25 6 12.6904 6 12C6 11.3096 6.55965 10.75 7.25 10.75H16.75C17.4404 10.75 18 11.3096 18 12Z" fill="currentColor" />
    </>
  ),
  check: <path d="M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12ZM16.5001 8.99997C16.9883 9.48813 16.9883 10.2796 16.5001 10.7677L11.884 15.3839C11.3958 15.872 10.6044 15.872 10.1162 15.3839L8.0001 13.2677C7.51194 12.7796 7.51194 11.9881 8.0001 11.5C8.48825 11.0118 9.27971 11.0118 9.76787 11.5L11.0001 12.7322L14.7323 8.99997C15.2205 8.51182 16.0119 8.51182 16.5001 8.99997Z" fill="currentColor" fillRule="evenodd" />,
  users: (
    <>
      <path d="M10.75 6.75C10.75 8.82107 9.07107 10.5 7 10.5C4.92893 10.5 3.25 8.82107 3.25 6.75C3.25 4.67893 4.92893 3 7 3C9.07107 3 10.75 4.67893 10.75 6.75Z" fill="currentColor" />
      <path d="M17 10.5C19.0711 10.5 20.75 8.82107 20.75 6.75C20.75 4.67893 19.0711 3 17 3C14.9289 3 13.25 4.67893 13.25 6.75C13.25 8.82107 14.9289 10.5 17 10.5Z" fill="currentColor" />
      <path d="M16.0322 20C16.3316 19.3975 16.5 18.7184 16.5 18V16.1668C16.5 15.2303 16.2076 14.1862 15.4582 13.3321C15.1581 12.9902 14.8374 12.6665 14.498 12.363C15.2907 12.1268 16.1305 12 17 12C19.6224 12 21.9754 13.1536 23.5791 14.9811C23.8649 15.3068 24 15.7334 24 16.1668V18C24 19.1046 23.1046 20 22 20H16.0322Z" fill="currentColor" />
      <path d="M7 12C9.62239 12 11.9754 13.1536 13.5791 14.9811C13.8649 15.3068 14 15.7334 14 16.1668V18C14 19.1046 13.1046 20 12 20H2C0.895431 20 0 19.1046 0 18V16.1668C0 15.7334 0.135133 15.3068 0.420922 14.9811C2.02464 13.1536 4.37761 12 7 12Z" fill="currentColor" />
    </>
  ),
}
const Icon = ({ name, size = 18 }: { name: keyof typeof I; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>{I[name]}</svg>
)

function SignalBars({ level }: { level: number }) {
  return (
    <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden className="st-bars">
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={i * 4.6} y={9 - i * 3} width="3.2" height={3 + i * 3} rx="1" data-on={i < level || undefined} />
      ))}
    </svg>
  )
}

/** A phone turned on its side: the content is laid out 874 × 402 */
function Landscape({ width, children }: { width: number; children: ReactNode }) {
  return (
    <div className="st-turn" style={{ width: width * 2.105, height: width }}>
      <Phone width={width} className="st-phone" dark status={false}>
        <div className="st-land">{children}</div>
      </Phone>
    </div>
  )
}

type Cam = { phase: Phase; liam: number; maya: number }

/** What the camera sees: a still photo of a real youth game stands in for the live video */
function Feed({ off }: { s?: Cam; scale?: number; off?: boolean }) {
  return (
    <div className="st-feed">
      <div className="st-photo" data-off={off || undefined} style={{ backgroundImage: `url(${photo})` }} />
    </div>
  )
}

type Score = { us: number; liam: number; maya: number; balls: number; strikes: number; outs: number }

/** The score drawn on the video, as families see it */
function StreamBug({ s }: { s: Score }) {
  return (
    <div className="st-bug">
      <div className="st-bug__teams">
        <span className="st-bug__team"><i />MUS<b><Count value={s.us} duration={600} /></b></span>
        <span className="st-bug__team st-bug__team--away"><i />HAW<b>1</b></span>
      </div>
      <Bases on={[s.liam === 1, s.maya === 2, false]} className="st-bug__bases" />
      <div className="st-bug__count">
        <span className="st-bug__inn">▲ 4</span>
        <span className="st-bug__dots"><Dots kind="ball" lit={s.balls} of={3} /><Dots kind="strike" lit={s.strikes} of={2} /></span>
      </div>
      <div className="st-bug__outs"><Dots kind="out" lit={s.outs} of={2} />out</div>
    </div>
  )
}

function Stream({ children, script, initial, poster, rest }: { children: (s: any) => ReactNode; script: (a: Act<any>) => Promise<void>; initial: any; poster: any; rest?: { x: number; y: number } }) {
  return (
    <Stage<any>
      width={860}
      height={430}
      initial={initial}
      poster={poster}
      script={script}
      cursor={rest ? { at: { wide: rest, compact: rest }, style: 'touch' } : undefined}
      className="fd bp yf st"
    >
      {(s) => (
        <>
          <div className="st-wash" />
          <Landscape width={364}>{children(s)}</Landscape>
        </>
      )}
    </Stage>
  )
}

// ================= Set up =================

type U = Cam & { aligned: boolean; count: number; live: boolean; fade: boolean }
const USTART: U = { phase: 'set', liam: 0, maya: 2, aligned: false, count: 0, live: false, fade: false }
const UREST = { x: 690, y: 330 }

const setupScript = async (a: Act<U>) => {
  await a.wait(900)
  a.mark('aligned')
  a.set({ aligned: true })
  await a.wait(1900)
  a.mark('golive')
  await a.click('golive')
  a.set({ count: 3 })
  await a.wait(800)
  a.set({ count: 2 })
  await a.wait(800)
  a.set({ count: 1 })
  await a.wait(800)
  a.mark('live')
  a.set({ count: 0, live: true })
  await a.wait(2800)
  a.set({ fade: true })
  await a.wait(450)
  await a.snap({ ...USTART, fade: true })
  await a.wait(80)
  a.set({ fade: false })
  await a.move(UREST)
}

function Row({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone: 'ok' | 'warn' | 'plain' }) {
  return (
    <div className="st-row" data-tone={tone}>
      <span className="st-row__icon">{icon}</span>
      <span className="st-row__text">
        <span className="st-row__label">{label}</span>
        <span className="st-row__value">{value}</span>
      </span>
    </div>
  )
}

export function StreamSetup() {
  return (
    <Stream initial={USTART} poster={{ ...USTART, aligned: true }} script={setupScript} rest={UREST}>
      {(s: U) => (
        <div className="st-screen st-screen--setup">
          <div className="st-preview">
            <Feed off={!s.aligned} />
            <div className="st-guide" data-ok={s.aligned || undefined}>
              <span className="st-guide__tag"><Roll>{s.aligned ? 'Looks good. Keep it here.' : 'Line up home plate here'}</Roll></span>
              <svg className="st-guide__plate" width="38" height="30" viewBox="0 0 38 30" aria-hidden><path d="M3 3 H35 V15 L19 27 L3 15 Z" /></svg>
            </div>
            <div className="st-count" data-on={s.count > 0 || undefined}>
              <span key={s.count}>{s.count || ''}</span>
            </div>
            <span className="st-livepill" data-on={s.live || undefined}><i />Live</span>
          </div>
          <div className="st-panel">
            <span className="st-panel__title">Go live</span>
            <span className="st-panel__sub">Mustangs vs Hawks · Field 2</span>
            <div className="st-rows">
              <Row tone="ok" icon={<Icon name="link" size={16} />} label="Score" value="Linked to Christian’s phone" />
              <Row tone="ok" icon={<SignalBars level={4} />} label="Signal" value="Strong · 5G" />
              <Row tone="warn" icon={<span className="st-batt"><i style={{ width: '64%' }} /></span>} label="Battery 64%" value="Plug in for a full game" />
              <Row tone="plain" icon={<Icon name="users" size={16} />} label="Who can watch" value="Team families only" />
            </div>
            <span className="st-go" data-target="golive" data-live={s.live || undefined}>
              <Roll>{s.live ? 'You’re live' : 'Go live'}</Roll>
            </span>
          </div>
          <div className="fdx-fade st-fade" data-on={s.fade || undefined} />
        </div>
      )}
    </Stream>
  )
}

// ================= Live =================

type V = Cam & Score & { time: number; viewers: number; lower: boolean; toast: 'none' | 'weak' | 'hd'; muted: boolean; fade: boolean }
const VSTART: V = { phase: 'set', liam: 0, maya: 2, us: 2, balls: 1, strikes: 1, outs: 1, time: 4360, viewers: 23, lower: false, toast: 'none', muted: false, fade: false }

const clock = (t: number) => {
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const sec = Math.floor(t % 60)
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

const liveScript = async (a: Act<V>) => {
  // The clock keeps running under every beat
  let carry = 0
  const step = async (ms: number) => {
    await a.wait(ms)
    carry += ms
    const whole = Math.floor(carry / 1000)
    if (whole) {
      carry -= whole * 1000
      a.put((s) => ({ time: s.time + whole }))
    }
  }
  await step(1200)
  a.mark('ball')
  a.set({ balls: 2 })
  await step(1100)
  a.set({ strikes: 2, viewers: 24 })
  await step(1300)
  a.mark('hit')
  a.set({ phase: 'hit' })
  await step(380)
  a.set({ liam: 1, maya: 4 })
  await step(1070)
  a.set({ phase: 'throw' })
  await step(680)
  // The scorer saved the play: the score and a caption land on the video
  a.mark('scored')
  a.set({ us: 3, balls: 0, strikes: 0, lower: true, viewers: 26 })
  await step(2600)
  a.set({ lower: false, viewers: 27 })
  await step(900)
  a.mark('weak')
  a.set({ toast: 'weak' })
  await step(2200)
  a.set({ toast: 'hd' })
  await step(1600)
  a.set({ toast: 'none' })
  await step(700)
  a.set({ fade: true })
  await a.wait(450)
  await a.snap({ ...VSTART, fade: true })
  await a.wait(80)
  a.set({ fade: false })
}

function Hud({ s, end }: { s: V | E; end?: boolean }) {
  return (
    <>
      <div className="st-tl">
        <span className="st-livepill st-livepill--hud" data-on><i />Live <span className="st-time">{clock(s.time)}</span></span>
        <span className="st-pill"><Icon name="eye" size={15} /><Count value={s.viewers} duration={500} /> watching</span>
      </div>
      <div className="st-tr">
        <span className="st-pill"><SignalBars level={'toast' in s && s.toast === 'weak' ? 1 : 4} />{'toast' in s && s.toast === 'weak' ? 'LTE' : '5G'}</span>
        <span className="st-pill"><span className="st-batt st-batt--light"><i style={{ width: '58%' }} /></span>58%</span>
      </div>
      <div className="st-side">
        <span className="st-ctl"><Icon name="mic" size={20} /></span>
        <span className="st-ctl st-ctl--zoom">1×</span>
        <span className="st-ctl st-ctl--end" data-target={end ? 'end' : undefined}><Icon name="stop" size={16} />End</span>
      </div>
      <div className="st-bl">
        <StreamBug s={s} />
        <span className="st-linked"><Icon name="link" size={13} />Score from Christian’s phone</span>
      </div>
    </>
  )
}

export function StreamLive() {
  return (
    <Stream initial={VSTART} poster={{ ...VSTART, phase: 'throw', liam: 1, maya: 4, us: 3, balls: 0, strikes: 0, lower: true, viewers: 26 }} script={liveScript}>
      {(s: V) => (
        <div className="st-screen">
          <Feed />
          <Hud s={s} />
          <div className="st-lower" data-on={s.lower || undefined}>
            <span className="st-lower__tag">Single</span>
            <span>Liam singles to left. <b>Maya scores!</b></span>
          </div>
          <div className="st-toast" data-tone={s.toast} data-on={s.toast !== 'none' || undefined}>
            <Roll>{s.toast === 'hd' ? 'Signal’s back. Streaming in HD.' : 'Weak signal. Lowering quality to stay live.'}</Roll>
          </div>
          <div className="fdx-fade st-fade" data-on={s.fade || undefined} />
        </div>
      )}
    </Stream>
  )
}

// ================= End =================

type E = Cam & Score & { time: number; viewers: number; dialog: boolean; ended: boolean; fade: boolean }
const ESTART: E = { phase: 'set', liam: 1, maya: 4, us: 3, balls: 0, strikes: 1, outs: 3, time: 6731, viewers: 27, dialog: false, ended: false, fade: false }
const EREST = { x: 720, y: 330 }

const endScript = async (a: Act<E>) => {
  await a.wait(1300)
  a.mark('end')
  await a.click('end')
  a.set({ dialog: true })
  await a.wait(1400)
  await a.click('confirm')
  a.mark('ended')
  a.set({ dialog: false, ended: true })
  await a.wait(4200)
  a.set({ fade: true })
  await a.wait(450)
  await a.snap({ ...ESTART, fade: true })
  await a.wait(80)
  a.set({ fade: false })
  await a.move(EREST)
}

export function StreamEnd() {
  return (
    <Stream initial={ESTART} poster={{ ...ESTART, ended: true }} script={endScript} rest={EREST}>
      {(s: E) => (
        <div className="st-screen" data-ended={s.ended || undefined}>
          <Feed />
          <div className="st-hud" data-hide={s.ended || undefined}>
            <Hud s={s} end />
          </div>
          <div className="st-scrim" data-on={s.dialog || s.ended || undefined} />
          <div className="st-dialog" data-on={s.dialog || undefined}>
            <span className="st-dialog__title">End the stream?</span>
            <span className="st-dialog__body">Families stop seeing video. The score keeps going, and the replay is saved.</span>
            <span className="st-dialog__btns">
              <span className="st-btn">Keep streaming</span>
              <span className="st-btn st-btn--end" data-target="confirm">End stream</span>
            </span>
          </div>
          <div className="st-summary" data-on={s.ended || undefined}>
            <div className="st-summary__head">
              <span className="st-summary__tick"><Icon name="check" size={44} /></span>
              <span className="st-summary__title">Stream ended</span>
              <span className="st-summary__sub">1 hr 52 min · Mustangs 3, Hawks 1 · Field 2</span>
            </div>
            <div className="st-stats">
              <span className="st-stat"><b>{s.ended ? <Count value={31} duration={900} /> : 0}</b>families watched</span>
              <span className="st-stat"><b>{s.ended ? <Count value={27} duration={900} /> : 0}</b>at the busiest</span>
              <span className="st-stat"><b>{s.ended ? <Count value={14} duration={900} /> : 0}</b>plays on video</span>
            </div>
            <span className="st-summary__note">The replay is on the game page for families. Clips of each kid’s plays come later.</span>
            <div className="st-summary__btns">
              <span className="st-btn st-btn--go"><Icon name="link" size={16} />Share replay link</span>
              <span className="st-btn">Done</span>
            </div>
          </div>
          <div className="fdx-fade st-fade" data-on={s.fade || undefined} />
        </div>
      )}
    </Stream>
  )
}
