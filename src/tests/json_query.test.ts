// path: src/tests/json_query.test.ts

import { describe, it, expect } from 'vitest';
import {
  compileQuery,
  evaluatePredicate,
  sampleJsonFields,
} from '../utils/jsonQuery';

describe('Structured JSON Query Parser & Evaluator', () => {
  it('compiles nested queries and evaluates boolean AND / OR / NOT', () => {
    const q1 = compileQuery('level:error AND duration_ms>500');
    expect(q1.error).toBeUndefined();
    expect(q1.predicate).toBeDefined();

    const linePass = {
      level: 'error',
      duration_ms: 820,
    };
    const lineFail = {
      level: 'info',
      duration_ms: 820,
    };

    expect(evaluatePredicate(q1.predicate!, linePass)).toBe(true);
    expect(evaluatePredicate(q1.predicate!, lineFail)).toBe(false);

    // Grouping with parentheses
    const q2 = compileQuery('(service:"daraja" OR service:"mpesa") AND NOT status:failed');
    expect(q2.error).toBeUndefined();
    expect(
      evaluatePredicate(q2.predicate!, {
        service: 'daraja-c2b',
        status: 'success',
      })
    ).toBe(true);
    expect(
      evaluatePredicate(q2.predicate!, {
        service: 'daraja-c2b',
        status: 'failed',
      })
    ).toBe(false);
  });

  it('evaluates nested dot-notation fields', () => {
    const query = compileQuery('Body.stkCallback.ResultCode=0 AND Body.stkCallback.Amount>=1000');
    expect(query.error).toBeUndefined();

    const stkPayload = {
      timestamp: '2026-11-07T16:45:00Z',
      Body: {
        stkCallback: {
          MerchantRequestID: '29115-4921-1',
          ResultCode: 0,
          Amount: 2500,
        },
      },
    };

    expect(evaluatePredicate(query.predicate!, stkPayload)).toBe(true);

    const stkFail = {
      Body: {
        stkCallback: {
          ResultCode: 1032, // User cancelled
          Amount: 2500,
        },
      },
    };
    expect(evaluatePredicate(query.predicate!, stkFail)).toBe(false);
  });

  it('handles missing fields gracefully without throwing', () => {
    const query = compileQuery('user.id:42 AND metadata.region:"Nairobi"');
    expect(query.error).toBeUndefined();

    const line = {
      user: {
        name: 'Chris',
      },
    };

    // Missing fields should evaluate to false, never throw
    expect(evaluatePredicate(query.predicate!, line)).toBe(false);
    expect(evaluatePredicate(query.predicate!, null)).toBe(false);
    expect(evaluatePredicate(query.predicate!, 'not an object')).toBe(false);
  });

  it('reports position-aware syntax errors with precise positions', () => {
    // Unclosed parenthesis
    const err1 = compileQuery('(level:error AND status:500');
    expect(err1.error).toBeDefined();
    expect(err1.error?.position).toBe(0);
    expect(err1.error?.message).toContain('Unclosed parenthesis');

    // Missing operator
    const err2 = compileQuery('level');
    expect(err2.error).toBeDefined();
    expect(err2.error?.position).toBe(0);
    expect(err2.error?.message).toContain('Expected operator');

    // Missing value
    const err3 = compileQuery('level=');
    expect(err3.error).toBeDefined();
    expect(err3.error?.position).toBe(5);
    expect(err3.error?.message).toContain('Expected comparison value');

    // Unterminated quoted string
    const err4 = compileQuery('service:"daraja');
    expect(err4.error).toBeDefined();
    expect(err4.error?.position).toBe(8);
    expect(err4.error?.message).toContain('Unterminated quoted string');
  });

  it('samples JSON fields and detects correct schema types', () => {
    const lines = [
      '2026-11-07 16:30:00 [INFO] Plain text line',
      '{"service":"daraja-stk","amount":1500,"is_sandbox":true,"metadata":{"till":"500123"}}',
      'Non-json line',
      '{"service":"africas-talking","amount":250,"tags":["sms","urgent"]}',
      '{ malformed json line without closing quote ',
    ];

    const fields = sampleJsonFields(lines);
    const fieldMap = new Map(fields.map((f) => [f.path, f.type]));

    expect(fieldMap.get('service')).toBe('string');
    expect(fieldMap.get('amount')).toBe('number');
    expect(fieldMap.get('is_sandbox')).toBe('boolean');
    expect(fieldMap.get('metadata.till')).toBe('string');
    expect(fieldMap.get('tags')).toBe('array');
    expect(fieldMap.has('non_existent')).toBe(false);
  });
});

