import type { ExpressionEvaluation, ExpressionOptions } from './types.js';
import { isRecord } from './utils.js';

type TokenKind =
  'number' | 'string' | 'identifier' | 'variable' | 'operator' | 'punctuation' | 'eof';

interface Token {
  kind: TokenKind;
  value: string;
  position: number;
}

type ExpressionNode =
  | { type: 'literal'; value: unknown }
  | { type: 'variable'; name: string }
  | { type: 'identifier'; name: string }
  | { type: 'array'; elements: ExpressionNode[] }
  | { type: 'object'; properties: Array<{ key: string; value: ExpressionNode }> }
  | { type: 'unary'; operator: string; argument: ExpressionNode }
  | { type: 'binary'; operator: string; left: ExpressionNode; right: ExpressionNode }
  | {
      type: 'conditional';
      test: ExpressionNode;
      consequent: ExpressionNode;
      alternate: ExpressionNode;
    }
  | { type: 'member'; object: ExpressionNode; property: ExpressionNode; computed: boolean }
  | { type: 'call'; callee: ExpressionNode; arguments: ExpressionNode[] };

const MAX_SOURCE_LENGTH = 1_000;
const MAX_TOKENS = 500;
const MAX_AST_NODES = 500;
const MAX_DEPTH = 40;
const FORBIDDEN_PROPERTIES = new Set(['constructor', 'prototype', '__proto__']);
const ALLOWED_MATH_METHODS = new Set(['floor', 'ceil', 'round', 'trunc', 'abs', 'min', 'max']);

const binaryPrecedence: Record<string, number> = {
  '||': 1,
  '&&': 2,
  '===': 3,
  '!==': 3,
  '==': 3,
  '!=': 3,
  '<': 4,
  '<=': 4,
  '>': 4,
  '>=': 4,
  '+': 5,
  '-': 5,
  '*': 6,
  '/': 6,
  '%': 6,
};

class ExpressionSyntaxError extends Error {
  constructor(
    message: string,
    readonly position: number,
  ) {
    super(`${message} at character ${position}.`);
    this.name = 'ExpressionSyntaxError';
  }
}

class Tokenizer {
  private position = 0;
  private readonly tokens: Token[] = [];

  constructor(private readonly source: string) {}

  tokenize(): Token[] {
    if (this.source.length > MAX_SOURCE_LENGTH) {
      throw new ExpressionSyntaxError('Expression is too long', MAX_SOURCE_LENGTH);
    }

    while (this.position < this.source.length) {
      this.skipWhitespace();
      if (this.position >= this.source.length) {
        break;
      }
      const character = this.source[this.position]!;
      if (/[0-9]/.test(character) || (character === '.' && /[0-9]/.test(this.peek(1)))) {
        this.readNumber();
      } else if (character === "'" || character === '"') {
        this.readString(character);
      } else if (character === '#') {
        this.readVariable();
      } else if (/[A-Za-z_$]/.test(character)) {
        this.readIdentifier();
      } else {
        this.readOperatorOrPunctuation();
      }
      if (this.tokens.length > MAX_TOKENS) {
        throw new ExpressionSyntaxError('Expression contains too many tokens', this.position);
      }
    }

    this.tokens.push({ kind: 'eof', value: '', position: this.position });
    return this.tokens;
  }

  private peek(offset = 0): string {
    return this.source[this.position + offset] ?? '';
  }

  private skipWhitespace(): void {
    while (/\s/.test(this.peek())) {
      this.position += 1;
    }
  }

  private readNumber(): void {
    const start = this.position;
    const match = this.source
      .slice(this.position)
      .match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
    if (!match) {
      throw new ExpressionSyntaxError('Invalid number', start);
    }
    this.position += match[0].length;
    this.tokens.push({ kind: 'number', value: match[0], position: start });
  }

  private readString(quote: string): void {
    const start = this.position;
    this.position += 1;
    let value = '';
    while (this.position < this.source.length) {
      const character = this.peek();
      if (character === quote) {
        this.position += 1;
        this.tokens.push({ kind: 'string', value, position: start });
        return;
      }
      if (character === '\\') {
        const next = this.peek(1);
        const escapes: Record<string, string> = {
          n: '\n',
          r: '\r',
          t: '\t',
          '\\': '\\',
          "'": "'",
          '"': '"',
        };
        if (!(next in escapes)) {
          throw new ExpressionSyntaxError('Unsupported string escape', this.position);
        }
        value += escapes[next];
        this.position += 2;
      } else {
        value += character;
        this.position += 1;
      }
    }
    throw new ExpressionSyntaxError('Unterminated string', start);
  }

