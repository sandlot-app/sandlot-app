import type { ReactNode } from 'react'
import { Stage, Phone, Roll, States, type Act } from '../../kit'
import { FieldLayer, Scene, START as SCORER_START, type Phase } from '../sandlot-youth/youth'
import './ob.css'

// Sandlot's first screens, in the Field Day direction. The plan signs
// parents in with Apple or Google only (no email in the first version), so
// signing up and logging in are the same two buttons:
//
//  Welcome:    the Rec field playing behind the logo, Apple and Google.
//  Get set up: first time only. What you're here for, then join your team
//              from the invite and pick your player.
//  Home:       game day. Today's game with Keep score, Stream video and
//              Share live link; your player; what's coming up.
//
// The logo is the Figma master: Logo / Emblem 124:7447 and the wordmark's
// fit (Inter Extra Bold, emblem 0.933 x the font size, home plate as a
// descender).

export function Emblem({ size = 24 }: { size?: number }) {
  return (
    <svg className="ob-emblem" width={size * 1.0093} height={size} viewBox="0 0 63.958 63.3718" aria-hidden>
      <path d="M14.4359 48.7321L2.10257 36.3977C0.756307 35.0513 0 33.2253 0 31.3213C0 29.4173 0.756307 27.5913 2.10257 26.2449L25.7641 2.58335C27.4183 0.929253 29.6617 0 32.001 0C34.3403 0 36.5838 0.929253 38.238 2.58335L61.8554 26.2008C63.2004 27.5459 63.9566 29.3699 63.958 31.2721C63.9593 33.1744 63.2057 34.9994 61.8626 36.3464L49.5149 48.7321C48.8686 49.3784 47.992 49.7415 47.078 49.7415C46.1639 49.7415 45.2873 49.3784 44.641 48.7321C43.9947 48.0858 43.6316 47.2092 43.6316 46.2951C43.6316 45.3811 43.9947 44.5045 44.641 43.8582L55.759 32.7885C55.9118 32.6362 56.0332 32.4552 56.116 32.256C56.1989 32.0568 56.2416 31.8431 56.2418 31.6274C56.242 31.4116 56.1996 31.1979 56.1171 30.9985C56.0346 30.7991 55.9136 30.618 55.761 30.4654L33.8144 8.51873C33.5763 8.28056 33.2936 8.09163 32.9824 7.96273C32.6713 7.83383 32.3378 7.76748 32.001 7.76748C31.6643 7.76748 31.3308 7.83383 31.0196 7.96273C30.7085 8.09163 30.4258 8.28056 30.1877 8.51873L8.23795 30.4685C7.93057 30.7763 7.75801 31.1936 7.7582 31.6287C7.75839 32.0637 7.93132 32.4809 8.23898 32.7885L19.3097 43.8582C19.6298 44.1782 19.8836 44.5582 20.0568 44.9763C20.23 45.3944 20.3192 45.8426 20.3192 46.2951C20.3192 46.7477 20.23 47.1959 20.0568 47.614C19.8836 48.0321 19.6298 48.412 19.3097 48.7321C18.9897 49.0521 18.6098 49.3059 18.1917 49.4791C17.7736 49.6523 17.3254 49.7415 16.8728 49.7415C16.4202 49.7415 15.9721 49.6523 15.554 49.4791C15.1358 49.3059 14.7559 49.0521 14.4359 48.7321Z" fill="#FF7519" />
      <path d="M23.7959 47.167C23.7959 46.7861 23.9472 46.4209 24.2165 46.1516C24.4858 45.8824 24.851 45.7311 25.2318 45.7311H38.6677C39.0485 45.7311 39.4137 45.8824 39.683 46.1516C39.9523 46.4209 40.1036 46.7861 40.1036 47.167V55.4265C40.1036 55.7526 39.9741 56.0654 39.7436 56.2962L33.1395 62.9003C32.8375 63.2022 32.428 63.3718 32.001 63.3718C31.574 63.3718 31.1645 63.2022 30.8626 62.9003L24.1559 56.1936C23.9254 55.9629 23.7959 55.6501 23.7959 55.3239V47.167Z" fill="#FF7519" />
    </svg>
  )
}

