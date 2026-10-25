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
  const constants = new WeakMap();
  const scanned = new Set();
  const isScope = (node) => ts.isBlock(node) || ts.isCaseBlock(node) || ts.isSourceFile(node) || ts.isFunctionLike(node);
  const enclosingScope = (node) => {
    for (let parent = node.parent; parent; parent = parent.parent) if (isScope(parent)) return parent;
    return file;
  };
  const functionScope = (node) => {
    for (let parent = node.parent; parent; parent = parent.parent) if (ts.isFunctionLike(parent) || ts.isSourceFile(parent)) return parent;
    return file;
  };
  const bind = (scope, name, value) => {
    if (!constants.has(scope)) constants.set(scope, new Map());
    constants.get(scope).set(name, value);
  };
  const bindingFor = (identifier) => {
    for (let parent = identifier; parent; parent = parent.parent) {
      if (isScope(parent) && constants.get(parent)?.has(identifier.text)) return constants.get(parent).get(identifier.text);
    }
    return undefined;
  };
  const unwrapped = (node) => {
    while (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) node = node.expression;
    return node;
  };
  const memberValue = (owner, key) => {
    if (!ts.isObjectLiteralExpression(owner)) return undefined;
    const member = owner.properties.find((item) => (ts.isPropertyAssignment(item) || ts.isShorthandPropertyAssignment(item)) && item.name.getText(file).replaceAll(/['"]/g, '') === key);
    return member ? ts.isPropertyAssignment(member) ? member.initializer : member.name : undefined;
  };
  const resolve = (node, seen = new Set()) => {
    node = unwrapped(node);
    if (ts.isIdentifier(node)) {
      const binding = bindingFor(node);
      if (binding && !seen.has(binding)) {
        const history = new Set([...seen, binding]);
        if (ts.isBindingElement(binding)) {
          const declaration = binding.parent.parent;
          const owner = resolve(declaration.initializer, history);
          const key = binding.propertyName?.getText(file) ?? binding.name.text;
          const value = ts.isArrayBindingPattern(binding.parent) && ts.isArrayLiteralExpression(owner)
            ? owner.elements[binding.parent.elements.indexOf(binding)]
            : memberValue(owner, key);
          return value ? resolve(value, history) : binding.initializer ? resolve(binding.initializer, history) : node;
        }
        return resolve(binding, history);
      }
    }
    if (ts.isPropertyAccessExpression(node)) {
      const owner = resolve(node.expression, seen);
      const value = memberValue(owner, node.name.text);
      if (value) return resolve(value, seen);
    }
    return node;
  };
  const numericValue = (expression) => {
    const value = resolve(expression);
    if (ts.isNumericLiteral(value)) return Number(value.text);
    if (ts.isPrefixUnaryExpression(value) && [ts.SyntaxKind.MinusToken, ts.SyntaxKind.PlusToken].includes(value.operator)) {
      const operand = numericValue(value.operand);
      return operand === null ? null : (value.operator === ts.SyntaxKind.MinusToken ? -operand : operand);
    }
    if (ts.isBinaryExpression(value)) {
      const left = numericValue(value.left);
      const right = numericValue(value.right);
      if (left === null || right === null) return null;
      const result = value.operatorToken.kind === ts.SyntaxKind.PlusToken ? left + right
        : value.operatorToken.kind === ts.SyntaxKind.MinusToken ? left - right
          : value.operatorToken.kind === ts.SyntaxKind.AsteriskToken ? left * right
            : value.operatorToken.kind === ts.SyntaxKind.SlashToken ? left / right : null;
      return Number.isFinite(result) ? result : null;
    }
    return null;
  };
  const hasRawNumber = (expression, seen = new Set()) => {
    const value = resolve(expression);
    if (seen.has(value)) return false;
    seen.add(value);
    if (ts.isNumericLiteral(value)) return true;
    return Boolean(ts.forEachChild(value, (child) => hasRawNumber(child, seen)));
  };
  const rawColor = (expression) => {
    const value = resolve(expression);
    if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) return value;
    if (ts.isConditionalExpression(value)) return rawColor(value.whenTrue) ?? rawColor(value.whenFalse);
    if (ts.isBinaryExpression(value) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(value.operatorToken.kind)) {
      return rawColor(value.left) ?? rawColor(value.right);
    }
    return null;
  };
  const checkProperty = (property, location, expression) => {
    const value = resolve(expression);
    const line = file.getLineAndCharacterOfPosition(location.getStart(file)).line + 1;
    const literalColor = rawColor(value);
    if (literalColor && (/(?:^color$|Color$)/i.test(property) || /^#/.test(literalColor.text))) {
      errors.push(`${name}:${line}: raw color in ${property}: ${literalColor.text}. ${suggest(tokens.colors, literalColor.text.toUpperCase(), 'colors')}`);
    }
    const group = /^(?:(?:margin|padding|gap|rowGap|columnGap)(?:Top|Right|Bottom|Left|Horizontal|Vertical|Start|End)?|top|right|bottom|left|start|end)$/.test(property)
      ? 'space'
      : /^(?:borderRadius|borderTopLeftRadius|borderTopRightRadius|borderBottomLeftRadius|borderBottomRightRadius)$/.test(property)
        ? 'radius' : null;
    const numeric = group ? numericValue(value) : null;
    if (group && (numeric !== null || hasRawNumber(value))) {
      const candidates = Object.fromEntries(Object.entries(tokens.sizes).filter(([key]) => key.startsWith(`${group}/`)));
      const guidance = numeric === null ? 'There is no exact token for this expression. Choose a token from the Figma export.' : suggest(candidates, Math.abs(numeric), 'sizes');
      errors.push(`${name}:${line}: raw ${group} value in ${property}: ${value.getText(file)}. ${numeric !== null && numeric < 0 && guidance.startsWith('Use ') ? guidance.replace('Use ', 'Use -') : guidance}`);
    }
  };
  const visitStyle = (node) => {
    if (scanned.has(node)) return;
    scanned.add(node);
    const value = resolve(node);
    if (value !== node && (ts.isObjectLiteralExpression(value) || ts.isArrayLiteralExpression(value))) {
      visitStyle(value);
      return;
    }
    if (ts.isSpreadAssignment(node)) visitStyle(node.expression);
    if (ts.isPropertyAssignment(node)) {
      checkProperty(node.name.getText(file).replaceAll(/['"]/g, ''), node.initializer, node.initializer);
      const nested = resolve(node.initializer);
      if (ts.isObjectLiteralExpression(nested) || ts.isArrayLiteralExpression(nested)) visitStyle(nested);
      return;
    }
    if (ts.isShorthandPropertyAssignment(node)) {
      checkProperty(node.name.text, node.name, node.name);
      const nested = resolve(node.name);
      if (ts.isObjectLiteralExpression(nested) || ts.isArrayLiteralExpression(nested)) visitStyle(nested);
      return;
    }
    ts.forEachChild(node, visitStyle);
  };
  const shadowParameters = (pattern, scope, defaultValue = null) => {
    if (ts.isIdentifier(pattern)) bind(scope, pattern.text, defaultValue);
    if (ts.isBindingElement(pattern)) shadowParameters(pattern.name, scope, pattern.initializer ?? null);
    if (ts.isObjectBindingPattern(pattern) || ts.isArrayBindingPattern(pattern)) {
      for (const element of pattern.elements) if (ts.isBindingElement(element)) shadowParameters(element, scope);
    }
  };
  const collectConstants = (node) => {
    if (ts.isVariableDeclaration(node)) {
      const flags = node.parent.flags;
      if ((flags & ts.NodeFlags.Const) && node.initializer) {
        if (ts.isIdentifier(node.name)) bind(enclosingScope(node), node.name.text, node.initializer);
        if (ts.isObjectBindingPattern(node.name) || ts.isArrayBindingPattern(node.name)) {
          for (const element of node.name.elements) if (ts.isBindingElement(element) && ts.isIdentifier(element.name)) bind(enclosingScope(node), element.name.text, element);
        }
      } else {
        shadowParameters(node.name, (flags & ts.NodeFlags.Let) ? enclosingScope(node) : functionScope(node));
      }
    }
    if (ts.isFunctionLike(node)) {
      for (const parameter of node.parameters) shadowParameters(parameter.name, node, parameter.initializer ?? null);
    }
    ts.forEachChild(node, collectConstants);
  };
  collectConstants(file);
  const collect = (node) => {
    if (ts.isJsxAttribute(node) && node.name.text?.toLowerCase().endsWith('style') && node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
      visitStyle(node.initializer.expression);
    }
    if (ts.isCallExpression(node) && node.expression.getText(file) === 'StyleSheet.create' && node.arguments[0]) {
      visitStyle(node.arguments[0]);
    }
    ts.forEachChild(node, collect);
  };
  collect(file);
  const scanNamedStyles = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && /styles?$/i.test(node.name.text) && node.initializer && ts.isObjectLiteralExpression(unwrapped(node.initializer))) {
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
