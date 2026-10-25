import type { Base, GameState } from '@sandlot/engine';

const BASES: { base: Base; x: number; y: number; name: string }[] = [
  { base: 1, x: 150, y: 100, name: '1st' },
  { base: 2, x: 100, y: 50, name: '2nd' },
  { base: 3, x: 50, y: 100, name: '3rd' },
];

export function Diamond({ bases }: { bases: GameState['bases'] }) {
  const occupied = BASES.filter(({ base }) => bases[base]);
  const label = occupied.length === 0 ? 'Bases empty' : `Runners on ${occupied.map(({ name }) => name).join(', ')}`;
  return (
    <svg className="diamond" viewBox="0 0 200 170" role="img" aria-label={label}>
      <polygon className="infield" points="100,150 150,100 100,50 50,100" />
      {BASES.map(({ base, x, y }) => (
        <rect
          key={base}
          className={bases[base] ? 'base occupied' : 'base'}
          x={x - 15}
          y={y - 15}
          width="30"
          height="30"
          transform={`rotate(45 ${x} ${y})`}
        />
      ))}
      <polygon className="plate" points="100,140 110,148 106,158 94,158 90,148" />
    </svg>
  );
}
