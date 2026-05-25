/**
 * Tests for the simulator CLI's pure helpers.
 *
 * We exercise the argument parser, the REPL command parser and the two
 * value formatters in isolation. The top-level `main()` is not covered
 * here because it only orchestrates I/O (serial port, readline,
 * process.exit) — its building blocks are tested individually.
 */

import { describe, expect, it } from 'vitest';

import {
  coerceSetValue,
  formatHexDump,
  formatStateValue,
  parseArgs,
  parseCommand,
} from '../../tools/simulator/cli.js';

describe('parseArgs', () => {
  it('accepts only --device and applies defaults', () => {
    const result = parseArgs(['--device', '/dev/ttyUSB0']);
    expect(result).toEqual({
      kind: 'config',
      device: '/dev/ttyUSB0',
      baud: 9600,
      logLevel: 'summary',
    });
  });

  it('overrides baud rate', () => {
    const result = parseArgs(['--device', '/dev/ttyUSB0', '--baud', '19200']);
    expect(result).toEqual({
      kind: 'config',
      device: '/dev/ttyUSB0',
      baud: 19200,
      logLevel: 'summary',
    });
  });

  it('overrides log level', () => {
    const result = parseArgs(['--device', 'x', '--log-level', 'hex']);
    expect(result).toEqual({
      kind: 'config',
      device: 'x',
      baud: 9600,
      logLevel: 'hex',
    });
  });

  it('accepts options in arbitrary order', () => {
    const result = parseArgs(['--baud', '57600', '--device', '/dev/x', '--log-level', 'silent']);
    expect(result).toEqual({
      kind: 'config',
      device: '/dev/x',
      baud: 57600,
      logLevel: 'silent',
    });
  });

  it('returns help marker for --help', () => {
    expect(parseArgs(['--help'])).toEqual({ kind: 'help' });
    expect(parseArgs(['-h'])).toEqual({ kind: 'help' });
  });

  it('reports missing --device', () => {
    const result = parseArgs([]);
    expect(result).toEqual({ kind: 'error', error: expect.stringContaining('--device') });
  });

  it('reports unknown option', () => {
    const result = parseArgs(['--device', 'x', '--frobnicate']);
    expect(result).toEqual({ kind: 'error', error: expect.stringContaining('--frobnicate') });
  });

  it('reports --baud without value', () => {
    const result = parseArgs(['--device', 'x', '--baud']);
    expect(result).toEqual({ kind: 'error', error: expect.stringContaining('--baud') });
  });

  it('reports --baud with non-numeric value', () => {
    const result = parseArgs(['--device', 'x', '--baud', 'abc']);
    expect(result).toEqual({ kind: 'error', error: expect.stringContaining('positive integer') });
  });

  it('reports --baud followed by another flag as missing value', () => {
    const result = parseArgs(['--device', 'x', '--baud', '--log-level', 'silent']);
    expect(result).toEqual({ kind: 'error', error: expect.stringContaining('--baud') });
  });

  it('reports --device without value', () => {
    const result = parseArgs(['--device']);
    expect(result).toEqual({ kind: 'error', error: expect.stringContaining('--device') });
  });

  it('reports invalid --log-level value', () => {
    const result = parseArgs(['--device', 'x', '--log-level', 'verbose']);
    expect(result).toEqual({ kind: 'error', error: expect.stringContaining('verbose') });
  });

  it('reports --log-level without value', () => {
    const result = parseArgs(['--device', 'x', '--log-level']);
    expect(result).toEqual({ kind: 'error', error: expect.stringContaining('--log-level') });
  });
});

