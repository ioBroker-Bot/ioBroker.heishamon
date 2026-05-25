#!/usr/bin/env node
/**
 * CLI entry point for the heat-pump simulator.
 *
 * Wires up the transport-agnostic `SimulatorEngine` to a real serial
 * port via `SerialTransport`, logs framer/router activity to stdout
 * according to the configured log level and offers a small interactive
 * REPL on stdin for inspecting and patching state at runtime.
 *
 * All testable building blocks (argument parser, command parser, value
 * formatters) are exported so unit tests can exercise them without
 * touching any I/O. The `main()` function is pure orchestration.
 */

import * as readline from 'node:readline';
import process from 'node:process';

import { findByName } from '../../src/protocol/index.js';

import { SimulatorEngine, type SimulatorEvent } from './engine.js';
import { SerialTransport, type TransportLogLevel } from './transport-serial.js';

export type LogLevel = 'silent' | 'summary' | 'hex';

const VALID_LOG_LEVELS: readonly LogLevel[] = ['silent', 'summary', 'hex'];

const DEFAULT_BAUD = 9600;
const DEFAULT_LOG_LEVEL: LogLevel = 'summary';

const HELP_TEXT = `Usage: heishamon-sim --device <path> [--baud <rate>] [--log-level <level>]

Options:
  --device   <path>      Serial device path, e.g. /dev/ttyUSB0  (required)
  --baud     <rate>      Baud rate                              (default: ${DEFAULT_BAUD})
  --log-level <l>        'silent' | 'summary' | 'hex'           (default: '${DEFAULT_LOG_LEVEL}')
  --help                 Show this message and exit
`;

const REPL_HELP_TEXT = `Commands:
  get                    Print every state value (sorted by topic name)
  get <topic>            Print a single state value
  set <topic> <value>    Update a state value; numbers are parsed with parseFloat,
                         string topics (Error, Heat_Pump_Model) take the raw text;
                         wrap a value in double quotes to keep embedded spaces.
  help                   Show this help
  quit | exit            Close the port and exit
`;

/**
 * Result of parsing the command line. Either a valid configuration, the
 * special `help` marker (user asked for --help) or a parser error with a
 * message intended for stderr.
 */
export type ParsedArgs =
  | { readonly kind: 'config'; readonly device: string; readonly baud: number; readonly logLevel: LogLevel }
  | { readonly kind: 'help' }
  | { readonly kind: 'error'; readonly error: string };

/**
 * Parse the simulator's command-line arguments. `argv` is the trimmed
 * list (without `node` and the script path) so the function is easy to
 * call from tests.
 */
export function parseArgs(argv: readonly string[]): ParsedArgs {
  let device: string | null = null;
  let baud: number = DEFAULT_BAUD;
  let logLevel: LogLevel = DEFAULT_LOG_LEVEL;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      return { kind: 'help' };
    }
    if (arg === '--device') {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) {
        return { kind: 'error', error: '--device requires a value' };
      }
      device = value;
      index += 1;
      continue;
    }
    if (arg === '--baud') {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) {
        return { kind: 'error', error: '--baud requires a value' };
      }
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
        return { kind: 'error', error: `--baud must be a positive integer, got '${value}'` };
      }
      baud = parsed;
      index += 1;
      continue;
    }
    if (arg === '--log-level') {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) {
        return { kind: 'error', error: '--log-level requires a value' };
      }
      if (!isLogLevel(value)) {
        return {
          kind: 'error',
          error: `--log-level must be one of ${VALID_LOG_LEVELS.join(', ')}, got '${value}'`,
        };
      }
      logLevel = value;
      index += 1;
      continue;
    }
    return { kind: 'error', error: `unknown option '${arg ?? ''}'` };
  }

  if (device === null) {
    return { kind: 'error', error: 'missing required option --device' };
  }

  return { kind: 'config', device, baud, logLevel };
}

function isLogLevel(value: string): value is LogLevel {
  return (VALID_LOG_LEVELS as readonly string[]).includes(value);
}

/**
 * Result of parsing one REPL command line. Discriminated union so callers
 * cannot accidentally use a `topic` field on a `quit` command.
 */
export type ParsedCommand =
  | { readonly kind: 'empty' }
  | { readonly kind: 'help' }
  | { readonly kind: 'quit' }
  | { readonly kind: 'get' }
  | { readonly kind: 'getOne'; readonly topic: string }
  | { readonly kind: 'set'; readonly topic: string; readonly rawValue: string }
  | { readonly kind: 'unknown' };

/**
 * Parse a single REPL line. We deliberately keep this stateless and side
 * effect free so the test suite can exercise every branch.
 *
 * `set` is parsed in two stages: first we split off the topic, then we
 * take the rest of the line as the raw value. A leading-and-trailing
 * double-quoted rest is unwrapped so values can carry embedded spaces.
 */
