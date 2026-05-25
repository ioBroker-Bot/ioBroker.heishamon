/**
 * Frame router for the heat-pump simulator.
 *
 * Consumes complete, checksum-validated frames coming from the wire,
 * decides whether a response should be sent, and — for set-commands —
 * mutates the simulator's `HeatPumpState` to reflect the new values.
 *
 * The router intentionally has no I/O: it is a pure function over
 * `(frame, state)` plus the documented in-place mutation of `state`.
 * Transport code is responsible for actually writing `response` to the
 * serial port (or returning it from a fake transport).
 */

import {
  MAIN_DATAPOINTS,
  decodeMainFrame,
  identifyFrame,
  type DataPoint,
  type DecoderKind,
  type FrameType,
} from '../../src/protocol/index.js';

import { buildExtraResponse, buildMainResponse } from './response-builder.js';
import { type HeatPumpState } from './state.js';

const MAIN_FRAME_LENGTH = 203;

/**
 * Result of routing a single incoming frame.
 */
export interface RouterResult {
  /** Frame to write back to the wire, or null if no response is sent. */
  readonly response: Uint8Array | null;
  /** Topics whose values were updated by this frame. Empty for read polls. */
  readonly stateChanges: Readonly<Record<string, number | string>>;
  /** Human-readable summary for logging. */
  readonly summary: string;
}

/**
 * Handle a single, complete, checksum-validated incoming frame.
 *
 * Mutates `state` in place when the incoming frame is a write command.
 * Returns the response frame to send (if any) plus a record of state
 * changes for logging.
 *
 * Behaviour per frame type:
 *  - `mainPoll`         -> respond with `buildMainResponse(state)`
 *  - `extraPoll`        -> respond with `buildExtraResponse(state)`
 *  - `mainSet`          -> update state; do NOT respond (HeishaMon
 *                          fire-and-forget pattern, the next mainPoll
 *                          reflects the new values)
 *  - `initialHandshake` -> do NOT respond (TBD — clarified during
 *                          phase-2 hardware testing). Log as "ignored".
 *  - `optionalPcbPoll`  -> do NOT respond (master->WP direction; the
 *                          heat pump does not acknowledge). Log as
 *                          "ignored".
 *  - `mainResponse`,
 *    `extraResponse`    -> these are emitted by the heat pump, not
 *                          received. Log as "unexpected" and return
 *                          null.
 *  - unknown header     -> log as "unrecognized" and return null.
 */
export function handleIncomingFrame(
  frame: Uint8Array,
  state: HeatPumpState,
): RouterResult {
  const frameType = identifyFrame(frame);
  if (frameType === null) {
    return {
      response: null,
      stateChanges: {},
      summary: `unrecognized frame (${frame.length} bytes)`,
    };
  }
  return routeByType(frameType, frame, state);
}

function routeByType(
  frameType: FrameType,
  frame: Uint8Array,
  state: HeatPumpState,
): RouterResult {
  switch (frameType) {
    case 'mainPoll':
      return {
        response: buildMainResponse(state),
        stateChanges: {},
        summary: 'mainPoll -> mainResponse',
      };
    case 'extraPoll':
      return {
        response: buildExtraResponse(state),
        stateChanges: {},
        summary: 'extraPoll -> extraResponse',
      };
    case 'mainSet':
      return applySetCommand(frame, state);
    case 'initialHandshake':
      return {
        response: null,
        stateChanges: {},
        summary: 'ignored: initialHandshake',
      };
    case 'optionalPcbPoll':
      return {
        response: null,
        stateChanges: {},
        summary: 'ignored: optionalPcbPoll',
      };
    case 'mainResponse':
    case 'extraResponse':
      return {
        response: null,
        stateChanges: {},
        summary: `unexpected: ${frameType} should be emitted by the heat pump`,
      };
  }
}

/**
 * Decode a `mainSet` frame and apply the changed values to `state`.
 *
 * The frame is mostly all-zero past the 4-byte header; only the bytes
 * that the sender deliberately wrote carry a non-zero value. We detect
 * those bytes per writable datapoint and decode the value from the
 * already-built decoded frame.
 *
 * Two-stage filter to avoid false positives on shared bytes:
 *   1. Skip the datapoint if its underlying byte(s) are all zero — the
 *      sender did not touch this position at all.
 *   2. Skip the datapoint if the decoded value equals the documented
 *      "all-zero-byte default" of its decoder kind. Bit-field decoders
 *      that share a byte with the actually-set field decode their own
 *      bits as zero -> their `... - 1` defaults to -1 (or 0 for
 *      `getBit1`), which is what this check catches.
 *
 * The combination is robust against all current shared-byte cases:
 *  - byte 4 (Heatpump_State + Force_DHW_State): a set to one of them
 *    leaves the other field's bits at zero, so its decoded value is the
 *    default sentinel and we correctly ignore it.
 *  - byte 6 (Operating_Mode_State + Zones_State): same reasoning.
 *  - byte 7 (Quiet_Mode_Level + Powerful_Mode_Time + Quiet_Mode_Schedule):
 *    same reasoning across three fields.
 */
