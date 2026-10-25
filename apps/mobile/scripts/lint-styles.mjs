import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { tokens as generated } from '../../../packages/tokens/generated/tokens.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tokens = generated.modes.Light;

function suggest(group, value, type) {
  const key = Object.keys(group).find((name) => group[name] === value);
  return key ? `Use tokens.modes.Light.${type}["${key}"].` : 'There is no exact token. Choose a token from the Figma export.';
}

function check(source, name) {
  const file = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const errors = [];
  const styleNames = new Set();
  const objects = new Map();
  const scanned = new Set();
  const unwrapped = (node) => {
    while (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) node = node.expression;
    return node;
  };
  const visitStyle = (node) => {
    if (scanned.has(node)) return;
    scanned.add(node);
    if (ts.isSpreadAssignment(node) && ts.isIdentifier(node.expression) && objects.has(node.expression.text)) {
      visitStyle(objects.get(node.expression.text));
    }
    if (ts.isPropertyAssignment(node)) {
      const property = node.name.getText(file).replaceAll(/['"]/g, '');
      const value = unwrapped(node.initializer);
      const line = file.getLineAndCharacterOfPosition(value.getStart(file)).line + 1;
      if ((ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) && (/(?:^color$|Color$)/i.test(property) || /^#/.test(value.text))) {
        errors.push(`${name}:${line}: raw color in ${property}: ${value.text}. ${suggest(tokens.colors, value.text.toUpperCase(), 'colors')}`);
      }
      const group = /^(?:margin|padding|gap|rowGap|columnGap)(?:Top|Right|Bottom|Left|Horizontal|Vertical|Start|End)?$/.test(property)
        ? 'space'
        : /^(?:borderRadius|borderTopLeftRadius|borderTopRightRadius|borderBottomLeftRadius|borderBottomRightRadius)$/.test(property)
          ? 'radius' : null;
      const numeric = ts.isNumericLiteral(value) ? Number(value.text)
        : ts.isPrefixUnaryExpression(value) && [ts.SyntaxKind.MinusToken, ts.SyntaxKind.PlusToken].includes(value.operator) && ts.isNumericLiteral(unwrapped(value.operand))
          ? (value.operator === ts.SyntaxKind.MinusToken ? -1 : 1) * Number(unwrapped(value.operand).text) : null;
      if (group && numeric !== null) {
        const candidates = Object.fromEntries(Object.entries(tokens.sizes).filter(([key]) => key.startsWith(`${group}/`)));
        const guidance = suggest(candidates, Math.abs(numeric), 'sizes');
        errors.push(`${name}:${line}: raw ${group} value in ${property}: ${numeric}. ${numeric < 0 && guidance.startsWith('Use ') ? guidance.replace('Use ', 'Use -') : guidance}`);
      }
    }
    ts.forEachChild(node, visitStyle);
  };
  const collectObjects = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isObjectLiteralExpression(unwrapped(node.initializer))) {
      objects.set(node.name.text, unwrapped(node.initializer));
    }
    ts.forEachChild(node, collectObjects);
  };
  collectObjects(file);
  const collect = (node) => {
    if (ts.isJsxAttribute(node) && node.name.text === 'style' && node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
      const expression = unwrapped(node.initializer.expression);
      if (ts.isObjectLiteralExpression(expression) || ts.isArrayLiteralExpression(expression)) visitStyle(expression);
      const findNames = (part) => {
        if (ts.isIdentifier(part)) styleNames.add(part.text);
        else if (ts.isPropertyAccessExpression(part)) findNames(part.expression);
        else ts.forEachChild(part, findNames);
      };
      findNames(expression);
    }
    if (ts.isCallExpression(node) && node.expression.getText(file) === 'StyleSheet.create' && node.arguments[0]) {
      const argument = unwrapped(node.arguments[0]);
      visitStyle(ts.isIdentifier(argument) && objects.has(argument.text) ? objects.get(argument.text) : argument);
    }
    ts.forEachChild(node, collect);
  };
  collect(file);
  const scanNamedStyles = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && (styleNames.has(node.name.text) || /styles?$/i.test(node.name.text)) && node.initializer && ts.isObjectLiteralExpression(unwrapped(node.initializer))) {
      visitStyle(node.initializer);
    }
    ts.forEachChild(node, scanNamedStyles);
  };
  scanNamedStyles(file);
  return errors;
}

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return ['node_modules', 'dist'].includes(entry.name) ? [] : files(path);
    return /\.(tsx?|jsx?)$/.test(entry.name) ? [path] : [];
  });
}

const errors = process.argv.includes('--stdin')
  ? check(readFileSync(0, 'utf8'), 'stdin.tsx')
  : files(root).flatMap((path) => check(readFileSync(path, 'utf8'), path));
if (errors.length) {
  console.log(errors.join('\n'));
  process.exitCode = 1;
}
