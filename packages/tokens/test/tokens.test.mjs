import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const root = new URL('..', import.meta.url);

test('the committed outputs resolve the Light aliases and keep a mode key', () => {
  execFileSync(process.execPath, ['scripts/generate.mjs', '--check'], { cwd: root });
  const css = readFileSync(new URL('../generated/tokens.css', import.meta.url), 'utf8');
  const ts = readFileSync(new URL('../generated/tokens.ts', import.meta.url), 'utf8');

  assert.match(css, /--color-action-primary:\s*#1D5FD6;/);
  assert.match(css, /--space-2:\s*8px;/);
  assert.match(css, /--radius-sm:\s*6px;/);
  assert.match(ts, /"Light"/);
  assert.match(ts, /"Body\/Regular"/);
  assert.doesNotMatch(ts, /figmaFamily|fontFamily/);
  assert.doesNotMatch(ts, /"space\/5"/);
});

test('the check fails when a generated file drifts from the export', () => {
  const directory = mkdtempSync(join(tmpdir(), 'sandlot-tokens-'));
  try {
    for (const path of ['figma-variables.json', 'scripts/generate.mjs', 'generated/tokens.ts', 'generated/tokens.css', 'generated/tokens.mjs']) {
      cpSync(new URL(`../${path}`, import.meta.url), join(directory, path), { recursive: true });
    }
    appendFileSync(join(directory, 'generated/tokens.css'), '\n:root { --wrong: 1px; }\n');
    const result = spawnSync(process.execPath, ['scripts/generate.mjs', '--check'], { cwd: directory, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /tokens.css differs/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('the Light output remains Light if the export gains a Dark default', () => {
  const directory = mkdtempSync(join(tmpdir(), 'sandlot-tokens-'));
  try {
    for (const path of ['figma-variables.json', 'scripts/generate.mjs']) {
      cpSync(new URL(`../${path}`, import.meta.url), join(directory, path), { recursive: true });
    }
    const path = join(directory, 'figma-variables.json');
    const source = JSON.parse(readFileSync(path, 'utf8'));
    const color = source.collections.find((collection) => collection.name === 'Color');
    color.defaultMode = 'Dark';
    color.modes.push('Dark');
    color.variables.find((variable) => variable.name === 'action/primary').values.Dark = { alias: 'Primitives/blue/50' };
    writeFileSync(path, JSON.stringify(source));
    execFileSync(process.execPath, ['scripts/generate.mjs'], { cwd: directory });
    const css = readFileSync(join(directory, 'generated/tokens.css'), 'utf8');
    assert.match(css, /--color-action-primary:\s*#1D5FD6;/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('mobile lint rejects a raw color and a raw spacing value with token guidance', () => {
  const source = "import { StyleSheet } from 'react-native'; StyleSheet.create({ bad: { gap: 8, color: '#1D5FD6' } });";
  const result = spawnSync(process.execPath, ['../../apps/mobile/scripts/lint-styles.mjs', '--stdin'], {
    cwd: root,
    input: source,
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /space\/2/);
  assert.match(result.stdout, /action\/primary/);
});

test('mobile lint catches assigned styles, negative spacing and other literal colors', () => {
  const source = "const styles = { card: { marginTop: -4, backgroundColor: 'rgb(29, 95, 214)' } }; <View style={styles.card} />;";
  const result = spawnSync(process.execPath, ['../../apps/mobile/scripts/lint-styles.mjs', '--stdin'], {
    cwd: root,
    input: source,
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /marginTop/);
  assert.match(result.stdout, /backgroundColor/);
});

test('mobile lint does not name an unrelated replacement', () => {
  const source = "const styles = { card: { gap: 7, color: '#123456' } }; <View style={styles.card} />;";
  const result = spawnSync(process.execPath, ['../../apps/mobile/scripts/lint-styles.mjs', '--stdin'], {
    cwd: root,
    input: source,
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /no exact token/);
  assert.doesNotMatch(result.stdout, /action\/primary|space\/1/);
});

test('mobile lint catches parenthesized values and static template colors in styles', () => {
  const source = 'const styles = { card: { padding: (8), color: `#FF7519` } }; <View style={styles.card} />;';
  const result = spawnSync(process.execPath, ['../../apps/mobile/scripts/lint-styles.mjs', '--stdin'], {
    cwd: root,
    input: source,
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /space\/2/);
  assert.match(result.stdout, /logo\/emblem/);
});

test('mobile lint leaves ordinary data objects alone', () => {
  const source = "const preference = { color: 'red', gap: 8 };";
  const result = spawnSync(process.execPath, ['../../apps/mobile/scripts/lint-styles.mjs', '--stdin'], {
    cwd: root,
    input: source,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0);
});

test('mobile lint follows a style spread and rejects unary plus spacing', () => {
  const source = "const shared = { gap: 8 }; StyleSheet.create({ card: { ...shared, padding: +8 } });";
  const result = spawnSync(process.execPath, ['../../apps/mobile/scripts/lint-styles.mjs', '--stdin'], {
    cwd: root,
    input: source,
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /gap/);
  assert.match(result.stdout, /padding/);
});