/** "sandlot" with the emblem: its top on the ascender line, the arms on the baseline, home plate below it */
export function Wordmark({ size = 24, dark }: { size?: number; dark?: boolean }) {
  return (
    <span className="ob-wm" data-dark={dark || undefined} style={{ fontSize: size }}>
      sandlot
      <Emblem size={size * 0.933} />
    </span>
  )
}

// Apple's and Google's own marks, as their sign-in button guidelines require
const AppleMark = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
    <path fill="currentColor" d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z" />
  </svg>
)
const GoogleMark = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
  </svg>
)

// icons.download, bold solid round
const P = {
  mic: 'M12.0003 1C9.79116 1 8.0003 2.79086 8.0003 5V12C8.0003 14.2091 9.79116 16 12.0003 16C14.2094 16 16.0003 14.2091 16.0003 12V5C16.0003 2.79086 14.2094 1 12.0003 1ZM4.75286 11C4.06309 11 3.50192 11.5602 3.50391 12.25C3.62398 16.4071 6.72885 19.8161 10.7503 20.4087V21.75C10.7503 22.4404 11.3099 23 12.0003 23C12.6907 23 13.2503 22.4404 13.2503 21.75V20.4087C17.2718 19.8161 20.3766 16.4071 20.4967 12.25C20.4987 11.5602 19.9375 11 19.2477 11C18.5594 11 17.998 11.5616 17.9952 12.25C17.9776 12.6799 17.9147 13.0981 17.8113 13.5C17.1452 16.0878 14.7961 18 12.0003 18C9.20454 18 6.85539 16.0878 6.18933 13.5C6.08589 13.0981 6.02304 12.6799 6.00542 12.25C6.0026 11.5616 5.44122 11 4.75286 11Z',
  eye: 'M22.6058 12.7781C21.501 14.7886 18.0534 20 12.0001 20C5.94677 20 2.49915 14.7886 1.39435 12.7781C1.12571 12.2893 1.12571 11.7107 1.39435 11.2219C2.49915 9.21141 5.94677 4 12.0001 4C18.0534 4 21.501 9.21142 22.6058 11.2219C22.8745 11.7107 22.8745 12.2893 22.6058 12.7781ZM15.5001 12C15.5001 13.933 13.9331 15.5 12.0001 15.5C10.0671 15.5 8.5001 13.933 8.5001 12C8.5001 10.067 10.0671 8.5 12.0001 8.5C13.9331 8.5 15.5001 10.067 15.5001 12Z',
  users: 'M10.75 6.75C10.75 8.82107 9.07107 10.5 7 10.5C4.92893 10.5 3.25 8.82107 3.25 6.75C3.25 4.67893 4.92893 3 7 3C9.07107 3 10.75 4.67893 10.75 6.75ZM17 10.5C19.0711 10.5 20.75 8.82107 20.75 6.75C20.75 4.67893 19.0711 3 17 3C14.9289 3 13.25 4.67893 13.25 6.75C13.25 8.82107 14.9289 10.5 17 10.5ZM16.0322 20C16.3316 19.3975 16.5 18.7184 16.5 18V16.1668C16.5 15.2303 16.2076 14.1862 15.4582 13.3321C15.1581 12.9902 14.8374 12.6665 14.498 12.363C15.2907 12.1268 16.1305 12 17 12C19.6224 12 21.9754 13.1536 23.5791 14.9811C23.8649 15.3068 24 15.7334 24 16.1668V18C24 19.1046 23.1046 20 22 20H16.0322ZM7 12C9.62239 12 11.9754 13.1536 13.5791 14.9811C13.8649 15.3068 14 15.7334 14 16.1668V18C14 19.1046 13.1046 20 12 20H2C0.895431 20 0 19.1046 0 18V16.1668C0 15.7334 0.135133 15.3068 0.420922 14.9811C2.02464 13.1536 4.37761 12 7 12Z',
  video: 'M17 7.00003V8.90003L22.4265 5.10145C23.0893 4.63751 24 5.11166 24 5.92069V18.2338C24 19.0111 23.152 19.4913 22.4855 19.0913L17 15.8V17C17 18.1046 16.1046 19 15 19H2C0.895431 19 0 18.1046 0 17V7.00003C0 5.89546 0.895431 5.00003 2 5.00003H15C16.1046 5.00003 17 5.89546 17 7.00003Z',
  link: 'M10 7.25C10 7.94036 9.44036 8.5 8.75 8.5H6C4.067 8.5 2.5 10.067 2.5 12C2.5 13.933 4.067 15.5 6 15.5H8.75C9.44036 15.5 10 16.0596 10 16.75C10 17.4404 9.44036 18 8.75 18H6C2.68629 18 0 15.3137 0 12C0 8.68629 2.68629 6 6 6H8.75C9.44036 6 10 6.55964 10 7.25ZM15.25 8.5C14.5596 8.5 14 7.94036 14 7.25C14 6.55964 14.5596 6 15.25 6H18C21.3137 6 24 8.68629 24 12C24 15.3137 21.3137 18 18 18H15.25C14.5596 18 14 17.4404 14 16.75C14 16.0596 14.5596 15.5 15.25 15.5H18C19.933 15.5 21.5 13.933 21.5 12C21.5 10.067 19.933 8.5 18 8.5H15.25ZM18 12C18 12.6904 17.4404 13.25 16.75 13.25H7.25C6.55965 13.25 6 12.6904 6 12C6 11.3096 6.55965 10.75 7.25 10.75H16.75C17.4404 10.75 18 11.3096 18 12Z',
  house: 'M2.18557 11C1.71748 11 1.50603 10.4143 1.86615 10.1153L10.7231 2.76087C11.4638 2.14579 12.5377 2.14579 13.2784 2.76087L22.1353 10.1153C22.4954 10.4143 22.284 11 21.8159 11H20.0007V20C20.0007 20.5522 19.553 21 19.0007 21H15.0007C14.4485 21 14.0007 20.5522 14.0007 20V15C14.0007 14.4477 13.553 14 13.0007 14H11.0007C10.4485 14 10.0007 14.4477 10.0007 15V20C10.0007 20.5522 9.55302 21 9.00074 21H5.00074C4.44845 21 4.00074 20.5522 4.00074 20V11H2.18557Z',
  calendar: 'M2 7C2 5.89543 2.89543 5 4 5H5.75V3.75C5.75 3.05964 6.30964 2.5 7 2.5C7.69036 2.5 8.25 3.05964 8.25 3.75V5H15.75V3.75C15.75 3.05964 16.3096 2.5 17 2.5C17.6904 2.5 18.25 3.05964 18.25 3.75V5H20C21.1046 5 22 5.89543 22 7V9H2V7ZM4 21C2.89543 21 2 20.1046 2 19V11.5H22V19C22 20.1046 21.1046 21 20 21H4Z',
  user: 'M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11ZM19.5815 16.479C19.8642 16.8074 20 17.2333 20 17.6666V19C20 20.1046 19.1046 21 18 21H6C4.89543 21 4 20.1046 4 19V17.6666C4 17.2333 4.13576 16.8074 4.41847 16.479C6.25235 14.3488 8.96866 13 12 13C15.0313 13 17.7477 14.3488 19.5815 16.479Z',
  bell: 'M12 2C8.13401 2 5 5.13401 5 9V11.9609C5 13.2665 4.48135 14.5187 3.55814 15.4419C3.20077 15.7992 3 16.2839 3 16.7893V17.6623C3 18.4011 3.59891 19 4.33771 19H7.56299C7.56299 19.3728 7.56638 20.2787 8.0572 21.1698C8.81938 22.5535 10.2974 23.5 12 23.5C13.7026 23.5 15.1806 22.5535 15.9428 21.1698C16.4336 20.2787 16.437 19.3728 16.437 19H19.6623C20.4011 19 21 18.4011 21 17.6623V16.7893C21 16.2839 20.7992 15.7992 20.4419 15.4419C19.5187 14.5187 19 13.2665 19 11.9609V9C19 5.13401 15.866 2 12 2ZM13.937 19C13.937 19.332 13.9132 19.6728 13.753 19.9636C13.4127 20.5814 12.7552 21 12 21C11.2448 21 10.5873 20.5814 10.247 19.9636C10.0868 19.6728 10.063 19.332 10.063 19H13.937Z',
  back: 'M8.00096 15.2322L6.01874 13.25H20.751C21.4413 13.25 22.001 12.6904 22.001 12C22.001 11.3097 21.4413 10.75 20.751 10.75H6.01874L8.00096 8.76779C8.48912 8.27964 8.48912 7.48818 8.00096 7.00003C7.5128 6.51187 6.72135 6.51187 6.23319 7.00003L2.11709 11.1161C1.62894 11.6043 1.62894 12.3958 2.11709 12.8839L6.23319 17C6.72135 17.4882 7.5128 17.4882 8.00096 17C8.48911 16.5119 8.48911 15.7204 8.00096 15.2322Z',
}
const Icon = ({ name, size = 20 }: { name: keyof typeof P; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><path d={P[name]} fill="currentColor" fillRule="evenodd" /></svg>
)
const Tick = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden><path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
)
const Spinner = () => <span className="ob-spin" aria-hidden />

