import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const root = new URL('..', import.meta.url);
const inputs = ['figma-variables.json', 'scripts/generate.mjs', 'generated/tokens.ts', 'generated/tokens.css'];

function withCopy(run) {
  const directory = mkdtempSync(join(tmpdir(), 'sandlot-tokens-'));
  try {
    for (const path of inputs) cpSync(new URL(`../${path}`, import.meta.url), join(directory, path));
    run(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('committed outputs resolve Light aliases and only the exported spacing steps', () => {
  execFileSync(process.execPath, ['scripts/generate.mjs', '--check'], { cwd: root });
  const css = readFileSync(new URL('../generated/tokens.css', import.meta.url), 'utf8');
  const ts = readFileSync(new URL('../generated/tokens.ts', import.meta.url), 'utf8');
  assert.match(css, /--color-action-primary:\s*#FF7519;/);
  assert.match(css, /--radius-sm:\s*6px;/);
  assert.match(ts, /"Light"/);
  assert.match(ts, /"Body\/Regular"/);
  assert.doesNotMatch(ts, /figmaFamily|fontFamily/);
  for (const step of [1, 2, 3, 4, 6]) {
    assert.match(css, new RegExp(`--space-${step}:\\s*\\d+px;`));
    assert.match(ts, new RegExp(`"space/${step}":\\s*\\d+`));
  }
  assert.doesNotMatch(css, /--space-5:/);
});

test('committed outputs carry the Field Day direction colors', () => {
  const css = readFileSync(new URL('../generated/tokens.css', import.meta.url), 'utf8');
  const expected = {
    'action-primary': '#FF7519',
    'count-ball': '#2FB862',
    'count-strike': '#F2AC16',
    'count-out': '#E5484D',
    'field-grass': '#56A04B',
    'field-dirt': '#C8915F',
    'field-fence-cap': '#F4C430',
    'surface-page': '#F4F1E8',
    'chip-opponent-bg': '#25447E',
    'chip-opponent-text': '#FFFFFF',
    'text-on-action': '#14201B',
    'text-link': '#A84706',
  };
  for (const [name, hex] of Object.entries(expected)) assert.match(css, new RegExp(`--color-${name}:\\s*${hex};`));
});

test('generated TypeScript exports distinct color, spacing and radius token types', () => {
  const ts = readFileSync(new URL('../generated/tokens.ts', import.meta.url), 'utf8');
  for (const type of ['ColorToken', 'SpacingToken', 'RadiusToken']) assert.match(ts, new RegExp(`export type ${type} =`));
});

test('check fails on content drift', () => withCopy((directory) => {
  appendFileSync(join(directory, 'generated/tokens.css'), '\n:root { --wrong: 1px; }\n');
  const result = spawnSync(process.execPath, ['scripts/generate.mjs', '--check'], { cwd: directory, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /tokens.css differs/);
}));

test('check accepts Windows line endings in otherwise identical generated files', () => withCopy((directory) => {
  for (const name of ['tokens.ts', 'tokens.css']) {
    const path = join(directory, 'generated', name);
    writeFileSync(path, readFileSync(path, 'utf8').replaceAll(/\r?\n/g, '\r\n'));
  }
  const result = spawnSync(process.execPath, ['scripts/generate.mjs', '--check'], { cwd: directory, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}));

test('Light output stays Light if the export gains a Dark default', () => withCopy((directory) => {
  const path = join(directory, 'figma-variables.json');
  const source = JSON.parse(readFileSync(path, 'utf8'));
  const color = source.collections.find((collection) => collection.name === 'Color');
  color.defaultMode = 'Dark';
  color.modes.push('Dark');
  color.variables.find((variable) => variable.name === 'action/primary').values.Dark = { alias: 'Primitives/blue/50' };
  writeFileSync(path, JSON.stringify(source));
  execFileSync(process.execPath, ['scripts/generate.mjs'], { cwd: directory });
  const css = readFileSync(join(directory, 'generated/tokens.css'), 'utf8');
  assert.match(css, /--color-action-primary:\s*#FF7519;/);
}));
