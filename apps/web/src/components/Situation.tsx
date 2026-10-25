import type { GameState } from '@sandlot/engine';
import { Diamond } from './Diamond.tsx';

const OUT_LAMPS = [0, 1, 2] as const;

export function Situation({ state }: { state: GameState }) {
  return (
    <section className="situation" aria-label="Situation">
      <Diamond bases={state.bases} />
      <dl className="count">
        <div>
          <dt>Balls</dt>
          <dd>{state.count.balls}</dd>
        </div>
        <div>
          <dt>Strikes</dt>
          <dd>{state.count.strikes}</dd>
        </div>
        <div>
          <dt>Outs</dt>
          <dd aria-label={`${state.outs} out`}>
            {OUT_LAMPS.map((lamp) => (
              <span key={lamp} className={lamp < state.outs ? 'lamp out' : 'lamp'} />
            ))}
          </dd>
        </div>
      </dl>
    </section>
  );
}