function Shell<T>({ initial, poster, script, rest, children }: { initial: T; poster: T; script: (a: Act<T>) => Promise<void>; rest: { x: number; y: number }; children: (s: T) => ReactNode }) {
  return (
    <Stage<T>
      width={440}
      height={820}
      compact={{ below: 440, width: 358, height: 690 }}
      initial={initial}
      poster={poster}
      script={script}
      cursor={{ at: { wide: rest, compact: { x: rest.x - 40, y: Math.min(rest.y, 600) } }, style: 'touch' }}
      className="fd tv bp yf ob"
    >
      {(s, _rect, layout) => (
        <>
          <div className="ob-wash" />
          <Phone width={layout === 'compact' ? 326 : 340} className="ob-phone">
            {children(s)}
          </Phone>
        </>
      )}
    </Stage>
  )
}

// ================= Welcome =================

type W = { phase: Phase; liam: number; maya: number; signing: 'idle' | 'busy' | 'done'; fade: boolean }
const WSTART: W = { phase: 'set', liam: 0, maya: 2, signing: 'idle', fade: false }

const welcomeScript = async (a: Act<W>) => {
  await a.wait(1200)
  a.set({ phase: 'hit' })
  await a.wait(380)
  a.set({ liam: 1, maya: 4 })
  await a.wait(1070)
  a.set({ phase: 'throw' })
  await a.wait(1500)
  a.mark('apple')
  await a.click('apple')
  a.set({ signing: 'busy' })
  await a.wait(1200)
  a.mark('done')
  a.set({ signing: 'done' })
  await a.wait(1500)
  a.set({ fade: true })
  await a.wait(450)
  await a.snap({ ...WSTART, fade: true })
  await a.wait(80)
  a.set({ fade: false })
  await a.move({ x: 330, y: 700 })
}

