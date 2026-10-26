import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
function lint(source, filename = 'example.tsx') {
  return spawnSync(process.execPath, ['scripts/lint-styles.mjs', '--stdin', '--filename', filename], {
    cwd: root, input: source, encoding: 'utf8',
  });
}

test('direct StyleSheet imports and calls name createStyles', () => {
  for (const source of [
    "import { StyleSheet } from 'react-native';",
    'StyleSheet.create({ card: {} });',
  ]) {
    const result = lint(source);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stdout, /createStyles/);
  }
  assert.equal(lint("import { StyleSheet } from 'react-native'; StyleSheet.create({ card: {} });", 'style.ts').status, 0);
});

test('inline object literals in style props name createStyles', () => {
  const result = lint('<View style={{ padding: 8 }} />;');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /createStyles/);
  assert.equal(lint('<View style={styles.card} />;').status, 0);
  assert.equal(lint('<View style={{ padding: 8 }} />;', 'apps/mobile/style.ts').status, 1);
});

test('casts to token types outside the token package name the token source', () => {
  for (const type of ['ColorToken', 'SpacingToken', 'RadiusToken']) {
    const result = lint(`const token = value as ${type};`);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /@sandlot\/tokens/);
    assert.equal(lint(`const token = value as ${type};`, '../../packages/tokens/generated/tokens.ts').status, 0);
  }
});

test('casts through imported and local token type aliases are rejected', () => {
  for (const source of [
    "import type { SpacingToken as Space } from '@sandlot/tokens'; const bad = 8 as Space;",
    "import type { SpacingToken } from '@sandlot/tokens'; type Space = SpacingToken; const bad = 8 as Space;",
    "import type { SpacingToken } from '@sandlot/tokens'; type Space = SpacingToken; type Other = Space; const bad = 8 as Other;",
  ]) {
    const result = lint(source);
    assert.equal(result.status, 1, source);
    assert.match(result.stdout, /@sandlot\/tokens/);
  }
});

test('objects passed to a function used in a style prop are not inline styles', () => {
  assert.equal(lint("<View style={selectStyle({ theme: 'Light' })} />;").status, 0);
  assert.equal(lint('<View style={[styles.card, { padding: 0 }]} />;').status, 1);
  assert.equal(lint('<View style={active ? { padding: 0 } : styles.card} />;').status, 1);
});

test('ordinary values and token use are lint-clean', () => {
  const source = "const raw = 8; const c = '#FF7519'; const card = createStyles({ card: { padding: tokens.modes.Light.sizes['space/2'] } }); <View style={card.card} />;";
  assert.equal(lint(source).status, 0);
});
