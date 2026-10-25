import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = join(root, '__style_contract__.tsx');
const isFixture = (path) => path.replaceAll('\\', '/').toLowerCase() === fixture.replaceAll('\\', '/').toLowerCase();
const config = ts.readConfigFile(join(root, 'tsconfig.json'), ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
const options = ts.parseJsonConfigFileContent(config.config, ts.sys, root).options;
const imports = "import { createStyles } from './style'; import { tokens, type ColorToken, type RadiusToken, type SpacingToken } from '@sandlot/tokens';\n";

function diagnostics(source) {
  const host = ts.createCompilerHost(options);
  const readFile = host.readFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  host.readFile = (path) => isFixture(path) ? imports + source : readFile(path);
  host.fileExists = (path) => isFixture(path) || fileExists(path);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (path, languageVersion, onError, shouldCreateNewSourceFile) => isFixture(path)
    ? ts.createSourceFile(path, imports + source, languageVersion, true, ts.ScriptKind.TSX)
    : getSourceFile(path, languageVersion, onError, shouldCreateNewSourceFile);
  const program = ts.createProgram([fixture], options, host);
  return ts.getPreEmitDiagnostics(program).map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n'));
}

test('createStyles accepts color, spacing and radius tokens and zero', () => {
  const errors = diagnostics(`createStyles({ card: {
    color: tokens.modes.Light.colors['action/primary'],
    backgroundColor: tokens.modes.Light.colors['logo/background'],
    borderColor: tokens.modes.Light.colors['border/subtle'],
    padding: tokens.modes.Light.sizes['space/2'],
    paddingHorizontal: tokens.modes.Light.sizes['space/3'],
    marginTop: tokens.modes.Light.sizes['space/1'],
    gap: 0,
    borderRadius: tokens.modes.Light.sizes['radius/sm'],
    borderTopLeftRadius: 0,
    flex: 1,
  } });`);
  assert.deepEqual(errors, []);
});

for (const [name, style] of [
  ['raw color', "color: '#FF7519'"],
  ['raw border color', "borderColor: '#FF7519'"],
  ['raw spacing', 'padding: 8'],
  ['raw gap', 'gap: 8'],
  ['raw radius', 'borderRadius: 6'],
  ['raw corner radius', 'borderTopLeftRadius: 6'],
  ['spacing in radius', "borderRadius: tokens.modes.Light.sizes['space/2']"],
  ['radius in spacing', "padding: tokens.modes.Light.sizes['radius/sm']"],
  ['color in spacing', "padding: tokens.modes.Light.colors['action/primary']"],
]) {
  test(`createStyles rejects ${name}`, () => {
    const errors = diagnostics(`createStyles({ card: { flex: 1, ${style} } });`);
    assert.ok(errors.some((message) => /not assignable|no overload|incompatible/i.test(message)), errors.join('\n'));
  });
}

test('token types reject plain values and tokens from the wrong category', () => {
  for (const source of [
    'const value: ColorToken = "#FF7519";',
    'const value: SpacingToken = 8;',
    'const value: RadiusToken = 6;',
    "const value: RadiusToken = tokens.modes.Light.sizes['space/2'];",
  ]) {
    const errors = diagnostics(source);
    assert.ok(errors.some((message) => /not assignable/i.test(message)), errors.join('\n'));
  }
});

test('const and shorthand raw values do not bypass createStyles', () => {
  for (const source of [
    'const raw = 8; createStyles({ card: { padding: raw } });',
    'const padding = 8; const card = { padding }; createStyles({ card });',
    "const raw = '#FF7519'; createStyles({ card: { color: raw } });",
  ]) {
    const errors = diagnostics(source);
    assert.ok(errors.some((message) => /not assignable/i.test(message)), errors.join('\n'));
  }
});