export function Welcome() {
  return (
    <Shell initial={WSTART} poster={{ ...WSTART, phase: 'throw', liam: 1, maya: 4 }} script={welcomeScript} rest={{ x: 330, y: 700 }}>
      {(s) => (
        <div className="fd-app bp-app ob-app" data-variant="rec">
          <div className="ob-hero"><FieldLayer s={s} variant="rec" /></div>
          <div className="ob-hero__fade" />
          <div className="ob-welcome">
            <Wordmark size={46} />
            <p className="ob-tagline">Score your kid’s game by voice or one tap. Family follows every play live.</p>
            <span className="ob-sso ob-sso--apple" data-target="apple" data-state={s.signing}>
              <States
                value={s.signing}
                states={{
                  idle: <span className="ob-sso__in"><AppleMark />Continue with Apple</span>,
                  busy: <span className="ob-sso__in"><Spinner />Signing in</span>,
                  done: <span className="ob-sso__in"><Tick size={16} />Signed in</span>,
                }}
              />
            </span>
            <span className="ob-sso ob-sso--google"><span className="ob-sso__in"><GoogleMark />Continue with Google</span></span>
            <p className="ob-fine">New or coming back, it’s the same button. Accounts are for adults. By continuing you agree to the Terms and Privacy Policy.</p>
          </div>
          <div className="fdx-fade" data-on={s.fade || undefined} />
        </div>
      )}
    </Shell>
  )
}

// ================= Get set up =================

type G = { step: 'role' | 'team'; score: boolean; follow: boolean; player: string; done: boolean; fade: boolean }
const GSTART: G = { step: 'role', score: false, follow: false, player: '', done: false, fade: false }

