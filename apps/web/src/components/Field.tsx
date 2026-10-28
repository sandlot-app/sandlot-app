import type { Base, GameState, Position } from '@sandlot/engine';
import type { CSSProperties } from 'react';
import bat from '../assets/bat.svg';
import surface from '../assets/field-surface.svg';
import type { Roster } from '../roster.ts';
import { runnersText } from './Scoreboard.tsx';

// Figma Field (21:264) is 361 × 390. Each spot is a chip disc's center x and the chip's top y, as in
// apps/mobile/src/components/field-room.ts.
const FIELD = { width: 361, height: 390 };
const FIELDER_SPOTS: Partial<Record<Position, { x: number; y: number }>> = {
  CF: { x: 181, y: 31 },
  LF: { x: 68, y: 71 },
  RF: { x: 293.5, y: 71 },
  SS: { x: 131, y: 137 },
  '2B': { x: 230, y: 137 },
  '3B': { x: 56.5, y: 155 },
  '1B': { x: 302, y: 155 },
  P: { x: 180.5, y: 205 },
  C: { x: 181, y: 329 },
};
const RUNNER_SPOTS: Record<Base, { x: number; y: number }> = { 1: { x: 259, y: 201 }, 2: { x: 181, y: 123 }, 3: { x: 103, y: 201 } };
const BATTER_SPOT = { x: 141, y: 268 };

const at = ({ x, y }: { x: number; y: number }): CSSProperties => ({
  left: `${(x / FIELD.width) * 100}%`,
  top: `${(y / FIELD.height) * 100}%`,
});

function Chip({ spot, number, label, role }: { spot: { x: number; y: number }; number: string; label: string; role: 'fielding' | 'batting' | 'batter' }) {
  return (
    <span className={`chip ${role}`} style={at(spot)}>
      <span className="chip-disc">
        {number}
        {role === 'batter' && <img className="chip-bat" src={bat} alt="" />}
      </span>
      <span className="chip-label">{label}</span>
    </span>
  );
}

/** The fielding team at their positions, and the batter and runners, by jersey number. */
export function Field({ state, roster }: { state: GameState; roster: Roster }) {
  const jersey = roster.number;
  const batting = state.half === 'top' ? 'away' : 'home';
  const fielding = state.half === 'top' ? 'home' : 'away';
  const playing = state.status === 'in_progress';
  const batter = playing ? state.lineups[batting][state.nextBatter[batting]]?.player : undefined;
  const runners = ([1, 2, 3] as const).filter((base) => state.bases[base]);
  const description = playing
    ? `${batter && roster.numbered ? `Number ${jersey(batter.id)} batting, ` : ''}${runnersText(runners)}.`
    : 'No one on the field.';
  return (
    <section className="field" aria-label="Field">
      <p className="sr-only">{description}</p>
      <img className="field-surface" src={surface} alt="" />
      {playing && (
        <div aria-hidden="true">
          {state.lineups[fielding].map(({ player, position }) => {
            const spot = position ? FIELDER_SPOTS[position] : undefined;
            return spot && <Chip key={player.id} spot={spot} number={jersey(player.id)} label={position ?? ''} role="fielding" />;
          })}
          {runners.map((base) => (
            <Chip key={base} spot={RUNNER_SPOTS[base]} number={jersey(state.bases[base]!.player.id)} label="Runner" role="batting" />
          ))}
          {batter && <Chip spot={BATTER_SPOT} number={jersey(batter.id)} label="Batter" role="batter" />}
        </div>
      )}
    </section>
  );
}
