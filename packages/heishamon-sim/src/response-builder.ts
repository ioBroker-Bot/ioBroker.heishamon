/**
 * Response-frame builders for the heat-pump simulator.
 *
 * Translates a `HeatPumpState` into the two response frame types the
 * simulator transmits on the wire:
 *   - `mainResponse`  (header `0x71 0xC8 0x01 0x10`, 203 bytes)
 *   - `extraResponse` (header `0x71 0xC8 0x01 0x21`, 203 bytes)
 *
 * The translation table is driven by `MAIN_DATAPOINTS` / `EXTRA_DATAPOINTS`
 * from `heishamon-protocol`: for each datapoint we look up its state
 * value, encode it according to the documented decoder kind, and OR the
 * resulting bits into the output frame. Multiple datapoints share a
 * single byte (e.g. byte 7 carries three independent fields) so the
 * builder MUST OR-merge bit-field contributions rather than overwrite
 * the whole byte.
 *
 * Out-of-range numeric values are clamped (not thrown) so the simulator
 * never produces an invalid frame; that mirrors what the real heat pump
 * does on its wire encoder. The frame's trailing checksum is written
 * last.
 */

import {
  computeChecksum,
  EXTRA_DATAPOINTS,
  FRAME_LENGTHS,
  MAIN_DATAPOINTS,
  type DataPoint,
  type DecoderKind,
} from 'heishamon-protocol';

import type { HeatPumpState } from './state.js';

const MAIN_FRAME_LENGTH = FRAME_LENGTHS.mainResponse;
const EXTRA_FRAME_LENGTH = FRAME_LENGTHS.extraResponse;
const CHECKSUM_OFFSET_MAIN = MAIN_FRAME_LENGTH - 1;
const CHECKSUM_OFFSET_EXTRA = EXTRA_FRAME_LENGTH - 1;

const MAIN_HEADER: readonly [number, number, number, number] = [0x71, 0xc8, 0x01, 0x10];
const EXTRA_HEADER: readonly [number, number, number, number] = [0x71, 0xc8, 0x01, 0x21];

/**
 * Reverse-lookup table for `getOpMode`. Index = canonical mode value
 * (0..8), value = byte to write. Mirrors the table in `decoders.ts`.
 */
const OP_MODE_BYTES: readonly number[] = [18, 19, 25, 33, 34, 35, 41, 26, 42];

/**
 * Build a complete 203-byte mainResponse frame from a heat-pump state.
 * Header bytes are placed at offsets 0..3, the payload is built by
 * encoding each datapoint into its target byte(s), and the checksum is
 * written at offset 202.
 */
export function buildMainResponse(state: HeatPumpState): Uint8Array {
  const frame = new Uint8Array(MAIN_FRAME_LENGTH);
  writeHeader(frame, MAIN_HEADER);

  for (const datapoint of MAIN_DATAPOINTS) {
    const value = state[datapoint.name];
    if (value === undefined) {
      continue;
    }
    encodeMainDatapoint(frame, datapoint, value);
  }

  writeChecksum(frame, CHECKSUM_OFFSET_MAIN);
  return frame;
}

/**
 * Build a complete 203-byte extraResponse frame from state. Only the
 * six XTOP datapoints contribute; all other bytes remain zero. The
 * checksum is written at offset 202.
 */
export function buildExtraResponse(state: HeatPumpState): Uint8Array {
  const frame = new Uint8Array(EXTRA_FRAME_LENGTH);
  writeHeader(frame, EXTRA_HEADER);

  for (const datapoint of EXTRA_DATAPOINTS) {
    const value = state[datapoint.name];
    if (value === undefined) {
      continue;
    }
    if (typeof value !== 'number') {
      continue;
    }
    // All XTOPs are getUintt16: little-endian raw = value + 1.
    writeUint16LE(frame, datapoint.byte, clampUint16(value + 1));
  }

  writeChecksum(frame, CHECKSUM_OFFSET_EXTRA);
  return frame;
}

function writeHeader(
  frame: Uint8Array,
  header: readonly [number, number, number, number],
): void {
  frame[0] = header[0];
  frame[1] = header[1];
  frame[2] = header[2];
  frame[3] = header[3];
}