const setupScript = async (a: Act<G>) => {
  await a.wait(900)
  a.mark('roles')
  await a.click('role-score')
  a.set({ score: true })
  await a.wait(500)
  await a.click('role-follow')
  a.set({ follow: true })
  await a.wait(600)
  await a.click('continue')
  a.mark('team')
  a.set({ step: 'team' })
  await a.wait(1400)
  await a.click('p-12')
  a.set({ player: '12' })
  await a.wait(600)
  await a.click('follow')
  a.mark('done')
  a.set({ done: true })
  await a.wait(1800)
  a.set({ fade: true })
  await a.wait(450)
  await a.snap({ ...GSTART, fade: true })
  await a.wait(80)
  a.set({ fade: false })
  await a.move({ x: 330, y: 640 })
}

const ROSTER = [['12', 'Maya'], ['7', 'Liam'], ['3', 'Ava'], ['15', 'Ben'], ['9', 'Noah'], ['22', 'Jack'], ['5', 'Mia'], ['18', 'Leo'], ['4', 'Zoe'], ['11', 'Sam'], ['6', 'Ella'], ['20', 'Max']]

function Role({ id, icon, title, sub, on }: { id: string; icon: keyof typeof P; title: string; sub: string; on: boolean }) {
  return (
    <span className="ob-role" data-target={id} data-on={on || undefined}>
      <span className="ob-role__icon"><Icon name={icon} size={22} /></span>
      <span className="ob-role__text">
        <span className="ob-role__title">{title}</span>
        <span className="ob-role__sub">{sub}</span>
      </span>
      <span className="ob-check">{on && <Tick size={13} />}</span>
    </span>
  )
}

export function Setup() {
  return (
    <Shell initial={GSTART} poster={{ ...GSTART, step: 'team', score: true, follow: true, player: '12' }} script={setupScript} rest={{ x: 330, y: 640 }}>
      {(s) => (
        <div className="ob-page">
          <div className="ob-top">
            <span className="ob-round"><Icon name="back" size={20} /></span>
            <span className="ob-steps"><i data-on /><i data-on={s.step === 'team' || undefined} /></span>
            <span className="ob-round ob-round--ghost" />
          </div>
          <div className="ob-steppane" data-step={s.step}>
            <div className="ob-pane">
              <h1 className="ob-h1">What brings you to Sandlot?</h1>
              <p className="ob-sub">Pick all that fit. You can change this later.</p>
              <div className="ob-roles">
                <Role id="role-score" icon="mic" title="I keep score" sub="Score games by voice or one tap" on={s.score} />
                <Role id="role-follow" icon="eye" title="I follow a player" sub="Live scores and stats for your kid" on={s.follow} />
                <Role id="role-run" icon="users" title="I run a team" sub="Set up the roster, invite the parents" on={false} />
              </div>
              <span className="ob-cta" data-target="continue" data-off={!(s.score || s.follow) || undefined}>Continue</span>
              <p className="ob-note">Got an invite link from your team? Open it from your texts and Sandlot puts you on the team for you.</p>
            </div>
            <div className="ob-pane">
              <h1 className="ob-h1">Join your team</h1>
              <div className="ob-invite">
                <span className="ob-invite__badge"><Emblem size={26} /></span>
                <span className="ob-invite__text">
                  <span className="ob-invite__team">Moraga Mustangs</span>
                  <span className="ob-invite__sub">10U Rec · Coach Dan invited you</span>
                </span>
                <span className="ob-invite__ok"><Tick size={12} />Joined</span>
              </div>
              <p className="ob-label">Which player is yours?</p>
              <div className="ob-roster">
                {ROSTER.map(([n, name]) => (
                  <span key={n} className="ob-kid" data-target={`p-${n}`} data-on={s.player === n || undefined}>
                    <span className="ob-kid__n">{n}</span>
                    {name}
                  </span>
                ))}
              </div>
              <span className="ob-cta" data-target="follow" data-off={!s.player || undefined} data-done={s.done || undefined}>
                <Roll>{s.done ? 'You’re all set' : s.player ? 'Follow Maya' : 'Pick a player'}</Roll>
              </span>
              <p className="ob-note">Not on the list? Ask Coach Dan to add your player. You can follow more than one kid.</p>
            </div>
          </div>
          <div className="fdx-fade" data-on={s.fade || undefined} />
        </div>
      )}
    </Shell>
  )
}

// ================= Home =================

type H = { open: boolean; fade: boolean }
const HSTART: H = { open: false, fade: false }

