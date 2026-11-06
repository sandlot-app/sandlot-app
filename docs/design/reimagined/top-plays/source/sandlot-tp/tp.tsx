import { Stage, Phone, Count, Roll, type Act } from '../../kit'
import photo from '../sandlot-stream/live-stream.jpg'
import '../sandlot-fieldday/fieldday.css'
import './tp.css'

// Top plays of the week: the league's best moments, cut from game
// recordings (plan milestone 14). Ranked by the game situation (a hit that
// ties it in the last inning beats one in a blowout) and by how many
// families cheered. Only families registered in the league see the feed,
// and a parent can hide their kid's clips at any time.
//
// Beats: the #1 clip plays, families keep cheering so Leo's first hit of
// the season climbs from 4th to 3rd, then the viewer adds a cheer to #1.
//
// The clips are a still photo of a real youth game standing in for video.

// icons.download, bold solid round
const P = {
  fire: 'M20.25 13.75C20.25 18.3063 16.5563 22 12 22C7.44365 22 3.75 18.3063 3.75 13.75C3.75 8.06518 8.18894 3.86003 10.5547 2.02255C11.1702 1.54454 12 1.99606 12 2.77535V7.74996C12 8.71646 12.7835 9.49997 13.75 9.49997C14.7165 9.49997 15.5 8.71646 15.5 7.74996V7.49996C15.5 6.93074 16.0907 6.56139 16.5646 6.87673C18.7861 8.35499 20.25 10.8815 20.25 13.75Z',
  play: 'M8.00056 20.6663C6.66722 21.4367 5 20.4745 5 18.9346V5.06537C5 3.52548 6.66722 2.56326 8.00055 3.33363L20.0028 10.2683C21.3354 11.0382 21.3354 12.9618 20.0028 13.7317L8.00056 20.6663Z',
  crown: 'M11.5658 3.75974C11.7578 3.42384 12.2421 3.42384 12.4341 3.75974L15.9999 10L22.1718 7.35495C22.5325 7.20035 22.9226 7.50264 22.8629 7.89055L21.2608 18.3041C21.1107 19.2798 20.2712 20 19.2841 20H4.71578C3.72864 20 2.88914 19.2798 2.73904 18.3041L1.13695 7.89055C1.07727 7.50264 1.46735 7.20035 1.82809 7.35495L7.99994 10L11.5658 3.75974Z',
  heart: 'M12 5.12153L11.8635 4.99264C10.7014 3.85554 9.14236 3.21536 7.5165 3.20764C5.92264 3.20764 4.39391 3.84008 3.2659 4.96612C2.13789 6.09216 1.50278 7.61979 1.5 9.21364C1.5 12.4476 2.6865 13.9911 7.989 18.1806L10.7737 20.3421C11.4953 20.9022 12.5047 20.9022 13.2263 20.3421L16.011 18.1806C21.3135 13.9911 22.5 12.4476 22.5 9.21364C22.4972 7.61979 21.8621 6.09216 20.7341 4.96612C19.6061 3.84008 18.0773 3.20764 16.4835 3.20764C14.8576 3.21536 13.2986 3.85554 12.1365 4.99264L12 5.12153Z',
  back: 'M8.00096 15.2322L6.01874 13.25H20.751C21.4413 13.25 22.001 12.6904 22.001 12C22.001 11.3097 21.4413 10.75 20.751 10.75H6.01874L8.00096 8.76779C8.48912 8.27964 8.48912 7.48818 8.00096 7.00003C7.5128 6.51187 6.72135 6.51187 6.23319 7.00003L2.11709 11.1161C1.62894 11.6043 1.62894 12.3958 2.11709 12.8839L6.23319 17C6.72135 17.4882 7.5128 17.4882 8.00096 17C8.48911 16.5119 8.48911 15.7204 8.00096 15.2322Z',
}
const Icon = ({ name, size = 18 }: { name: keyof typeof P; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><path d={P[name]} fill="currentColor" /></svg>
)

type Clip = { id: string; who: string; what: string; game: string; why: string; cheers: number; pos: string; mine?: boolean }
const CLIPS: Clip[] = [
  { id: 'ava', who: 'Ava', what: 'throws out the runner at home', game: 'Mustangs vs Hawks · Sat', why: 'Saved the lead', cheers: 41, pos: '18% 70%', mine: true },
  { id: 'owen', who: 'Owen', what: 'turns a 6-4-3 double play', game: 'Eagles at Giants · Thu', why: 'Ended a bases-loaded jam', cheers: 39, pos: '78% 40%' },
  { id: 'leo', who: 'Leo', what: 'gets his first hit of the season', game: 'Mustangs vs Hawks · Sat', why: 'First hit of the season', cheers: 36, pos: '50% 62%', mine: true },
  { id: 'giants', who: 'Giants', what: 'walk it off on a wild pitch', game: 'Rockets at Giants · Tue', why: 'Won it in the last inning', cheers: 30, pos: '88% 75%' },
]

type T = { playing: boolean; progress: number; leo: number; cheered: boolean; order: string[]; fade: boolean }
const TSTART: T = { playing: false, progress: 0, leo: 36, cheered: false, order: ['ava', 'owen', 'leo', 'giants'], fade: false }
const REST = { wide: { x: 330, y: 560 }, compact: { x: 290, y: 560 } }

const script = async (a: Act<T>) => {
  await a.wait(900)
  a.mark('play')
  await a.click('playclip')
  a.set({ playing: true })
  // Families keep cheering while the clip plays; Leo's first hit climbs
  for (let i = 1; i <= 4; i++) {
    await a.wait(700)
    a.put((s) => ({ progress: i / 5, leo: s.leo + 1 }))
  }
  a.mark('climb')
  a.set({ order: ['ava', 'leo', 'owen', 'giants'] })
  await a.wait(900)
  a.set({ progress: 1 })
  await a.wait(900)
  a.mark('cheer')
  await a.click('cheer')
  a.set({ cheered: true })
  await a.wait(2400)
  a.set({ fade: true })
  await a.wait(450)
  await a.snap({ ...TSTART, fade: true })
  await a.wait(80)
  a.set({ fade: false })
  await a.move(REST)
}

function Row({ c, rank, cheers }: { c: Clip; rank: number; cheers: number }) {
  return (
    <div className="tp-row" style={{ transform: `translateY(${(rank - 2) * 74}px)` }} data-mine={c.mine || undefined}>
      <span className="tp-row__rank"><Roll>{String(rank)}</Roll></span>
      <span className="tp-thumb" style={{ backgroundImage: `url(${photo})`, backgroundPosition: c.pos }}>
        <Icon name="play" size={14} />
      </span>
      <span className="tp-row__text">
        <span className="tp-row__what"><b>{c.who}</b> {c.what}</span>
        <span className="tp-row__meta">{c.game}</span>
      </span>
      <span className="tp-row__cheers"><Icon name="heart" size={12} /><Count value={cheers} duration={400} /></span>
    </div>
  )
}

export function TopPlays() {
  return (
    <Stage<T>
      width={440}
      height={820}
      compact={{ below: 440, width: 358, height: 690 }}
      initial={TSTART}
      poster={{ ...TSTART, playing: true, progress: 0.45 }}
      script={script}
      cursor={{ at: REST, style: 'touch' }}
      className="tpw"
    >
      {(s, _rect, layout) => (
        <>
          <div className="tp-wash" />
          <Phone width={layout === 'compact' ? 326 : 340} className="tp-phone">
            <div className="tp-page">
              <div className="tp-top">
                <span className="tp-round"><Icon name="back" size={20} /></span>
                <span className="tp-seg"><span data-on>League</span><span>Mustangs</span></span>
                <span className="tp-round tp-round--ghost" />
              </div>
              <h1 className="tp-h1">Top plays of the week</h1>
              <p className="tp-sub">Lamorinda 10U Rec · Nov 1–7</p>

              <div className="tp-hero" data-playing={s.playing || undefined}>
                <div className="tp-hero__img" style={{ backgroundImage: `url(${photo})` }} />
                <div className="tp-hero__shade" />
                <span className="tp-rank1"><Icon name="crown" size={14} />#1</span>
                <span className="tp-dur">0:12</span>
                <span className="tp-moment">B6 · MUS 4 · HAW 4</span>
                <span className="tp-playbtn" data-target="playclip"><Icon name="play" size={26} /></span>
                <div className="tp-hero__cap">
                  <span className="tp-hero__what"><b>Maya</b> doubles to center to tie it in the last inning</span>
                  <span className="tp-hero__game">Mustangs vs Hawks · Saturday</span>
                </div>
                <span className="tp-progress"><i style={{ transform: `scaleX(${s.progress})` }} /></span>
              </div>

              <div className="tp-why">
                <span className="tp-why__item"><Icon name="fire" size={15} />Tied it with two outs</span>
                <span className="tp-cheer" data-target="cheer" data-on={s.cheered || undefined}>
                  <Icon name="heart" size={16} />
                  <Count value={s.cheered ? 49 : 48} duration={350} />
                  <span>{s.cheered ? 'Cheered' : 'Cheer'}</span>
                </span>
              </div>

              <p className="tp-label">More this week</p>
              <div className="tp-list">
                {CLIPS.map((c) => (
                  <Row key={c.id} c={c} rank={s.order.indexOf(c.id) + 2} cheers={c.id === 'leo' ? s.leo : c.cheers} />
                ))}
              </div>

              <p className="tp-note">Only families in Lamorinda 10U Rec see these clips. Parents can hide their kid’s clips anytime.</p>
              <div className="fdx-fade" data-on={s.fade || undefined} />
            </div>
          </Phone>
        </>
      )}
    </Stage>
  )
}
