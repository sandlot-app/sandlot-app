import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const mobile = join(repo, 'apps', 'mobile');
const helper = join(mobile, 'style.ts');
const tokenNames = new Set(['ColorToken', 'SpacingToken', 'RadiusToken']);

function tokenType(type, names) {
  if (ts.isTypeReferenceNode(type) && names.has(type.typeName.getText().split('.').at(-1))) return true;
  return Boolean(ts.forEachChild(type, (child) => tokenType(child, names)));
}

function inlineStyle(expression) {
  if (ts.isObjectLiteralExpression(expression)) return true;
  if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression)) {
    return inlineStyle(expression.expression);
  }
  if (ts.isArrayLiteralExpression(expression)) return expression.elements.some(inlineStyle);
  if (ts.isConditionalExpression(expression)) return inlineStyle(expression.whenTrue) || inlineStyle(expression.whenFalse);
  if (ts.isBinaryExpression(expression) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(expression.operatorToken.kind)) {
    return inlineStyle(expression.left) || inlineStyle(expression.right);
  }
  return false;
}

function check(source, name) {
  const file = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const errors = [];
  const normalized = name.replaceAll('\\', '/');
  const inTokens = normalized.includes('/packages/tokens/') || normalized.startsWith('packages/tokens/');
  const inMobile = normalized.includes('/apps/mobile/') || normalized.startsWith('apps/mobile/') || name === 'example.tsx' || name === 'stdin.tsx';
  const isHelper = resolve(name) === helper || normalized.endsWith('/apps/mobile/style.ts') || name === 'style.ts';
  const names = new Set(tokenNames);
  const aliases = [];
  function collectTypes(node) {
    if (ts.isImportDeclaration(node) && node.moduleSpecifier.text === '@sandlot/tokens' && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
      for (const item of node.importClause.namedBindings.elements) {
        if (tokenNames.has((item.propertyName ?? item.name).text)) names.add(item.name.text);
      }
    }
    if (ts.isTypeAliasDeclaration(node)) aliases.push(node);
    ts.forEachChild(node, collectTypes);
  }
  collectTypes(file);
  for (let changed = true; changed;) {
    changed = false;
    for (const alias of aliases) {
      if (!names.has(alias.name.text) && tokenType(alias.type, names)) {
        names.add(alias.name.text);
        changed = true;
      }
    }
  }
  function report(node, message) {
    const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
    errors.push(`${name}:${line}: ${message}`);
  }
  function visit(node) {
    if (!inTokens && (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) && tokenType(node.type, names)) {
      report(node, 'Use a value from @sandlot/tokens instead of casting to a token type.');
    }
    if (inMobile && !isHelper) {
      if (ts.isImportDeclaration(node) && node.moduleSpecifier.text === 'react-native' && node.importClause?.namedBindings) {
        const bindings = node.importClause.namedBindings;
        if (ts.isNamedImports(bindings) && bindings.elements.some((item) => (item.propertyName ?? item.name).text === 'StyleSheet')) {
          report(node, 'Use createStyles from the mobile style helper instead of importing StyleSheet.');
        }
      }
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'create' &&
        (node.expression.expression.getText(file) === 'StyleSheet' || node.expression.expression.getText(file).endsWith('.StyleSheet'))) {
        report(node, 'Use createStyles from the mobile style helper instead of StyleSheet.create.');
      }
    }
    if (inMobile && ts.isJsxAttribute(node) && node.name.text.toLowerCase().endsWith('style') &&
      node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
      if (inlineStyle(node.initializer.expression)) report(node, 'Use createStyles from the mobile style helper instead of an inline style object.');
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return errors;
}

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (['.git', 'node_modules', 'dist', 'dist-web', 'dist-web-production', '.expo'].includes(entry.name)) return [];
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return files(path);
    return /\.[jt]sx?$/.test(entry.name) ? [path] : [];
  });
}

const filenameIndex = process.argv.indexOf('--filename');
const filename = filenameIndex < 0 ? 'example.tsx' : process.argv[filenameIndex + 1];
const errors = process.argv.includes('--stdin')
  ? check(readFileSync(0, 'utf8'), filename)
  : files(repo).flatMap((path) => check(readFileSync(path, 'utf8'), path));
if (errors.length) {
  console.log(errors.join('\n'));
  process.exitCode = 1;
}
