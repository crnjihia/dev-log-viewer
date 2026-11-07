// path: src/utils/jsonQuery.ts

export type Operator = ':' | '=' | '!=' | '>' | '>=' | '<' | '<=';

export type QueryValue =
  | { type: 'string'; value: string }
  | { type: 'number'; value: number }
  | { type: 'boolean'; value: boolean };

export type Predicate =
  | { type: 'comparison'; fieldPath: string; operator: Operator; value: QueryValue }
  | { type: 'and'; left: Predicate; right: Predicate }
  | { type: 'or'; left: Predicate; right: Predicate }
  | { type: 'not'; inner: Predicate };

export interface QueryParseError {
  position: number;
  message: string;
}

export interface DiscoveredField {
  path: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';
  sampleValue?: string;
}

type TokenType =
  | 'WORD'
  | 'STRING'
  | 'COLON'
  | 'EQUAL'
  | 'NOT_EQUAL'
  | 'GT'
  | 'GTE'
  | 'LT'
  | 'LTE'
  | 'AND'
  | 'OR'
  | 'NOT'
  | 'LPAREN'
  | 'RPAREN';

interface Token {
  type: TokenType;
  text: string;
  pos: number;
}

export function tokenize(input: string): { tokens: Token[]; error?: QueryParseError } {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (ch === '(') {
      tokens.push({ type: 'LPAREN', text: '(', pos: i });
      i++;
      continue;
    }

    if (ch === ')') {
      tokens.push({ type: 'RPAREN', text: ')', pos: i });
      i++;
      continue;
    }

    if (ch === ':') {
      tokens.push({ type: 'COLON', text: ':', pos: i });
      i++;
      continue;
    }

    if (ch === '=') {
      tokens.push({ type: 'EQUAL', text: '=', pos: i });
      i++;
      continue;
    }

    if (ch === '!' && i + 1 < input.length && input[i + 1] === '=') {
      tokens.push({ type: 'NOT_EQUAL', text: '!=', pos: i });
      i += 2;
      continue;
    }

    if (ch === '>') {
      if (i + 1 < input.length && input[i + 1] === '=') {
        tokens.push({ type: 'GTE', text: '>=', pos: i });
        i += 2;
      } else {
        tokens.push({ type: 'GT', text: '>', pos: i });
        i++;
      }
      continue;
    }

    if (ch === '<') {
      if (i + 1 < input.length && input[i + 1] === '=') {
        tokens.push({ type: 'LTE', text: '<=', pos: i });
        i += 2;
      } else {
        tokens.push({ type: 'LT', text: '<', pos: i });
        i++;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      const startPos = i;
      let text = '';
      i++;
      let closed = false;

      while (i < input.length) {
        if (input[i] === quote) {
          closed = true;
          i++;
          break;
        }
        if (input[i] === '\\' && i + 1 < input.length) {
          text += input[i + 1];
          i += 2;
          continue;
        }
        text += input[i];
        i++;
      }

      if (!closed) {
        return {
          tokens: [],
          error: {
            position: startPos,
            message: 'Unterminated quoted string',
          },
        };
      }

      tokens.push({ type: 'STRING', text, pos: startPos });
      continue;
    }

    // Identifiers, keywords, numbers, field paths (e.g. Body.stkCallback.ResultCode)
    const startPos = i;
    let word = '';
    while (i < input.length && !/\s|[():=!><'"]/.test(input[i])) {
      word += input[i];
      i++;
    }

    if (word.toUpperCase() === 'AND') {
      tokens.push({ type: 'AND', text: word, pos: startPos });
    } else if (word.toUpperCase() === 'OR') {
      tokens.push({ type: 'OR', text: word, pos: startPos });
    } else if (word.toUpperCase() === 'NOT') {
      tokens.push({ type: 'NOT', text: word, pos: startPos });
    } else {
      tokens.push({ type: 'WORD', text: word, pos: startPos });
    }
  }

  return { tokens };
}

class QueryParser {
  private tokens: Token[];
  private current: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token | undefined {
    return this.tokens[this.current];
  }

  private advance(): Token | undefined {
    const tok = this.tokens[this.current];
    if (tok) this.current++;
    return tok;
  }

  parse(): { predicate?: Predicate; error?: QueryParseError } {
    if (this.tokens.length === 0) {
      return {
        error: { position: 0, message: 'Empty query string' },
      };
    }

    try {
      const pred = this.parseOr();
      const extra = this.peek();
      if (extra) {
        return {
          error: {
            position: extra.pos,
            message: `Unexpected trailing token '${extra.text}'`,
          },
        };
      }
      return { predicate: pred };
    } catch (err: unknown) {
      return { error: err as QueryParseError };
    }
  }

  private parseOr(): Predicate {
    let expr = this.parseAnd();

    while (this.peek()?.type === 'OR') {
      this.advance();
      const right = this.parseAnd();
      expr = { type: 'or', left: expr, right };
    }

    return expr;
  }

  private parseAnd(): Predicate {
    let expr = this.parseUnary();

    while (this.peek()?.type === 'AND') {
      this.advance();
      const right = this.parseUnary();
      expr = { type: 'and', left: expr, right };
    }

    return expr;
  }

  private parseUnary(): Predicate {
    if (this.peek()?.type === 'NOT') {
      this.advance();
      const inner = this.parseUnary();
      return { type: 'not', inner };
    }

    return this.parsePrimary();
  }

  private parsePrimary(): Predicate {
    const lastPos = this.tokens[this.tokens.length - 1]?.pos ?? 0;
    const tok = this.advance();
    if (!tok) {
      throw {
        position: lastPos,
        message: 'Unexpected end of query',
      };
    }

    if (tok.type === 'LPAREN') {
      const expr = this.parseOr();
      const closing = this.advance();
      if (!closing) {
        throw {
          position: tok.pos,
          message: "Unclosed parenthesis, expected ')'",
        };
      }
      if (closing.type !== 'RPAREN') {
        throw {
          position: closing.pos,
          message: `Expected ')', got '${closing.text}'`,
        };
      }
      return expr;
    }

    if (tok.type === 'WORD') {
      const fieldPath = tok.text;
      const opTok = this.advance();
      if (!opTok) {
        throw {
          position: tok.pos,
          message: `Expected operator (:, =, !=, >, >=, <, <=) after field '${fieldPath}'`,
        };
      }

      let operator: Operator;
      switch (opTok.type) {
        case 'COLON':
          operator = ':';
          break;
        case 'EQUAL':
          operator = '=';
          break;
        case 'NOT_EQUAL':
          operator = '!=';
          break;
        case 'GT':
          operator = '>';
          break;
        case 'GTE':
          operator = '>=';
          break;
        case 'LT':
          operator = '<';
          break;
        case 'LTE':
          operator = '<=';
          break;
        default:
          throw {
            position: opTok.pos,
            message: `Expected comparison operator after '${fieldPath}', got '${opTok.text}'`,
          };
      }

      const valTok = this.advance();
      if (!valTok) {
        throw {
          position: opTok.pos,
          message: 'Expected comparison value after operator',
        };
      }

      let value: QueryValue;
      if (valTok.type === 'STRING') {
        value = { type: 'string', value: valTok.text };
      } else if (valTok.type === 'WORD') {
        const num = Number(valTok.text);
        if (!isNaN(num) && valTok.text.trim() !== '') {
          value = { type: 'number', value: num };
        } else if (valTok.text.toLowerCase() === 'true') {
          value = { type: 'boolean', value: true };
        } else if (valTok.text.toLowerCase() === 'false') {
          value = { type: 'boolean', value: false };
        } else {
          value = { type: 'string', value: valTok.text };
        }
      } else {
        throw {
          position: valTok.pos,
          message: `Expected string, number, or boolean value, got '${valTok.text}'`,
        };
      }

      return {
        type: 'comparison',
        fieldPath,
        operator,
        value,
      };
    }

    throw {
      position: tok.pos,
      message: `Unexpected token '${tok.text}'`,
    };
  }
}

export function compileQuery(query: string): { predicate?: Predicate; error?: QueryParseError } {
  const { tokens, error } = tokenize(query);
  if (error) return { error };
  const parser = new QueryParser(tokens);
  return parser.parse();
}

export function resolveField(obj: unknown, path: string): unknown {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return undefined;
  }

  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

export function evaluatePredicate(predicate: Predicate, obj: unknown): boolean {
  switch (predicate.type) {
    case 'and':
      return evaluatePredicate(predicate.left, obj) && evaluatePredicate(predicate.right, obj);
    case 'or':
      return evaluatePredicate(predicate.left, obj) || evaluatePredicate(predicate.right, obj);
    case 'not':
      return !evaluatePredicate(predicate.inner, obj);
    case 'comparison': {
      const actualVal = resolveField(obj, predicate.fieldPath);
      if (actualVal === undefined) return false;

      const expected = predicate.value;

      if (expected.type === 'number') {
        const actualNum = typeof actualVal === 'number' ? actualVal : Number(actualVal);
        if (isNaN(actualNum)) return false;

        switch (predicate.operator) {
          case '=':
          case ':':
            return Math.abs(actualNum - expected.value) < Number.EPSILON;
          case '!=':
            return Math.abs(actualNum - expected.value) >= Number.EPSILON;
          case '>':
            return actualNum > expected.value;
          case '>=':
            return actualNum >= expected.value;
          case '<':
            return actualNum < expected.value;
          case '<=':
            return actualNum <= expected.value;
        }
      }

      if (expected.type === 'boolean') {
        const actualBool = Boolean(actualVal);
        switch (predicate.operator) {
          case '=':
          case ':':
            return actualBool === expected.value;
          case '!=':
            return actualBool !== expected.value;
          default:
            return false;
        }
      }

      // String comparison
      const actualStr = String(actualVal);
      const expectedStr = expected.value;

      switch (predicate.operator) {
        case '=':
          return actualStr.localeCompare(expectedStr, undefined, { sensitivity: 'accent' }) === 0;
        case ':':
          return actualStr.toLowerCase().includes(expectedStr.toLowerCase());
        case '!=':
          return actualStr.localeCompare(expectedStr, undefined, { sensitivity: 'accent' }) !== 0;
        case '>':
          return actualStr > expectedStr;
        case '>=':
          return actualStr >= expectedStr;
        case '<':
          return actualStr < expectedStr;
        case '<=':
          return actualStr <= expectedStr;
      }
    }
  }
}

/**
 * Samples a collection of raw log strings, parses any JSON objects,
 * and recursively extracts a catalog of unique field paths with their types.
 */
export function sampleJsonFields(lines: string[]): DiscoveredField[] {
  const fieldsMap = new Map<string, DiscoveredField>();

  function scan(val: unknown, prefix: string) {
    if (val === null) {
      if (!fieldsMap.has(prefix)) {
        fieldsMap.set(prefix, { path: prefix, type: 'null', sampleValue: 'null' });
      }
      return;
    }

    if (Array.isArray(val)) {
      if (!fieldsMap.has(prefix)) {
        fieldsMap.set(prefix, {
          path: prefix,
          type: 'array',
          sampleValue: `[${val.length} items]`,
        });
      }
      return;
    }

    if (typeof val === 'object') {
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        const fullPath = prefix ? `${prefix}.${k}` : k;
        scan(v, fullPath);
      }
      return;
    }

    const typeStr = typeof val as 'string' | 'number' | 'boolean';
    if (!fieldsMap.has(prefix)) {
      fieldsMap.set(prefix, {
        path: prefix,
        type: typeStr,
        sampleValue: String(val).slice(0, 40),
      });
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        scan(parsed, '');
      } catch {
        // Skip malformed lines
      }
    }
  }

  return Array.from(fieldsMap.values()).sort((a, b) => a.path.localeCompare(b.path));
}