  private readVariable(): void {
    const start = this.position;
    this.position += 1;
    const match = this.source.slice(this.position).match(/^[A-Za-z_$][\w$]*/);
    if (!match) {
      throw new ExpressionSyntaxError('Expected a variable name after #', start);
    }
    this.position += match[0].length;
    this.tokens.push({ kind: 'variable', value: match[0], position: start });
  }

  private readIdentifier(): void {
    const start = this.position;
    const match = this.source.slice(this.position).match(/^[A-Za-z_$][\w$]*/)!;
    this.position += match[0].length;
    this.tokens.push({ kind: 'identifier', value: match[0], position: start });
  }

  private readOperatorOrPunctuation(): void {
    const start = this.position;
    const operators = [
      '===',
      '!==',
      '<=',
      '>=',
      '&&',
      '||',
      '==',
      '!=',
      '+',
      '-',
      '*',
      '/',
      '%',
      '<',
      '>',
      '!',
    ];
    const operator = operators.find((candidate) =>
      this.source.startsWith(candidate, this.position),
    );
    if (operator) {
      this.position += operator.length;
      this.tokens.push({ kind: 'operator', value: operator, position: start });
      return;
    }

    const character = this.peek();
    if ('()[]{},.?:'.includes(character)) {
      this.position += 1;
      this.tokens.push({ kind: 'punctuation', value: character, position: start });
      return;
    }
    throw new ExpressionSyntaxError(`Unsupported token "${character}"`, start);
  }
}

class Parser {
  private position = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): ExpressionNode {
    const node = this.parseConditional();
    this.expect('eof');
    validateComplexity(node);
    return node;
  }

  private current(): Token {
    return this.tokens[this.position]!;
  }

  private consume(): Token {
    const token = this.current();
    this.position += 1;
    return token;
  }

  private match(kind: TokenKind, value?: string): boolean {
    const token = this.current();
    return token.kind === kind && (value === undefined || token.value === value);
  }

  private expect(kind: TokenKind, value?: string): Token {
    if (!this.match(kind, value)) {
      const expected = value ? `${kind} "${value}"` : kind;
      throw new ExpressionSyntaxError(`Expected ${expected}`, this.current().position);
    }
    return this.consume();
  }

  private parseConditional(): ExpressionNode {
    const test = this.parseBinary(1);
    if (!this.match('punctuation', '?')) {
      return test;
    }
    this.consume();
    const consequent = this.parseConditional();
    this.expect('punctuation', ':');
    const alternate = this.parseConditional();
    return { type: 'conditional', test, consequent, alternate };
  }

  private parseBinary(minimumPrecedence: number): ExpressionNode {
    let left = this.parseUnary();
    while (this.match('operator')) {
      const operator = this.current().value;
      const precedence = binaryPrecedence[operator];
      if (precedence === undefined || precedence < minimumPrecedence) {
        break;
      }
      this.consume();
      const right = this.parseBinary(precedence + 1);
      left = { type: 'binary', operator, left, right };
    }
    return left;
  }

  private parseUnary(): ExpressionNode {
    if (this.match('operator') && ['!', '+', '-'].includes(this.current().value)) {
      const operator = this.consume().value;
      return { type: 'unary', operator, argument: this.parseUnary() };
    }
    return this.parsePostfix(this.parsePrimary());
  }

  private parsePrimary(): ExpressionNode {
    const token = this.current();
    if (token.kind === 'number') {
      this.consume();
      return { type: 'literal', value: Number(token.value) };
    }
    if (token.kind === 'string') {
      this.consume();
      return { type: 'literal', value: token.value };
    }
    if (token.kind === 'variable') {
      this.consume();
      return { type: 'variable', name: token.value };
    }
    if (token.kind === 'identifier') {
      this.consume();
      if (token.value === 'true') return { type: 'literal', value: true };
      if (token.value === 'false') return { type: 'literal', value: false };
      if (token.value === 'null') return { type: 'literal', value: null };
      return { type: 'identifier', name: token.value };
    }
    if (this.match('punctuation', '[')) {
      this.consume();
      const elements: ExpressionNode[] = [];
      if (!this.match('punctuation', ']')) {
        do {
          elements.push(this.parseConditional());
          if (!this.match('punctuation', ',')) break;
          this.consume();
        } while (!this.match('punctuation', ']'));
      }
      this.expect('punctuation', ']');
      return { type: 'array', elements };
    }
    if (this.match('punctuation', '{')) {
      this.consume();
      const properties: Array<{ key: string; value: ExpressionNode }> = [];
      if (!this.match('punctuation', '}')) {
        do {
          const key = this.current();
          if (key.kind !== 'identifier' && key.kind !== 'string') {
            throw new ExpressionSyntaxError('Expected an object property name', key.position);
          }
          this.consume();
          if (FORBIDDEN_PROPERTIES.has(key.value)) {
            throw new ExpressionSyntaxError(`Property "${key.value}" is not allowed`, key.position);
          }
          this.expect('punctuation', ':');
          properties.push({ key: key.value, value: this.parseConditional() });
          if (!this.match('punctuation', ',')) break;
          this.consume();
        } while (!this.match('punctuation', '}'));
      }
      this.expect('punctuation', '}');
      return { type: 'object', properties };
    }
    if (this.match('punctuation', '(')) {
      this.consume();
      const expression = this.parseConditional();
      this.expect('punctuation', ')');
      return expression;
    }
    throw new ExpressionSyntaxError('Expected an expression', token.position);
  }

  private parsePostfix(initial: ExpressionNode): ExpressionNode {
    let expression = initial;
    while (true) {
      if (this.match('punctuation', '.')) {
        this.consume();
        const property = this.expect('identifier');
        expression = {
          type: 'member',
          object: expression,
          property: { type: 'literal', value: property.value },
          computed: false,
        };
      } else if (this.match('punctuation', '[')) {
        this.consume();
        const property = this.parseConditional();
        this.expect('punctuation', ']');
        expression = { type: 'member', object: expression, property, computed: true };
      } else if (this.match('punctuation', '(')) {
        this.consume();
        const argumentsList: ExpressionNode[] = [];
        if (!this.match('punctuation', ')')) {
          do {
            argumentsList.push(this.parseConditional());
            if (!this.match('punctuation', ',')) break;
            this.consume();
          } while (argumentsList.length <= 20);
        }
        this.expect('punctuation', ')');
        expression = { type: 'call', callee: expression, arguments: argumentsList };
      } else {
        break;
      }
    }
    return expression;
  }
}