function writeChecksum(frame: Uint8Array, checksumOffset: number): void {
  // computeChecksum operates on the payload (everything except the
  // trailing byte). We pass a view that excludes the trailing slot.
  const payload = frame.subarray(0, checksumOffset);
  frame[checksumOffset] = computeChecksum(payload);
}

function encodeMainDatapoint(
  frame: Uint8Array,
  datapoint: DataPoint,
  value: number | string,
): void {
  if (datapoint.decoder === 'unknown') {
    encodeSpecialMainDatapoint(frame, datapoint, value);
    return;
  }
  if (typeof value !== 'number') {
    // All non-'unknown' decoders consume numbers; ignore string values
    // that would otherwise produce NaN.
    return;
  }
  encodeByDecoderKind(frame, datapoint.decoder, datapoint.byte, value);
}

function encodeByDecoderKind(
  frame: Uint8Array,
  kind: DecoderKind,
  byte: number,
  value: number,
): void {
  switch (kind) {
    case 'getIntMinus128':
      frame[byte] = clampByte(value + 128);
      return;
    case 'getIntMinus1':
      frame[byte] = clampByte(value + 1);
      return;
    case 'getIntMinus1Times10':
      frame[byte] = clampByte(Math.round(value / 10) + 1);
      return;
    case 'getIntMinus1Times50':
      frame[byte] = clampByte(Math.round(value / 50) + 1);
      return;
    case 'getIntMinus1Div5':
      frame[byte] = clampByte(Math.round(value * 5) + 1);
      return;
    case 'getIntMinus1Div50':
      frame[byte] = clampByte(Math.round(value * 50) + 1);
      return;
    case 'getPower':
      frame[byte] = clampByte(Math.round(value / 200) + 1);
      return;
    case 'getValvePID':
      frame[byte] = clampByte(Math.round(value * 2) + 1);
      return;
    case 'getOpMode': {
      const mapped = OP_MODE_BYTES[value];
      if (mapped !== undefined) {
        // OR-merge: byte 6 is shared with Zones_State (top 2 bits).
        frame[byte] = (frame[byte] ?? 0) | mapped;
      }
      return;
    }
    case 'getUintt16':
      writeUint16LE(frame, byte, clampUint16(value + 1));
      return;
    case 'getBit1':
      mergeBits(frame, byte, value & 0b1, 7);
      return;
    case 'getBit1and2':
      mergeBits(frame, byte, (value + 1) & 0b11, 6);
      return;
    case 'getBit3and4':
      mergeBits(frame, byte, (value + 1) & 0b11, 4);
      return;
    case 'getBit3and4and5':
      mergeBits(frame, byte, (value + 1) & 0b111, 3);
      return;
    case 'getBit5and6':
      mergeBits(frame, byte, (value + 1) & 0b11, 2);
      return;
    case 'getBit7and8':
      mergeBits(frame, byte, (value + 1) & 0b11, 0);
      return;
    case 'getRight3bits':
      mergeBits(frame, byte, (value + 1) & 0b111, 0);
      return;
    case 'getFirstByte':
      mergeBits(frame, byte, (value + 1) & 0x0f, 4);
      return;
    case 'getSecondByte':
      mergeBits(frame, byte, (value + 1) & 0x0f, 0);
      return;
    case 'unknown':
    case 'getErrorInfo':
    case 'getPumpFlow':
    case 'getOptDataValue':
    case 'getDataValue':
      // Handled by encodeSpecialMainDatapoint or simply not used in
      // the main-frame builder.
      return;
  }
}

/**
 * Dispatcher for the seven main-frame topics whose decoder is `unknown`.
 * Each one has a bespoke byte layout that can't be expressed by the
 * generic decoder kinds above.
 */
