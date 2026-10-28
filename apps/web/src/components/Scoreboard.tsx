import type { Base, GameState, TeamSide } from '@sandlot/engine';
import bat from '../assets/bat.svg';
import glove from '../assets/glove.svg';
import type { ConnectionStatus } from '../live.ts';
import type { Roster } from '../roster.ts';

export function inningText(state: GameState): string {
  switch (state.status) {
    case 'pregame':
      return 'Not started';
    case 'final':
      return 'Final';
    case 'in_progress':
      return `${state.half === 'top' ? 'Top' : 'Bottom'} ${state.inning}`;
  }
}

const BASE_NAMES: Record<Base, string> = { 1: '1st', 2: '2nd', 3: '3rd' };
const BASES: Base[] = [2, 3, 1];

export function runnersText(bases: Base[]): string {
  if (bases.length === 0) return 'bases empty';
  const names = [...bases].sort().map((base) => BASE_NAMES[base]);
  return names.length === 1 ? `runner on ${names[0]}` : `runners on ${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

function MiniDiamond({ bases }: { bases: GameState['bases'] }) {
  return (
    <span className="mini-diamond" aria-hidden="true">
      {BASES.map((base) => (
        <span key={base} className={`mini-base base-${base}${bases[base] ? ' on' : ''}`} />
      ))}
    </span>
  );
}

/** The batting team gets the bat and the fielding team the glove. */
function RoleBadge({ batting }: { batting: boolean }) {
  return (
    <span className="role-badge" aria-hidden="true">
      {batting ? <img className="role-bat" src={bat} alt="" /> : <img className="role-glove" src={glove} alt="" />}
    </span>
  );
}

function CountDots({ label, total, filled, kind }: { label: string; total: number; filled: number; kind: string }) {
  return (
    <span className="count-group">
      <span className="count-label">{label}</span>
      {Array.from({ length: total }, (_, index) => (
        <span key={index} className={index < filled ? `dot ${kind}` : 'dot'} />
      ))}
    </span>
  );
}

type Connection = Exclude<ConnectionStatus, 'not_found'>;

const CONNECTION_TEXT: Record<Exclude<Connection, 'live'>, string> = {
  connecting: 'Connecting',
  reconnecting: 'Reconnecting',
};

export type StatusPill = { text: string; kind: Connection | 'connected' | 'final' };

/** Live only once the game is under way, so a family who opens the page before the first pitch doesn't think they're missing it. */
export function statusPill(status: GameState['status'] | null, connection: Connection): StatusPill {
  if (status === 'final') return { text: 'Final', kind: 'final' };
  if (connection !== 'live') return { text: CONNECTION_TEXT[connection], kind: connection };
  return status === 'in_progress' ? { text: 'Live', kind: 'live' } : { text: 'Connected', kind: 'connected' };
}

function summary(state: GameState, teams: Roster['teams']): string {
  const score = `${teams.away.name} ${state.score.away}, ${teams.home.name} ${state.score.home}`;
  if (state.status !== 'in_progress') return `${score}. ${inningText(state)}.`;
  const runners = BASES.filter((base) => state.bases[base]).sort();
  return (
    `${score}. ${inningText(state)}, ${state.count.balls}–${state.count.strikes} count, ` +
    `${state.outs} out${state.outs === 1 ? '' : 's'}, ${runnersText(runners)}.`
  );
}

export function Scoreboard({ state, teams, connection }: {
  state: GameState;
  teams: Roster['teams'];
  connection: Connection;
}) {
  const pill = statusPill(state.status, connection);
  const playing = state.status === 'in_progress';
  const batting: TeamSide | null = playing ? (state.half === 'top' ? 'away' : 'home') : null;
  const team = (side: TeamSide) => (
    <div className={`side ${side}`}>
      <div className="side-name">
        {side === 'away' && batting && <RoleBadge batting={batting === 'away'} />}
        <span className="team-name">{teams[side].name}</span>
        <span className="team-short">{teams[side].short}</span>
        {side === 'home' && batting && <RoleBadge batting={batting === 'home'} />}
      </div>
      <span className="team-score">{state.score[side]}</span>
      <span className="side-label">{side === 'away' ? 'Away' : 'Home'}</span>
    </div>
  );
  return (
    <section className="scoreboard" aria-label="Score">
      <p className="sr-only" aria-live="polite">
        {summary(state, teams)}
      </p>
      <div className="scoreboard-main" aria-hidden="true">
        {team('away')}
        <div className="game-state">
          {playing && <MiniDiamond bases={state.bases} />}
          <span className="inning">{inningText(state)}</span>
        </div>
        {team('home')}
      </div>
      <div className="hairline" />
      <div className="scoreboard-footer">
        {playing ? (
          <span className="count" aria-hidden="true">
            <CountDots label="B" total={3} filled={state.count.balls} kind="ball" />
            <CountDots label="S" total={2} filled={state.count.strikes} kind="strike" />
            <CountDots label="O" total={2} filled={state.outs} kind="out" />
          </span>
        ) : (
          <span />
        )}
        <p className={`status-pill ${pill.kind}`} role="status">
          {pill.text}
        </p>
      </div>
    </section>
  );
}
