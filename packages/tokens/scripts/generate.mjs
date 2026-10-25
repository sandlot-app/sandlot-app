import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const source = JSON.parse(readFileSync(new URL('../figma-variables.json', import.meta.url), 'utf8'));
const byKey = new Map();
for (const collection of source.collections) {
  for (const variable of collection.variables) {
    const key = `${collection.name}/${variable.name}`;
    if (byKey.has(key)) throw new Error(`Duplicate Figma variable: ${key}`);
    byKey.set(key, { collection, variable });
  }
}

function resolve(key, seen = new Set()) {
  if (seen.has(key)) throw new Error(`Circular Figma alias: ${[...seen, key].join(' -> ')}`);
  const entry = byKey.get(key);
  if (!entry) throw new Error(`Missing Figma variable: ${key}`);
  const mode = entry.collection.name === 'Color' ? 'Light' : 'Value';
  const value = entry.variable.values[mode];
  if (value === undefined) throw new Error(`Missing ${mode} value: ${key}`);
  if (value && typeof value === 'object' && 'alias' in value) {
    return resolve(value.alias, new Set([...seen, key]));
  }
  return value;
}

function entries(collectionName) {
  const collection = source.collections.find((item) => item.name === collectionName);
  if (!collection) throw new Error(`Missing Figma collection: ${collectionName}`);
  return Object.fromEntries(collection.variables
    .map(({ name }) => [name, resolve(`${collectionName}/${name}`)])
    .sort(([a], [b]) => a.localeCompare(b)));
}

const colors = entries('Color');
const sizes = entries('Size');
for (const [name, color] of Object.entries(colors)) {
  if (typeof color !== 'string' || !/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(color)) {
    throw new Error(`Invalid color: ${name}`);
  }
}
for (const [name, value] of Object.entries(sizes)) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Invalid size: ${name}`);
}

const textStyles = Object.fromEntries(source.textStyles.map((style) => {
  const { name, fontSize, fontWeight, lineHeight, letterSpacing } = style;
  const percent = /^(-?\d+(?:\.\d+)?)%$/.exec(letterSpacing);
  if (!percent || ![fontSize, fontWeight, lineHeight].every(Number.isFinite)) {
    throw new Error(`Invalid text style: ${name}`);
  }
  return [name, { fontSize, fontWeight, lineHeight, letterSpacing: fontSize * Number(percent[1]) / 100 }];
}).sort(([a], [b]) => a.localeCompare(b)));

const tokens = { modes: { Light: { colors, sizes, textStyles } } };
const ts = `// DO NOT EDIT. Generated from figma-variables.json.\nexport const tokens = ${JSON.stringify(tokens, null, 2)} as const;\n`;
const js = `// DO NOT EDIT. Generated from figma-variables.json.\nexport const tokens = ${JSON.stringify(tokens, null, 2)};\n`;
const cssName = (name) => name.replaceAll('/', '-').replaceAll(' ', '-').toLowerCase();
const declarations = [
  ...Object.entries(colors).map(([name, value]) => `  --color-${cssName(name)}: ${value};`),
  ...Object.entries(sizes).map(([name, value]) => `  --${cssName(name)}: ${value}px;`),
  ...Object.entries(textStyles).flatMap(([name, style]) => [
    `  --text-${cssName(name)}-size: ${style.fontSize}px;`,
    `  --text-${cssName(name)}-weight: ${style.fontWeight};`,
    `  --text-${cssName(name)}-line-height: ${style.lineHeight}px;`,
    `  --text-${cssName(name)}-letter-spacing: ${style.letterSpacing}px;`,
  ]),
];
const css = `/* DO NOT EDIT. Generated from figma-variables.json. */\n:root, :root[data-theme="Light"] {\n${declarations.join('\n')}\n}\n`;

if (!process.argv.includes('--check')) mkdirSync(new URL('../generated/', import.meta.url), { recursive: true });
for (const [name, content] of [['tokens.ts', ts], ['tokens.css', css], ['tokens.mjs', js]]) {
  const output = new URL(`../generated/${name}`, import.meta.url);
  if (process.argv.includes('--check')) {
    let actual;
    try { actual = readFileSync(output, 'utf8'); } catch { actual = undefined; }
    if (actual !== content) {
      console.error(`${name} differs from figma-variables.json. Run pnpm --filter @sandlot/tokens generate.`);
      process.exitCode = 1;
    }
  } else {
    writeFileSync(output, content);
  }
}
