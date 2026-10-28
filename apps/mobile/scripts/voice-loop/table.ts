import type { Verdict } from './classify.ts';

// The results table for the noise research note (docs/research/voice-noise-and-capture.md). It holds counts and times
// only, never a transcript.

/** `failed`: the live stream gave no final transcript at all (the phone would fall back to the clip). */
export type Outcome = Verdict | 'failed';

export type Run = {
  setting: string;
  noise: 'clean' | 'noisy';
  /** Audio dropped from the start of the clip, the way a late mic loses the first word. */
  cutMs: number;
  outcome: Outcome;
  /** Milliseconds from the release to the final transcript, or null when there was none. */
  finalMs: number | null;
};

export type GroupBy = 'setting' | 'noise' | 'cut';

const columns: Record<GroupBy, { title: string; align: '---' | '---:'; of(run: Run): string }> = {
  setting: { title: 'setting', align: '---', of: (run) => run.setting },
  noise: { title: 'crowd noise', align: '---', of: (run) => run.noise === 'noisy' ? 'crowd' : 'clean' },
  cut: { title: 'first cut (ms)', align: '---:', of: (run) => String(run.cutMs) },
};

const outcomes: Outcome[] = ['right', 'name-dropped', 'wrong', 'blank', 'failed'];

function median(times: number[]): number {
  const sorted = [...times].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle]! : Math.round((sorted[middle - 1]! + sorted[middle]!) / 2);
}

/** One markdown table: a row per group of runs, in the order the groups first appeared. */
export function buildTable(runs: Run[], by: GroupBy[]): string {
  const groups = new Map<string, Run[]>();
  for (const run of runs) {
    const key = JSON.stringify(by.map((column) => columns[column].of(run)));
    groups.set(key, [...(groups.get(key) ?? []), run]);
  }
  const header = [...by.map((column) => columns[column].title), 'runs', ...outcomes, 'median final (ms)', 'slowest final (ms)'];
  const align = [...by.map((column) => columns[column].align), ...Array(header.length - by.length).fill('---:')];
  const rows = [...groups.entries()].map(([key, group]) => {
    const times = group.flatMap((run) => run.finalMs === null ? [] : [run.finalMs]);
    return [
      ...(JSON.parse(key) as string[]),
      group.length,
      ...outcomes.map((outcome) => group.filter((run) => run.outcome === outcome).length),
      times.length ? median(times) : '-',
      times.length ? Math.max(...times) : '-',
    ];
  });
  const line = (cells: (string | number)[]) => `| ${cells.join(' | ')} |`;
  return [line(header), `|${align.join('|')}|`, ...rows.map(line)].join('\n');
}