function encodeSpecialMainDatapoint(
  frame: Uint8Array,
  datapoint: DataPoint,
  value: number | string,
): void {
  switch (datapoint.name) {
    case 'Pump_Flow':
      if (typeof value === 'number') {
        encodePumpFlow(frame, value);
      }
      return;
    case 'Operations_Hours':
      if (typeof value === 'number') {
        writeUint16LE(frame, 182, clampUint16(value + 1));
      }
      return;
    case 'Operations_Counter':
      if (typeof value === 'number') {
        writeUint16LE(frame, 179, clampUint16(value + 1));
      }
      return;
    case 'Room_Heater_Operations_Hours':
      if (typeof value === 'number') {
        writeUint16LE(frame, 185, clampUint16(value + 1));
      }
      return;
    case 'DHW_Heater_Operations_Hours':
      if (typeof value === 'number') {
        writeUint16LE(frame, 188, clampUint16(value + 1));
      }
      return;
    case 'Error':
      encodeError(frame, typeof value === 'string' ? value : 'No error');
      return;
    case 'Heat_Pump_Model':
      encodeHeatPumpModel(frame, typeof value === 'string' ? value : '');
      return;
    default:
      return;
  }
}

/**
 * Encode `Pump_Flow` (l/min) as the inverse of `getPumpFlow`:
 *   byte 170 = floor(value)
 *   byte 169 = round((value - floor(value)) * 256) + 1
 *
 * Negative or NaN inputs are treated as 0.
 */
function encodePumpFlow(frame: Uint8Array, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    frame[170] = 0;
    frame[169] = clampByte(1);
    return;
  }
  const integerPart = Math.floor(value);
  const fractionalPart = value - integerPart;
  frame[170] = clampByte(integerPart);
  frame[169] = clampByte(Math.round(fractionalPart * 256) + 1);
}

/**
 * Encode the error code into bytes 113/114. Recognised forms:
 *   - `""` or `"No error"` -> both bytes zero
 *   - `"F<hex>"` -> byte 113 = 0xB1, byte 114 = parseInt(hex, 16) + 17
 *   - `"H<hex>"` -> byte 113 = 0xA1, byte 114 = parseInt(hex, 16) + 17
 *
 * Anything else is treated as "no error".
 */
function encodeError(frame: Uint8Array, value: string): void {
  if (value === '' || value === 'No error') {
    frame[113] = 0;
    frame[114] = 0;
    return;
  }
  const prefix = value.charAt(0).toUpperCase();
  const number = parseInt(value.slice(1), 16);
  if (Number.isNaN(number)) {
    frame[113] = 0;
    frame[114] = 0;
    return;
  }
  if (prefix === 'F') {
    frame[113] = 0xb1;
    frame[114] = clampByte(number + 17);
    return;
  }
  if (prefix === 'H') {
    frame[113] = 0xa1;
    frame[114] = clampByte(number + 17);
    return;
  }
  frame[113] = 0;
  frame[114] = 0;
}

/**
 * Parse the canonical 10-byte hex model string ("E2 CE 0D 71 81 72 CE
 * 0C 92 81") into bytes 129..138. Unparseable strings silently produce
 * 10 zero bytes.
 */
function encodeHeatPumpModel(frame: Uint8Array, value: string): void {
  const tokens = value.trim().split(/\s+/);
  for (let index = 0; index < 10; index++) {
    const offset = 129 + index;
    if (index >= tokens.length) {
      frame[offset] = 0;
      continue;
    }
    const byte = parseInt(tokens[index]!, 16);
    frame[offset] = Number.isNaN(byte) ? 0 : clampByte(byte);
  }
}

/**
 * OR-merge `value` (a small unsigned integer already masked to the
 * width of the target sub-field) into `frame[byte]`, shifted left by
 * `shift` bits. Bit-field decoders share a single byte across topics,
 * so we never overwrite — only OR.
 */
function mergeBits(frame: Uint8Array, byte: number, value: number, shift: number): void {
  frame[byte] = (frame[byte] ?? 0) | ((value & 0xff) << shift);
}

function writeUint16LE(frame: Uint8Array, byte: number, raw: number): void {
  frame[byte] = raw & 0xff;
  frame[byte + 1] = (raw >> 8) & 0xff;
}

function clampByte(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 0xff) {
    return 0xff;
  }
  return value | 0;
}

function clampUint16(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 0xffff) {
    return 0xffff;
  }
  return value | 0;
}