function validateComplexity(root: ExpressionNode): void {
  let nodes = 0;
  const visit = (node: ExpressionNode, depth: number): void => {
    nodes += 1;
    if (nodes > MAX_AST_NODES || depth > MAX_DEPTH) {
      throw new Error('Expression is too complex.');
    }
    switch (node.type) {
      case 'unary':
        visit(node.argument, depth + 1);
        break;
      case 'array':
        node.elements.forEach((element) => visit(element, depth + 1));
        break;
      case 'object':
        node.properties.forEach((property) => visit(property.value, depth + 1));
        break;
      case 'binary':
        visit(node.left, depth + 1);
        visit(node.right, depth + 1);
        break;
      case 'conditional':
        visit(node.test, depth + 1);
        visit(node.consequent, depth + 1);
        visit(node.alternate, depth + 1);
        break;
      case 'member':
        visit(node.object, depth + 1);
        visit(node.property, depth + 1);
        break;
      case 'call':
        visit(node.callee, depth + 1);
        node.arguments.forEach((argument) => visit(argument, depth + 1));
        break;
      default:
        break;
    }
  };
  visit(root, 1);
}

function getMemberValue(object: unknown, property: unknown): unknown {
  const key = String(property);
  if (FORBIDDEN_PROPERTIES.has(key)) {
    throw new Error(`Property "${key}" is not allowed.`);
  }
  if (key === 'length' && (typeof object === 'string' || Array.isArray(object))) {
    return object.length;
  }
  if (Array.isArray(object)) {
    if (!/^\d+$/.test(key)) {
      throw new Error(`Array property "${key}" is not allowed.`);
    }
    return object[Number(key)];
  }
  if (typeof object === 'string') {
    if (!/^\d+$/.test(key)) {
      throw new Error(`String property "${key}" is not allowed.`);
    }
    return object[Number(key)];
  }
  if (isRecord(object) && Object.prototype.hasOwnProperty.call(object, key)) {
    return object[key];
  }
  return undefined;
}

