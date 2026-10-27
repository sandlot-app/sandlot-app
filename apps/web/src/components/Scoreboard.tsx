import type { GameState, TeamSide } from '@sandlot/engine';

const TEAMS: { side: TeamSide; name: string }[] = [
  { side: 'away', name: 'Away' },
  { side: 'home', name: 'Home' },
];

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

export function Scoreboard({ state }: { state: GameState }) {
  const batting = state.status === 'in_progress' ? (state.half === 'top' ? 'away' : 'home') : null;
  return (
    <section className="scoreboard" aria-label="Score">
      <p className="inning">{inningText(state)}</p>
      <div className="teams">
        {TEAMS.map(({ side, name }) => (
          <div key={side} className={side === batting ? 'team batting' : 'team'}>
            <span className="team-name">{name}</span>
            <span className="team-score">{state.score[side]}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
