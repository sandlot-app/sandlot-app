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
  for (const step of [1, 2, 3, 4, 6]) {
    assert.match(css, new RegExp(`--space-${step}:\\s*\\d+px;`));
    assert.match(ts, new RegExp(`"space/${step}":\\s*\\d+`));
  }
  assert.doesNotMatch(css, /--space-5:/);
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

test('mobile lint resolves same-file const values used in style properties', () => {
  const source = "const raw = '#FF7519'; const pad = 8; StyleSheet.create({ card: { color: raw, padding: pad } });";
  const result = spawnSync(process.execPath, ['../../apps/mobile/scripts/lint-styles.mjs', '--stdin'], {
    cwd: root,
    input: source,
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /logo\/emblem/);
  assert.match(result.stdout, /space\/2/);
});

test('mobile lint resolves shorthand style objects and values', () => {
  const source = 'const padding = 8; const card = { padding }; StyleSheet.create({ card });';
  const result = spawnSync(process.execPath, ['../../apps/mobile/scripts/lint-styles.mjs', '--stdin'], {
    cwd: root,
    input: source,
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /padding/);
  assert.match(result.stdout, /space\/2/);
});

test('mobile lint resolves the const visible in each lexical scope', () => {
  const raw = 'function view() { const gap = 8; return StyleSheet.create({ card: { gap } }); } const gap = tokens.modes.Light.sizes["space/2"];';
  const rawResult = spawnSync(process.execPath, ['../../apps/mobile/scripts/lint-styles.mjs', '--stdin'], {
    cwd: root,
    input: raw,
    encoding: 'utf8',
  });
  assert.equal(rawResult.status, 1);
  assert.match(rawResult.stdout, /space\/2/);

  const token = 'function view() { const gap = tokens.modes.Light.sizes["space/2"]; return StyleSheet.create({ card: { gap } }); } const gap = 8;';
  const tokenResult = spawnSync(process.execPath, ['../../apps/mobile/scripts/lint-styles.mjs', '--stdin'], {
    cwd: root,
    input: token,
    encoding: 'utf8',
  });
  assert.equal(tokenResult.status, 0);
});

test('mobile lint checks only the property read from a non-style object', () => {
  const source = "const config = { gap: 8, radius: tokens.modes.Light.sizes['radius/sm'] }; StyleSheet.create({ card: { borderRadius: config.radius } });";
  const result = spawnSync(process.execPath, ['../../apps/mobile/scripts/lint-styles.mjs', '--stdin'], {
    cwd: root,
    input: source,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0);
});

test('mobile lint checks only the object selected by a JSX style expression', () => {
  const source = "const config = { meta: { gap: 8 }, card: { padding: tokens.modes.Light.sizes['space/2'] } }; <View style={config.card} />;";
  const result = spawnSync(process.execPath, ['../../apps/mobile/scripts/lint-styles.mjs', '--stdin'], {
    cwd: root,
    input: source,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0);
});

test('mobile lint uses the scoped JSX style binding instead of shadowed data', () => {
  const source = "const data = { gap: 8 }; function view() { const data = { padding: tokens.modes.Light.sizes['space/2'] }; return <View style={data} />; }";
  const result = spawnSync(process.execPath, ['../../apps/mobile/scripts/lint-styles.mjs', '--stdin'], {
    cwd: root,
    input: source,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0);
});

test('mobile lint resolves a destructured same-file const in shorthand style code', () => {
  const source = 'const { gap } = { gap: 8 }; StyleSheet.create({ card: { gap } });';
  const result = spawnSync(process.execPath, ['../../apps/mobile/scripts/lint-styles.mjs', '--stdin'], {
    cwd: root,
    input: source,
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /space\/2/);
});

test('mobile lint checks contentContainerStyle values', () => {
  const source = '<ScrollView contentContainerStyle={{ padding: 8 }} />;';
  const result = spawnSync(process.execPath, ['../../apps/mobile/scripts/lint-styles.mjs', '--stdin'], {
    cwd: root,
    input: source,
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /space\/2/);
});

test('mobile lint rejects arithmetic and positional raw spacing', () => {
  const source = 'StyleSheet.create({ card: { padding: 4 + 4, top: 8 } });';
  const result = spawnSync(process.execPath, ['../../apps/mobile/scripts/lint-styles.mjs', '--stdin'], {
    cwd: root,
    input: source,
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /padding.*space\/2/);
  assert.match(result.stdout, /top.*space\/2/);
});

test('mobile lint honors shadowing from arrow and destructured parameters', () => {
  const source = 'const gap = 8; const Arrow = (gap) => <View style={{ gap }} />; function Component({ gap }) { return <View style={{ gap }} />; }';
  const result = spawnSync(process.execPath, ['../../apps/mobile/scripts/lint-styles.mjs', '--stdin'], {
    cwd: root,
    input: source,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0);
});

test('mobile lint rejects a raw color selected by a conditional', () => {
  const source = "StyleSheet.create({ card: { color: active ? '#FF7519' : tokens.modes.Light.colors['action/primary'] } });";
  const result = spawnSync(process.execPath, ['../../apps/mobile/scripts/lint-styles.mjs', '--stdin'], {
    cwd: root,
    input: source,
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /logo\/emblem/);
});

test('mobile lint rejects a raw spacing parameter default', () => {
  const source = 'function Card({ gap = 8 }) { return <View style={{ gap }} />; }';
  const result = spawnSync(process.execPath, ['../../apps/mobile/scripts/lint-styles.mjs', '--stdin'], {
    cwd: root,
    input: source,
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /space\/2/);
});

test('mobile lint does not resolve past mutable bindings that shadow a const', () => {
  for (const kind of ['let', 'var']) {
    const source = `const gap = 8; function view() { ${kind} gap = tokens.modes.Light.sizes['space/2']; return StyleSheet.create({ card: { gap } }); }`;
    const result = spawnSync(process.execPath, ['../../apps/mobile/scripts/lint-styles.mjs', '--stdin'], {
      cwd: root,
      input: source,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stdout);
  }
});