function evaluateNode(
  node: ExpressionNode,
  variables: Record<string, unknown>,
  options: ExpressionOptions,
  depth = 0,
): unknown {
  if (depth > MAX_DEPTH) {
    throw new Error('Expression evaluation exceeded its depth limit.');
  }
  switch (node.type) {
    case 'literal':
      return node.value;
    case 'variable':
      if (!Object.prototype.hasOwnProperty.call(variables, node.name)) {
        throw new Error(`Variable "#${node.name}" is not defined.`);
      }
      return variables[node.name];
    case 'identifier':
      throw new Error(`Identifier "${node.name}" can only be used as an allowed function.`);
    case 'array':
      return node.elements.map((element) => evaluateNode(element, variables, options, depth + 1));
    case 'object': {
      const value = Object.create(null) as Record<string, unknown>;
      for (const property of node.properties) {
        value[property.key] = evaluateNode(property.value, variables, options, depth + 1);
      }
      return value;
    }
    case 'unary': {
      const value = evaluateNode(node.argument, variables, options, depth + 1);
      if (node.operator === '!') return !value;
      if (node.operator === '+') return Number(value);
      return -Number(value);
    }
    case 'binary': {
      if (node.operator === '&&') {
        const left = evaluateNode(node.left, variables, options, depth + 1);
        return left ? evaluateNode(node.right, variables, options, depth + 1) : left;
      }
      if (node.operator === '||') {
        const left = evaluateNode(node.left, variables, options, depth + 1);
        return left ? left : evaluateNode(node.right, variables, options, depth + 1);
      }
      const left = evaluateNode(node.left, variables, options, depth + 1) as never;
      const right = evaluateNode(node.right, variables, options, depth + 1) as never;
      switch (node.operator) {
        case '+':
          return (left as number) + (right as number);
        case '-':
          return Number(left) - Number(right);
        case '*':
          return Number(left) * Number(right);
        case '/':
          return Number(left) / Number(right);
        case '%':
          return Number(left) % Number(right);
        case '<':
          return left < right;
        case '<=':
          return left <= right;
        case '>':
          return left > right;
        case '>=':
          return left >= right;
        case '===':
        case '==':
          return Object.is(left, right);
        case '!==':
        case '!=':
          return !Object.is(left, right);
        default:
          throw new Error(`Operator "${node.operator}" is not allowed.`);
      }
    }
    case 'conditional':
      return evaluateNode(
        evaluateNode(node.test, variables, options, depth + 1) ? node.consequent : node.alternate,
        variables,
        options,
        depth + 1,
      );
    case 'member': {
      const object = evaluateNode(node.object, variables, options, depth + 1);
      const property = evaluateNode(node.property, variables, options, depth + 1);
      return getMemberValue(object, property);
    }
    case 'call': {
      if (node.arguments.length > 20) {
        throw new Error('Function call has too many arguments.');
      }
      const argumentsList = node.arguments.map((argument) =>
        evaluateNode(argument, variables, options, depth + 1),
      );
      if (node.callee.type === 'identifier' && node.callee.name !== 'Math') {
        const extension = options.functions?.[node.callee.name];
        if (!Object.prototype.hasOwnProperty.call(options.functions ?? {}, node.callee.name)) {
          throw new Error(`Function "${node.callee.name}" is not allowed.`);
        }
        if (typeof extension !== 'function') {
          throw new Error(`Function "${node.callee.name}" is not callable.`);
        }
        return extension(...argumentsList);
      }
      if (
        node.callee.type === 'member' &&
        node.callee.object.type === 'identifier' &&
        node.callee.object.name === 'Math' &&
        node.callee.property.type === 'literal'
      ) {
        const method = String(node.callee.property.value);
        if (!ALLOWED_MATH_METHODS.has(method)) {
          throw new Error(`Math.${method} is not allowed.`);
        }
        const numericArguments = argumentsList.map(Number);
        return (Math[method as keyof Math] as (...values: number[]) => number)(...numericArguments);
      }
      if (
        node.callee.type === 'member' &&
        node.callee.property.type === 'literal' &&
        node.callee.property.value === 'concat'
      ) {
        const receiver = evaluateNode(node.callee.object, variables, options, depth + 1);
        if (typeof receiver !== 'string') {
          throw new Error('concat is only allowed on strings.');
        }
        return receiver.concat(...argumentsList.map(String));
      }
      throw new Error('Function call is not allowed.');
    }
  }
}

function parseExpression(source: string): ExpressionNode {
  return new Parser(new Tokenizer(source).tokenize()).parse();
}

export function collectExpressionDependencies(source: string): string[] {
  const root = parseExpression(source);
  const dependencies = new Set<string>();
  const visit = (node: ExpressionNode): void => {
    switch (node.type) {
      case 'variable':
        dependencies.add(node.name);
        break;
      case 'unary':
        visit(node.argument);
        break;
      case 'array':
        node.elements.forEach(visit);
        break;
      case 'object':
        node.properties.forEach((property) => visit(property.value));
        break;
      case 'binary':
        visit(node.left);
        visit(node.right);
        break;
      case 'conditional':
        visit(node.test);
        visit(node.consequent);
        visit(node.alternate);
        break;
      case 'member':
        visit(node.object);
        visit(node.property);
        break;
      case 'call':
        visit(node.callee);
        node.arguments.forEach(visit);
        break;
      default:
        break;
    }
  };
  visit(root);
  return [...dependencies];
}

export function evaluatePriceExpression(
  source: string,
  variables: Record<string, unknown>,
  options: ExpressionOptions = {},
): ExpressionEvaluation {
  try {
    const result = evaluateNode(parseExpression(source), variables, options);
    if (typeof result !== 'number' || !Number.isFinite(result) || result < 0) {
      return { error: 'Expression must resolve to a finite, non-negative number.' };
    }
    return { value: result };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Expression evaluation failed.' };
  }
}