export function parseCommand(line: string): ParsedCommand {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return { kind: 'empty' };
  }

  const [head, ...rest] = trimmed.split(/\s+/);
  const command = (head ?? '').toLowerCase();

  if (command === 'help') {
    return { kind: 'help' };
  }
  if (command === 'quit' || command === 'exit') {
    return { kind: 'quit' };
  }
  if (command === 'get') {
    if (rest.length === 0) {
      return { kind: 'get' };
    }
    if (rest.length === 1) {
      const topic = rest[0] ?? '';
      return { kind: 'getOne', topic };
    }
    return { kind: 'unknown' };
  }
  if (command === 'set') {
    if (rest.length < 2) {
      return { kind: 'unknown' };
    }
    const topic = rest[0] ?? '';
    const rawValue = unquoteIfQuoted(rest.slice(1).join(' '));
    return { kind: 'set', topic, rawValue };
  }
  return { kind: 'unknown' };
}

/**
 * Strip surrounding double quotes from `value` if both ends are quoted.
 * The simulator REPL uses this so values like "DE AD BE EF" can keep
 * their embedded spaces; unquoted values pass through unchanged.
 */
function unquoteIfQuoted(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  return value;
}

/**
 * Format a single state value for the REPL `get` / `get <topic>` output.
 * Numbers are rendered with at most three decimals; strings pass through
 * verbatim.
 */
export function formatStateValue(name: string, value: number | string): string {
  if (typeof value === 'number') {
    const rounded = Math.round(value * 1000) / 1000;
    return `${name}=${rounded}`;
  }
  return `${name}=${value}`;
}

/**
 * Render `bytes` as a multi-line hex dump with 16 bytes per line and a
 * 4-digit offset prefix. Returns an empty string for empty input.
 */
export function formatHexDump(bytes: Uint8Array): string {
  if (bytes.length === 0) {
    return '';
  }
  const lines: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 16) {
    const slice = bytes.subarray(offset, offset + 16);
    const hex = Array.from(slice, (byte) => byte.toString(16).padStart(2, '0')).join(' ');
    lines.push(`${offset.toString(16).padStart(4, '0')}  ${hex}`);
  }
  return lines.join('\n');
}

/**
 * Coerce a raw REPL value into the type the target topic expects.
 * Returns either the typed value or a human-readable error message.
 */
export function coerceSetValue(
  topic: string,
  rawValue: string,
): { readonly ok: true; readonly value: number | string } | { readonly ok: false; readonly error: string } {
  const datapoint = findByName(topic);
  if (datapoint === undefined) {
    return { ok: false, error: `unknown topic '${topic}'` };
  }
  if (isStringTopic(topic)) {
    return { ok: true, value: rawValue };
  }
  const parsed = parseFloat(rawValue);
  if (!Number.isFinite(parsed)) {
    return { ok: false, error: `value '${rawValue}' is not a number` };
  }
  return { ok: true, value: parsed };
}

function isStringTopic(topic: string): boolean {
  return topic === 'Error' || topic === 'Heat_Pump_Model';
}

/**
 * Format a `<-` line for the `summary` log level. Mirrors the simulator
 * router's vocabulary so it is easy to correlate REPL output with the
 * documented frame types.
 */
function formatSummary(event: SimulatorEvent): string {
  const { framerEvent, routerResult } = event;
  if (framerEvent.kind === 'invalid') {
    return `<- invalid (${framerEvent.reason}, ${framerEvent.bytes.length} byte${framerEvent.bytes.length === 1 ? '' : 's'} discarded)`;
  }
  const incoming = `${framerEvent.frameType} (${framerEvent.frame.length} bytes)`;
  if (routerResult === null) {
    return `<- ${incoming}`;
  }
  if (routerResult.response !== null) {
    return `<- ${incoming} -> response (${routerResult.response.length} bytes)`;
  }
  const changedNames = Object.keys(routerResult.stateChanges);
  if (changedNames.length > 0) {
    const updates = changedNames
      .map((name) => `${name}=${stringifyChangeValue(routerResult.stateChanges[name])}`)
      .join(', ');
    return `<- ${incoming} -> updated: ${updates}`;
  }
  return `<- ${incoming} -> ${routerResult.summary}`;
}

function stringifyChangeValue(value: number | string | undefined): string {
  if (value === undefined) {
    return '';
  }
  return typeof value === 'string' ? JSON.stringify(value) : String(value);
}

function timestamp(): string {
  return new Date().toISOString();
}

interface ConsoleLike {
  log: (message: string) => void;
  error: (message: string) => void;
}

/**
 * Render a transport-level log message (open/close/error) to stdout.
 */