describe('parseCommand', () => {
  it('treats an empty line as empty', () => {
    expect(parseCommand('')).toEqual({ kind: 'empty' });
    expect(parseCommand('   ')).toEqual({ kind: 'empty' });
  });

  it('parses bare get', () => {
    expect(parseCommand('get')).toEqual({ kind: 'get' });
    expect(parseCommand('  GET  ')).toEqual({ kind: 'get' });
  });

  it('parses get <topic>', () => {
    expect(parseCommand('get Outside_Temp')).toEqual({
      kind: 'getOne',
      topic: 'Outside_Temp',
    });
  });

  it('rejects get with multiple arguments', () => {
    expect(parseCommand('get a b')).toEqual({ kind: 'unknown' });
  });

  it('parses set with a numeric value', () => {
    expect(parseCommand('set Outside_Temp 5.5')).toEqual({
      kind: 'set',
      topic: 'Outside_Temp',
      rawValue: '5.5',
    });
  });

  it('parses set with a quoted string value containing spaces', () => {
    expect(parseCommand('set Heat_Pump_Model "DE AD BE EF"')).toEqual({
      kind: 'set',
      topic: 'Heat_Pump_Model',
      rawValue: 'DE AD BE EF',
    });
  });

  it('keeps unquoted multi-token value as space-joined string', () => {
    expect(parseCommand('set Error No error')).toEqual({
      kind: 'set',
      topic: 'Error',
      rawValue: 'No error',
    });
  });

  it('reports set without enough tokens as unknown', () => {
    expect(parseCommand('set Outside_Temp')).toEqual({ kind: 'unknown' });
    expect(parseCommand('set')).toEqual({ kind: 'unknown' });
  });

  it('parses quit and exit', () => {
    expect(parseCommand('quit')).toEqual({ kind: 'quit' });
    expect(parseCommand('exit')).toEqual({ kind: 'quit' });
    expect(parseCommand('EXIT')).toEqual({ kind: 'quit' });
  });

  it('parses help', () => {
    expect(parseCommand('help')).toEqual({ kind: 'help' });
  });

  it('returns unknown for everything else', () => {
    expect(parseCommand('foo')).toEqual({ kind: 'unknown' });
    expect(parseCommand('hello world')).toEqual({ kind: 'unknown' });
  });
});

describe('formatHexDump', () => {
  it('returns an empty string for empty input', () => {
    expect(formatHexDump(new Uint8Array(0))).toBe('');
  });

  it('emits one line per 16 input bytes', () => {
    const bytes = new Uint8Array(32);
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = index;
    }
    const dump = formatHexDump(bytes);
    const lines = dump.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('0000  00 01 02 03 04 05 06 07 08 09 0a 0b 0c 0d 0e 0f');
    expect(lines[1]).toBe('0010  10 11 12 13 14 15 16 17 18 19 1a 1b 1c 1d 1e 1f');
  });

  it('handles partial final lines', () => {
    const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    expect(formatHexDump(bytes)).toBe('0000  de ad be ef');
  });
});

describe('formatStateValue', () => {
  it('renders integers verbatim', () => {
    expect(formatStateValue('Outside_Temp', 5)).toBe('Outside_Temp=5');
  });

  it('rounds floats to at most three decimals', () => {
    expect(formatStateValue('Pump_Flow', 12.34567)).toBe('Pump_Flow=12.346');
  });

  it('passes strings through unchanged', () => {
    expect(formatStateValue('Heat_Pump_Model', 'DE AD BE EF')).toBe('Heat_Pump_Model=DE AD BE EF');
  });
});

describe('coerceSetValue', () => {
  it('rejects unknown topics', () => {
    const result = coerceSetValue('Not_A_Topic', '5');
    expect(result).toEqual({ ok: false, error: expect.stringContaining('Not_A_Topic') });
  });

  it('parses numeric topics with parseFloat', () => {
    expect(coerceSetValue('Outside_Temp', '5.5')).toEqual({ ok: true, value: 5.5 });
  });

  it('keeps string topics as strings', () => {
    expect(coerceSetValue('Heat_Pump_Model', 'DE AD BE EF')).toEqual({
      ok: true,
      value: 'DE AD BE EF',
    });
    expect(coerceSetValue('Error', 'F12')).toEqual({ ok: true, value: 'F12' });
  });

  it('rejects non-numeric input for numeric topics', () => {
    const result = coerceSetValue('Outside_Temp', 'hot');
    expect(result).toEqual({ ok: false, error: expect.stringContaining('not a number') });
  });
});
