import { StrictMode, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import Voice from '../examples/sandlot-youth-rec'
import Tiles from '../examples/sandlot-tap-tiles'
import Live from '../examples/sandlot-fan-live'
import Player from '../examples/sandlot-u3-player-play'
import Lock from '../examples/sandlot-fan-lock'
import StSetup from '../examples/sandlot-stream-setup'
import StLive from '../examples/sandlot-stream-live'
import StEnd from '../examples/sandlot-stream-end'
import ObWelcome from '../examples/sandlot-ob-welcome'
import ObSetup from '../examples/sandlot-ob-setup'
import ObHome from '../examples/sandlot-ob-home'
import GbGames from '../examples/sandlot-u1-games-play'
import GbSetup from '../examples/sandlot-s3-setup-simple'
import GbPregame from '../examples/sandlot-u1-pregame-play'
import GdMore from '../examples/sandlot-s2-more-simple'
import GdFix from '../examples/sandlot-s2-fix-simple'
import GdDelay from '../examples/sandlot-gd-delay'
import GdOffline from '../examples/sandlot-gd-offline'
import GdConfirm from '../examples/sandlot-gd-confirm'
import GaClose from '../examples/sandlot-s1-close-simple'
import GaSummary from '../examples/sandlot-u2-final-play'
import GaRecap from '../examples/sandlot-ga-recap'
import GaBox from '../examples/sandlot-u2-box-play'
import GtTeam from '../examples/sandlot-u3-team-play'
import GtMe from '../examples/sandlot-s3-me-simple'
import GtPublic from '../examples/sandlot-gt-public'
import TpWeek from '../examples/sandlot-tp-week'
import GpTeamcard from '../examples/sandlot-gp-teamcard'
import GpPlus from '../examples/sandlot-gp-plus'
import GrProfile from '../examples/sandlot-gr-profile'
import GrScout from '../examples/sandlot-gr-scout'
import GrUnder13 from '../examples/sandlot-gr-under13'
import './showcase.css'
import './direction.css'

type Screen = { id: string; n: string; name: string; line: string; body: string; from: string; Demo: ComponentType }

const START: Screen[] = [
  {
    id: 'ob-welcome',
    n: 'Getting started · 1',
    name: 'Welcome',
    line: 'Sign up and log in are the same button.',
    body: 'The Rec field plays behind the Sandlot logo. Parents continue with Apple or Google; new or returning, it’s the same tap, so there’s no password and no separate sign-up form. Accounts are for adults.',
    from: 'Apple and Google only in the first version, as the plan says.',
    Demo: ObWelcome,
  },
  {
    id: 'ob-setup',
    n: 'Getting started · 2',
    name: 'Get set up',
    line: 'Two questions, first time only.',
    body: 'What brings you to Sandlot: keep score, follow a player, run a team (pick all that fit). Then join your team from the coach’s invite and tap which player is yours. An invite link from a text skips straight to the team.',
    from: 'Roles from the plan: admin, scorekeeper, parent and fan.',
    Demo: ObSetup,
  },
  {
    id: 'ob-home',
    n: 'Getting started · 3',
    name: 'Home',
    line: 'Game day in one card.',
    body: 'Today’s game up top with one big Keep score, plus Stream video and Share live link. Below: your player’s season, and what’s coming up. Keep score opens the Field Day scorer.',
    from: 'Tabs: Home, Games, Team, Me.',
    Demo: ObHome,
  },
]

const SCORER: Screen[] = [
  {
    id: 'voice',
    n: 'Scorer · voice',
    name: 'Field Day',
    line: 'Tap once, say the play, watch it happen.',
    body: 'The Rec field fills the screen under the TV score bug. Tap the mic once (no holding) and say the play. The words appear, the play runs on the field (the ball, the fielders, the runners), the score bug catches up, and the play saves itself with one Undo. Ball and Strike stay one tap each beside the mic.',
    from: 'Chosen: Field Day concept, TV score bug, Rec youth field.',
    Demo: Voice,
  },
  {
    id: 'tiles',
    n: 'Scorer · no voice',
    name: 'Big buttons',
    line: 'One question at a time.',
    body: 'For people who don’t want to talk to their phone. Four big tiles: Ball, Strike, Foul and In play. In play asks what happened (Single, Double, Triple, Home run, Out, Error), then where it went (Left, Center, Right). The same play runs on the field and saves with one Undo.',
    from: 'Chosen over Tap the field and Tap the sentence.',
    Demo: Tiles,
  },
]

const FAN: Screen[] = [
  {
    id: 'live',
    n: 'Fan · 1',
    name: 'Live game',
    line: 'The same field, nothing to press.',
    body: 'A parent or grandparent watching from anywhere. Plays arrive as the scorer records them: the count fills in, the play runs on the field, and a banner calls out their player. Underneath, their player’s line for today and a play-by-play where the current at-bat updates in place.',
    from: 'Following one player: Maya #12.',
    Demo: Live,
  },
  {
    id: 'player',
    n: 'Fan · 2',
    name: 'Maya’s card',
    line: 'Her own trading card. Tap to flip.',
    body: 'The front shows her number, today’s hits drawn on a little field and three big numbers. Tap and it flips to a cream back with her season (.412, 14 hits, 9 runs, 6 RBI) and stamped recent games. A Share card button sits under it.',
    from: 'Replaces the Today / Season page.',
    Demo: Player,
  },
  {
    id: 'lock',
    n: 'Fan · 3',
    name: 'Lock screen',
    line: 'Keep up without opening the app.',
    body: 'A Live Activity on the lock screen keeps the score, the bases and the count, plus a line about their player. When she does something, a notification says so in plain words.',
    from: 'iOS Live Activity and a regular notification.',
    Demo: Lock,
  },
]

const STREAM: Screen[] = [
  {
    id: 'st-setup',
    n: 'Streaming · 1',
    name: 'Set up',
    line: 'Line it up, check it, go live.',
    body: 'The phone goes sideways on the backstop. A guide shows where home plate should sit; when the camera is lined up it turns green. Beside it: the score is linked to the scorer’s phone, the signal, the battery (with a nudge to plug in) and who can watch. Go live counts down 3, 2, 1.',
    from: 'Landscape, because the phone is mounted on the fence.',
    Demo: StSetup,
  },
  {
    id: 'st-live',
    n: 'Streaming · 2',
    name: 'Live',
    line: 'The score draws itself on the video.',
    body: 'The camera fills the screen with the score bug in the corner, the way families see it. When the scorer saves a play, the score updates and a caption (“Liam singles to left. Maya scores!”) slides onto the video by itself. The streamer sees the timer, how many are watching, signal, battery, mute, zoom and End. If the signal drops, it lowers quality to stay live and says so.',
    from: 'Nothing to type while filming.',
    Demo: StLive,
  },
  {
    id: 'st-end',
    n: 'Streaming · 3',
    name: 'End',
    line: 'Stop the video, keep the game.',
    body: 'End asks once, and says the score keeps going. Then a summary: how long it ran, how many families watched, how many plays made it onto video, and that the replay is saved on the game page. Share the replay link or finish.',
    from: 'Clips of each kid’s plays come later, from this recording.',
    Demo: StEnd,
  },
]


const BEFORE: Screen[] = [
  { id: 'gb-games', n: 'Before · 1', name: 'Game day board', line: 'Today’s game is a little live field.', body: 'The live game is a field card with the score bug; when Maya scores, a “Maya scored” flag goes up at the plate. Upcoming games are ticket stubs you swipe, past games are scoreboard plates, and tapping the live card opens the game.', from: 'Replaces the Games list: no rows, toggles or search.', Demo: GbGames },
  { id: 'gb-setup', n: 'Before · 2', name: 'Start a game', line: 'Everything filled in, one button.', body: 'Today’s game from the schedule and last Saturday’s batting order as jersey chips, with the pitcher. One big Start game button; a missing Hawks lineup is asked at their first batter instead of blocking. Edit lineup and Details are quiet links.', from: 'Replaces Game setup and Lineup as one screen. Never ask what the app can work out.', Demo: GbSetup },
  { id: 'gb-pregame', n: 'Before · 3', name: 'Before first pitch', line: 'The Mustangs run out in batting order.', body: 'At 0–0 with 10:00 AM on the score bug, the orange chips run out of the dugout and line up along the first-base line in batting order, Maya glowing. A pennant on the foul pole counts down to first pitch.', from: 'Replaces the batting-order list under the field.', Demo: GbPregame },
]

const DURING: Screen[] = [
  { id: 'gd-more', n: 'During · 1', name: 'More menu', line: 'Four plays that really happen, or just say it.', body: 'Four big tiles: Stolen base, Hit by pitch, Pitching change, Delay, with “Or just say it” on top and the rare plays behind Other plays. A steal skips “who’s running?” when only Liam is on, runs him to 2nd and saves with Undo.', from: 'Simplified from the milestone 4 More sheet.', Demo: GdMore },
  { id: 'gd-fix', n: 'During · 2', name: 'Fix a play', line: 'Fix the last play with two taps.', body: 'Fix sits beside Undo on the saved card. It turns into “What was it really?” with four tiles and one line of what changes (“Liam ends on 2nd. Score stays 3–1.”), then Save. Older plays open the same card from the play log.', from: 'Replaces the play list, step flow and review sheet.', Demo: GdFix },
  { id: 'gd-delay', n: 'During · 3', name: 'Rain delay', line: 'Stop for rain, then end it for today.', body: 'Pick Rain and the field dims, the score bug gets a Delayed badge and a timer runs. End for today offers Suspended or Called, each explained in one line (Called only after 4 full innings).', from: 'Replaces the Delay and suspended screens.', Demo: GdDelay },
  { id: 'gd-offline', n: 'During · 4', name: 'No signal', line: 'Scoring never waits for the network.', body: 'A pill under the score bug turns yellow, “No signal · 3 plays on this phone”, and keeps counting as plays are recorded. When signal returns it sends them and turns green.', from: 'The plan’s one rule for failures: no failure stops scoring.', Demo: GdOffline },
  { id: 'gd-confirm', n: 'During · 5', name: 'Two readings', line: 'A short question, only when two readings fit.', body: '“Liam hits it to short, safe at first” could be a single or an error, so nothing saves and a calm card asks which it was, with one-line consequences. One tap and the play runs and saves with Undo.', from: 'ADR 0007: cards only when two readings are both believable.', Demo: GdConfirm },
]

const AFTER: Screen[] = [
  { id: 'ga-close', n: 'After · 1', name: 'End of game', line: 'One card, one button, book closed.', body: '“That’s the game! Mustangs win 7–4.” The one button waits by itself while the last play saves, then Finish and share closes the book and sends the recap to families, and offers Maya’s stat card.', from: 'Replaces Close the book; closing still waits for every play to save.', Demo: GaClose },
  { id: 'ga-summary', n: 'After · 2', name: 'Final scoreboard', line: 'The game ends on the field.', body: 'A FINAL board hangs over the outfield with runs by inning as lit squares. Maya’s double and single draw on the grass with 2B and 1B tags, and one ticket below holds her line and the recap headline.', from: 'Replaces the tabbed summary and linescore table.', Demo: GaSummary },
  { id: 'ga-recap', n: 'After · 3', name: 'Recap and stat card', line: 'A story from the scorebook, and a card to post.', body: 'A short story with tappable play links, then Share slides up Maya’s stat card: the logo, her line, the final and a field with her hits. Save image or Share.', from: 'Follows the recap story rules: a child is named only for her family.', Demo: GaRecap },
  { id: 'gp-teamcard', n: 'After · 5', name: 'Team share card', line: 'Share the win without naming anyone’s kid.', body: 'A family that hasn’t claimed a player gets a team card: “Mustangs win 7–4”, runs by inning as small bars, “Four runs in the last two innings”, the record and the next game. One soft Claim line; pick a jersey and the same card turns into that kid’s card.', from: 'Recap rule: a share image names a child only for the family that claimed her.', Demo: GpTeamcard },
  { id: 'ga-box', n: 'After · 6', name: 'Box score cards', line: 'A deck of baseball cards you swipe.', body: 'One card per kid, Maya on top, each with a mini field of their balls in play and their line in a phrase. Swipe to the next kid; pitchers flip to show pitches used against the 75 limit. The Hawks are a small stack by number.', from: 'Replaces the box-score list and team toggle.', Demo: GaBox },
]

const TEAM: Screen[] = [
  { id: 'gt-team', n: 'Team · 1', name: 'Team on the field', line: 'The Mustangs, standing where they play.', body: 'Every kid’s chip stands at their position, the bench sits in the dugout, and a pennant carries the 6–2 record. One Invite parents button texts a link; dots turn into checks as parents join.', from: 'Replaces the roster grid; roles stay behind People.', Demo: GtTeam },
  { id: 'gt-me', n: 'Team · 2', name: 'Me', line: 'One switch, one sentence, one account.', body: '“Tell me when Maya plays”, privacy in one sentence (“Only Mustangs families see names. Public links show numbers.”), and the account. Removing Maya or deleting the account is one quiet link with a calm confirm.', from: 'Plan: in-app deletion of a child or an account.', Demo: GtMe },
  { id: 'gt-public', n: 'Team · 3', name: 'Public link', line: 'What someone sees with no account.', body: 'A shared game link in a browser: the score bug and Rec field with positions instead of names, a Names are hidden banner, and plays by number (“#7 singles to left, #12 scores”). A soft card offers the app.', from: 'Public game states: numbers and positions only.', Demo: GtPublic },
]

const HIGHLIGHTS: Screen[] = [
  { id: 'tp-week', n: 'Highlights', name: 'Top plays of the week', line: 'The league’s best moments, ranked.', body: 'The #1 clip plays up top with why it ranks (tied it with two outs) and a Cheer button. Below, the rest of the week re-ranks as families cheer: Leo’s first hit of the season climbs from 4th to 3rd. Only the league’s families see it, and parents can hide their kid’s clips.', from: 'Plan milestone 14: the league top-plays feed. Clips use the photo as a stand-in.', Demo: TpWeek },
]


const PLUS: Screen[] = [
  { id: 'gp-plus', n: 'Video plan', name: 'Video plan', line: 'Scores stay free; video is one tap and a free week.', body: 'A free parent taps the locked Video tab and one sheet slides up: “Watch Maya play, live”, three benefits (live video, replays, clips of Maya’s plays), a note that scores, play-by-play and stat cards stay free, Monthly or Yearly, and one “Start your free week”. Then the video plays on the live screen.', from: 'Plan: video is paid, one Family price. Prices ($4.99 a month, $39.99 a year) are placeholders until the streaming cost test.', Demo: GpPlus },
]

const RECRUIT: Screen[] = [
  { id: 'gr-profile', n: 'Recruiting · 1', name: 'Recruiting profile', line: 'The parent decides who sees it.', body: 'Nico (15) has one “Who can see this” choice: only people I share with, plus verified scouts, or off. Verified stats scored in Sandlot sit apart from imported GameChanger games, with clips and one Share button. When a verified scout asks to get in touch, the request comes to the parent: Approve or Not now.', from: 'Plan milestone 16: 13 and up, parent-managed, verified stats separate, no contact details.', Demo: GrProfile },
  { id: 'gr-scout', n: 'Recruiting · 2', name: 'Scout view', line: 'Stats first, no contact info.', body: 'A verified scout sees Nico’s verified stats front and center, a clip, and imported games labeled apart. No phone or email anywhere. “Ask to contact Nico’s family” sends a short note to the parent, who decides.', from: 'Plan: verified scouts only see profiles parents opt in to share.', Demo: GrScout },
  { id: 'gr-under13', n: 'Recruiting · 3', name: 'Under 13', line: 'Maya’s profile opens when she turns 13.', body: 'A warm note instead of a form: kids under 13 can’t be published or scouted, Maya’s stats keep counting, and a switch reminds the parent when she turns 13.', from: 'Plan: no player under 13 is published or scouted.', Demo: GrUnder13 },
]

function Wide({ items }: { items: Screen[] }) {
  return (
    <div className="dr-wide">
      {items.map(({ id, n, name, line, body, from, Demo }) => (
        <article key={id} className="dr-wide__card">
          <div className="dr-wide__demo"><Demo /></div>
          <div className="sc-copy">
            <p className="sc-n">{n}</p>
            <h2>{name}</h2>
            <p className="sc-line">{line}</p>
            <p className="sc-body">{body}</p>
            <p className="sc-from">{from}</p>
          </div>
        </article>
      ))}
    </div>
  )
}

function Grid({ items }: { items: Screen[] }) {
  return (
    <div className="sc-grid">
      {items.map(({ id, n, name, line, body, from, Demo }) => (
        <article key={id} className="sc-card">
          <div className="sc-demo"><Demo /></div>
          <div className="sc-copy">
            <p className="sc-n">{n}</p>
            <h2>{name}</h2>
            <p className="sc-line">{line}</p>
            <p className="sc-body">{body}</p>
            <p className="sc-from">{from}</p>
          </div>
        </article>
      ))}
    </div>
  )
}

const COLORS = [
  ['Sandlot orange', '#FF7519', 'Mic, our runners, Undo, In play'],
  ['Sandlot green', '#0C4C39', 'Headings, saved tick'],
  ['Ball', '#2FB862', 'Ball button and dots'],
  ['Strike', '#F2AC16', 'Strike button and dots'],
  ['Out', '#E5484D', 'Out dots'],
  ['Hawks navy', '#25447E', 'The other team’s fielders'],
  ['Grass', '#56A04B', 'Field'],
  ['Infield dirt', '#C8915F', 'Rec infield'],
  ['Fence cap', '#F4C430', 'Chain-link top'],
  ['Paper', '#F4F1E8', 'Bottom sheet, pages'],
]

function Page() {
  return (
    <main className="sc">
      <header className="sc-head">
        <p className="sc-eyebrow">Sandlot · design direction</p>
        <h1>The new UI direction</h1>
        <p className="sc-lede">Every screen chosen so far, moving, plus the colors, parts and rules behind them. The starting point for updating the Figma or starting a new one.</p>
      </header>

      <section className="dr-section">
        <h2>Getting started</h2>
        <p>The first screens a parent sees, with the Sandlot logo from the Figma file.</p>
        <Grid items={START} />
      </section>

      <section className="dr-section">
        <h2>Before the game</h2>
        <p>Today’s game as a little live field, one tap to start it, and the lineup running out before first pitch.</p>
        <Grid items={BEFORE} />
      </section>

      <section className="dr-section">
        <h2>Scoring a game</h2>
        <p>The scorer is a parent at the field. The field is the app: what you record happens on it, so you can see it’s right.</p>
        <Grid items={SCORER} />
      </section>

      <section className="dr-section">
        <h2>During the game</h2>
        <p>The scorer’s other tools, kept small: four More tiles, a two-tap fix, rain delays, no signal, and the rare voice question.</p>
        <Grid items={DURING} />
      </section>

      <section className="dr-section">
        <h2>After the game</h2>
        <p>One card ends the game; then a FINAL board on the field, the story, the share cards and a box score you swipe like baseball cards.</p>
        <Grid items={AFTER} />
      </section>

      <section className="dr-section">
        <h2>Following a player</h2>
        <p>Fans don’t score. They follow one kid. Same field and score bug, no controls, and their player is the one that lights up.</p>
        <Grid items={FAN} />
      </section>

      <section className="dr-section">
        <h2>Video plan</h2>
        <p>Everything about the score stays free. Video, replays and clips are one family plan, offered at the moment a parent wants to watch.</p>
        <Grid items={PLUS} />
      </section>

      <section className="dr-section">
        <h2>Highlights</h2>
        <p>Clips cut from game recordings, later in the plan.</p>
        <Grid items={HIGHLIGHTS} />
      </section>

      <section className="dr-section">
        <h2>Recruiting (13 and up)</h2>
        <p>Parents run their teen’s profile and decide who sees it. Scouts are verified, never see contact details, and ask the parent first.</p>
        <Grid items={RECRUIT} />
      </section>

      <section className="dr-section">
        <h2>Streaming a game</h2>
        <p>A second phone on the backstop streams video to families. This is the in-app broadcaster from the plan’s later milestone; the first version streams through an existing app. The camera view is a still photo standing in for live video; the score, captions and controls drawn over it are the design.</p>
        <Wide items={STREAM} />
      </section>

      <section className="dr-section">
        <h2>Team and account</h2>
        <p>The roster and invites, settings and privacy, and what a shared link shows without an account.</p>
        <Grid items={TEAM} />
      </section>

      <section className="dr-section">
        <h2>For the Figma</h2>
        <p>What to carry into the design file.</p>
        <div className="dr-notes">
          <div className="dr-note">
            <h3>Colors</h3>
            <p className="dr-files">Not in <code>@sandlot/tokens</code> yet: update the tokens first, then build screens from token names, never raw hex.</p>
            <div className="dr-swatches">
              {COLORS.map(([name, hex, use]) => (
                <span key={hex} className="dr-swatch">
                  <i style={{ background: hex }} />
                  <span>{name}<code>{hex} · {use}</code></span>
                </span>
              ))}
            </div>
          </div>
          <div className="dr-note">
            <h3>Parts</h3>
            <ul>
              <li><b>TV score bug:</b> teams and runs stacked, bases with outs, inning with ball and strike dots.</li>
              <li><b>Rec field:</b> tilted view, all-dirt infield, chain-link fence with team banners, trees, bleachers, worn grass.</li>
              <li><b>Player chips:</b> ours orange with number and name tag; theirs small navy, no names.</li>
              <li><b>Saved play card:</b> green tick, what happened, who moved, one Undo.</li>
              <li><b>Mic:</b> one big orange button, tap once; rings while listening.</li>
              <li><b>Big tiles:</b> 2×2 pitch tiles, 3×2 result tiles, Left/Center/Right with field wedges.</li>
              <li><b>Fan parts:</b> Live pill, player banner, follow strip, play-by-play rows, stat tiles, hit chart, Live Activity.</li>
              <li><b>Logo:</b> Figma’s Logo / Emblem and Wordmark (Inter Extra Bold, emblem 0.933× the type size, home plate below the baseline).</li>
              <li><b>Sign-in:</b> Apple (black) and Google (white) buttons, same size, Apple first.</li>
              <li><b>Streaming parts:</b> framing guide, setup checklist, countdown, video score bug, play caption, signal toast, end summary.</li>
            </ul>
          </div>
          <div className="dr-note">
            <h3>Rules</h3>
            <ul>
              <li>Youth field, not a stadium: chain-link, trees and small bleachers; no grandstands, crowds or light towers.</li>
              <li>The mic is tap once, never hold.</li>
              <li>A described play saves without asking; a banner and one Undo fix it.</li>
              <li>Ball and Strike are always one tap.</li>
              <li>Every play runs on the field so the scorer can see it’s right.</li>
              <li>Names show on screen only; saved data refers to players by ID.</li>
              <li>Streaming is landscape. The video’s score comes from the scorer’s phone, never typed by the streamer.</li>
            </ul>
          </div>
          <div className="dr-note">
            <h3>Where the files are</h3>
            <p className="dr-files">
              In the repo, under <code>docs/design/reimagined/</code>:<br />
              <code>field-day-youth/</code> voice scorer (Rec field)<br />
              <code>field-day-tap/</code> no-voice scorer (Big buttons)<br />
              <code>field-day-fan/</code> fan screens<br />
              <code>field-day-stream/</code> streaming screens<br />
              <code>getting-started/</code> welcome, set up, home<br />
              <code>before-game/</code>, <code>during-game/</code>, <code>after-game/</code>, <code>team-account/</code>, <code>top-plays/</code>, <code>simpler/</code><br />
              <code>share-and-plan/</code> team card, video plan · <code>recruiting/</code> profile, scout, under 13<br />
              <code>direction/</code> this page<br />
              Each has still images and the mockup source.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<StrictMode><Page /></StrictMode>)