function applySetCommand(frame: Uint8Array, state: HeatPumpState): RouterResult {
  // `decodeMainFrame` is built for the 203-byte response frame; a
  // mainSet is only 111 bytes. We zero-extend it so the decoder can
  // read every documented byte offset. The added zero bytes never
  // cover any byte we actually need (all writable bytes sit in the
  // first 111 bytes), but the decoder loops over all 144 main
  // datapoints regardless, so it must not run off the end.
  const padded = padToMainFrameLength(frame);
  const decoded = decodeMainFrame(padded);
  const stateChanges: Record<string, number | string> = {};

  for (const datapoint of MAIN_DATAPOINTS) {
    if (!datapoint.writable) {
      continue;
    }
    if (!hasNonZeroBytes(frame, datapoint)) {
      continue;
    }
    const decodedValue = decoded[datapoint.name];
    if (decodedValue === undefined) {
      continue;
    }
    if (isAllZeroDefault(datapoint.decoder, decodedValue)) {
      continue;
    }
    state[datapoint.name] = decodedValue;
    stateChanges[datapoint.name] = decodedValue;
  }

  const summary =
    Object.keys(stateChanges).length === 0
      ? 'mainSet: no detectable changes'
      : `mainSet: ${formatStateChanges(stateChanges)}`;

  return { response: null, stateChanges, summary };
}

/**
 * Zero-extend a frame to the 203-byte main-response length so it can be
 * decoded with `decodeMainFrame`. Returns the original buffer if it is
 * already long enough.
 */
function padToMainFrameLength(frame: Uint8Array): Uint8Array {
  if (frame.length >= MAIN_FRAME_LENGTH) {
    return frame;
  }
  const padded = new Uint8Array(MAIN_FRAME_LENGTH);
  padded.set(frame, 0);
  return padded;
}

/**
 * True if any byte covered by `datapoint` in `frame` is non-zero.
 * `getUintt16` reads two bytes; every other decoder reads one.
 */
function hasNonZeroBytes(frame: Uint8Array, datapoint: DataPoint): boolean {
  const primary = frame[datapoint.byte] ?? 0;
  if (primary !== 0) {
    return true;
  }
  if (datapoint.decoder === 'getUintt16') {
    const secondary = frame[datapoint.byte + 1] ?? 0;
    if (secondary !== 0) {
      return true;
    }
  }
  return false;
}

/**
 * True if `decodedValue` equals the value a decoder of kind `kind`
 * produces when its underlying byte(s) are all zero. Used to filter out
 * bit-field decoders that share a byte with the actually-set field —
 * those "see" zero bits and return their default sentinel.
 *
 * For the special-case main-frame decoders (`'unknown'`) we always
 * return `false` (i.e. apply the value). None of the seven special
 * cases are writable in this project, so the case never fires in
 * practice; making it conservative just keeps the function total.
 */
function isAllZeroDefault(kind: DecoderKind, decodedValue: number | string): boolean {
  if (typeof decodedValue !== 'number') {
    return false;
  }
  switch (kind) {
    case 'getBit1':
      // (byte >> 7) on 0x00 -> 0. Real "set to 0" must come from a
      // non-zero byte (the value 1 actually sets a bit), so a decoded
      // 0 here always means "not touched".
      return decodedValue === 0;
    case 'getBit1and2':
    case 'getBit3and4':
    case 'getBit3and4and5':
    case 'getBit5and6':
    case 'getBit7and8':
    case 'getRight3bits':
    case 'getFirstByte':
    case 'getSecondByte':
      return decodedValue === -1;
    case 'getOpMode':
      return decodedValue === -1;
    case 'getIntMinus1':
    case 'getUintt16':
      return decodedValue === -1;
    case 'getIntMinus128':
      return decodedValue === -128;
    case 'getPower':
      return decodedValue === -200;
    case 'getValvePID':
      return decodedValue === -0.5;
    case 'getIntMinus1Times10':
      return decodedValue === -10;
    case 'getIntMinus1Times50':
      return decodedValue === -50;
    case 'getIntMinus1Div5':
      return decodedValue === -0.2;
    case 'getIntMinus1Div50':
      return decodedValue === -0.02;
    case 'unknown':
    case 'getErrorInfo':
    case 'getPumpFlow':
    case 'getOptDataValue':
    case 'getDataValue':
      // No writable datapoint uses these decoders today.
      return false;
  }
}

/**
 * Format a `stateChanges` record as "Name=value, Name=value" for the
 * summary string. Numbers are stringified verbatim; strings are quoted.
 */
function formatStateChanges(changes: Record<string, number | string>): string {
  const parts: string[] = [];
  for (const [name, value] of Object.entries(changes)) {
    parts.push(`${name}=${typeof value === 'string' ? JSON.stringify(value) : value}`);
  }
  return parts.join(', ');
}