function makeTransportLogger(out: ConsoleLike): (level: TransportLogLevel, message: string) => void {
  return (level, message) => {
    const line = `[${timestamp()}] ${level}: ${message}`;
    if (level === 'error') {
      out.error(line);
      return;
    }
    out.log(line);
  };
}

/**
 * Build the `onEvent` callback handed to the serial transport. Honors
 * the configured log level: silent suppresses everything, summary prints
 * one line per event, hex appends a multi-line hex dump of the frame.
 */
function makeEventLogger(
  logLevel: LogLevel,
  out: ConsoleLike,
): ((event: SimulatorEvent) => void) | undefined {
  if (logLevel === 'silent') {
    return undefined;
  }
  return (event) => {
    const summaryLine = `[${timestamp()}] ${formatSummary(event)}`;
    out.log(summaryLine);
    if (logLevel !== 'hex') {
      return;
    }
    const bytes = event.framerEvent.kind === 'frame' ? event.framerEvent.frame : event.framerEvent.bytes;
    const dump = formatHexDump(bytes);
    if (dump.length > 0) {
      out.log(dump);
    }
  };
}

/**
 * Handle a single, already-parsed REPL command against the live engine.
 * Side effects (printing, mutating state) happen here; the caller deals
 * with the lifecycle event triggered by `quit`.
 *
 * Returns `true` if the REPL should shut down after this command.
 */
function executeCommand(
  command: ParsedCommand,
  engine: SimulatorEngine,
  out: ConsoleLike,
): boolean {
  switch (command.kind) {
    case 'empty':
      return false;
    case 'help':
      out.log(REPL_HELP_TEXT);
      return false;
    case 'quit':
      return true;
    case 'get': {
      const names = Object.keys(engine.state).sort();
      for (const name of names) {
        const value = engine.state[name];
        if (value === undefined) {
          continue;
        }
        out.log(formatStateValue(name, value));
      }
      return false;
    }
    case 'getOne': {
      if (findByName(command.topic) === undefined) {
        out.error(`unknown topic '${command.topic}'`);
        return false;
      }
      const value = engine.state[command.topic];
      if (value === undefined) {
        out.error(`no value for topic '${command.topic}'`);
        return false;
      }
      out.log(formatStateValue(command.topic, value));
      return false;
    }
    case 'set': {
      const coerced = coerceSetValue(command.topic, command.rawValue);
      if (!coerced.ok) {
        out.error(coerced.error);
        return false;
      }
      engine.updateState({ [command.topic]: coerced.value });
      out.log(formatStateValue(command.topic, coerced.value));
      return false;
    }
    case 'unknown':
      out.error("unknown command, try 'help'");
      return false;
  }
}

/**
 * Top-level orchestration. Reads argv, opens the serial port, starts
 * the REPL and wires Ctrl+C to a clean shutdown.
 */
async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.kind === 'help') {
    process.stdout.write(HELP_TEXT);
    return;
  }
  if (parsed.kind === 'error') {
    process.stderr.write(`error: ${parsed.error}\n\n${HELP_TEXT}`);
    process.exitCode = 2;
    return;
  }

  const out: ConsoleLike = {
    log: (message) => process.stdout.write(`${message}\n`),
    error: (message) => process.stderr.write(`${message}\n`),
  };

  const engine = new SimulatorEngine();
  const transport = new SerialTransport(engine, {
    path: parsed.device,
    baudRate: parsed.baud,
    log: makeTransportLogger(out),
    ...(makeEventLogger(parsed.logLevel, out) !== undefined
      ? { onEvent: makeEventLogger(parsed.logLevel, out) as (event: SimulatorEvent) => void }
      : {}),
  });

  try {
    await transport.open();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`failed to open ${parsed.device}: ${message}\n`);
    process.exitCode = 1;
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'sim> ',
  });

  let shuttingDown = false;
  const shutdown = async (): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    rl.close();
    try {
      await transport.close();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`failed to close ${parsed.device}: ${message}\n`);
    }
  };

  rl.on('line', (line) => {
    const command = parseCommand(line);
    const done = executeCommand(command, engine, out);
    if (done) {
      void shutdown();
      return;
    }
    rl.prompt();
  });

  rl.on('close', () => {
    void shutdown();
  });

  process.on('SIGINT', () => {
    process.stdout.write('\n');
    void shutdown();
  });
  process.on('SIGTERM', () => {
    void shutdown();
  });

  rl.prompt();
}

// Only run the CLI when this module is executed directly (not when
// imported from a unit test). `import.meta.url` is the file URL of this
// module; `process.argv[1]` is the script path Node was invoked with.
const invokedDirectly =
  typeof process.argv[1] === 'string' &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (invokedDirectly) {
  void main();
}