const homeScript = async (a: Act<H>) => {
  await a.wait(1800)
  a.mark('keep')
  await a.click('keepscore')
  a.set({ open: true })
  await a.wait(2800)
  a.set({ fade: true })
  await a.wait(450)
  await a.snap({ ...HSTART, fade: true })
  await a.wait(80)
  a.set({ fade: false })
  await a.move({ x: 330, y: 560 })
}

function MiniField() {
  return (
    <svg className="ob-mini" viewBox="0 0 200 160" aria-hidden>
      <path d="M100 150 L-4 46 Q100 -40 204 46 Z" fill="#56a04b" />
      <path d="M-4 46 Q100 -40 204 46" fill="none" stroke="#f4c430" strokeWidth="3" />
      <path d="M100 152 L52 104 Q100 44 148 104 Z" fill="#c8915f" />
      <path d="M100 146 L-4 42 M100 146 L204 42" stroke="rgba(255,255,255,0.85)" strokeWidth="1.2" />
      {[[128, 118], [100, 90], [72, 118]].map(([x, y], i) => (
        <rect key={i} x={x - 3.5} y={y - 3.5} width="7" height="7" fill="#fff" transform={`rotate(45 ${x} ${y})`} />
      ))}
    </svg>
  )
}

export function Home() {
  return (
    <Shell initial={HSTART} poster={HSTART} script={homeScript} rest={{ x: 330, y: 560 }}>
      {(s) => (
        <div className="ob-page ob-page--home">
          <div className="ob-bar">
            <Wordmark size={24} />
            <span className="ob-bar__right">
              <span className="ob-round ob-round--plain"><Icon name="bell" size={20} /></span>
              <span className="ob-avatar">C</span>
            </span>
          </div>
          <p className="ob-date">Saturday, November 7</p>
          <h1 className="ob-h1 ob-h1--home">Game day, Christian</h1>

          <div className="ob-game">
            <MiniField />
            <span className="ob-game__when">Today · 10:00 AM · Field 2</span>
            <span className="ob-game__vs">Mustangs <i>vs</i> Hawks</span>
            <span className="ob-game__chips">
              <span className="ob-chip"><Tick size={12} />Lineup set</span>
              <span className="ob-chip">You’re scoring</span>
            </span>
            <span className="ob-keep" data-target="keepscore"><Icon name="mic" size={20} />Keep score</span>
            <span className="ob-game__more">
              <span className="ob-ghost"><Icon name="video" size={18} />Stream video</span>
              <span className="ob-ghost"><Icon name="link" size={18} />Share live link</span>
            </span>
          </div>

          <div className="ob-kidcard">
            <span className="ob-kid__n ob-kid__n--big">12</span>
            <span className="ob-kidcard__text">
              <span className="ob-kidcard__name">Maya</span>
              <span className="ob-kidcard__sub">.412 · 14 hits · 9 runs this season</span>
            </span>
            <span className="ob-kidcard__go">›</span>
          </div>

          <p className="ob-label">Coming up</p>
          <div className="ob-list">
            <span className="ob-li"><span className="ob-li__date"><b>14</b>NOV</span><span className="ob-li__text">vs Eagles<small>Sat · 9:00 AM · Field 1</small></span></span>
            <span className="ob-li"><span className="ob-li__date"><b>21</b>NOV</span><span className="ob-li__text">at Giants<small>Sat · 11:00 AM · Rancho Field</small></span></span>
            <span className="ob-li"><span className="ob-li__date"><b>24</b>NOV</span><span className="ob-li__text">Team photo and practice<small>Tue · 5:30 PM · Field 2</small></span></span>
          </div>

          <div className="ob-tabs">
            <span className="ob-tab" data-on><Icon name="house" size={22} />Home</span>
            <span className="ob-tab"><Icon name="calendar" size={22} />Games</span>
            <span className="ob-tab"><Icon name="users" size={22} />Team</span>
            <span className="ob-tab"><Icon name="user" size={22} />Me</span>
          </div>

          <div className="ob-sheetwrap" data-open={s.open || undefined}>
            <Scene s={SCORER_START} variant="rec" />
          </div>
          <div className="fdx-fade" data-on={s.fade || undefined} />
        </div>
      )}
    </Shell>
  )
}
