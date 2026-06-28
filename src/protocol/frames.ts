/**
 * Frame type catalogue for the Panasonic CN-CNT protocol.
 *
 * This module knows three things and three things only:
 *   1. The seven well-known frame types and how to identify them from
 *      the first 4 header bytes.
 *   2. The fixed total length (header + payload + checksum) of each type.
 *   3. The pre-built send-side templates (handshake, polls, set, optional
 *      PCB). The two response frame types are emitted by the heat pump
 *      and intentionally have no template here.
 *
 * No encoding logic and no decoding logic live in this file. See
 * `crc.ts` for checksum handling and `decoder.ts` for response parsing.
 */

import { computeChecksum } from './crc.js';

/**
 * The seven well-known frame types of the Panasonic CN-CNT protocol.
 * Each one is uniquely identified by its 4-byte header signature.
 */
export type FrameType =
  | 'initialHandshake'
  | 'mainPoll'
  | 'extraPoll'
  | 'mainResponse'
  | 'extraResponse'
  | 'mainSet'
  | 'optionalPcbPoll';

/**
 * The 4-byte header signature that identifies each frame type.
 * These are facts about the wire protocol, not implementation choices.
 */
const FRAME_HEADERS: Readonly<Record<FrameType, readonly [number, number, number, number]>> = {
  initialHandshake: [0x31, 0x05, 0x10, 0x01],
  mainPoll: [0x71, 0x6c, 0x01, 0x10],
  extraPoll: [0x71, 0x6c, 0x01, 0x21],
  mainResponse: [0x71, 0xc8, 0x01, 0x10],
  extraResponse: [0x71, 0xc8, 0x01, 0x21],
  mainSet: [0xf1, 0x6c, 0x01, 0x10],
  optionalPcbPoll: [0xf1, 0x11, 0x01, 0x50],
};

/**
 * Total length in bytes for each frame type, INCLUDING the trailing
 * checksum byte.
 */
export const FRAME_LENGTHS: Readonly<Record<FrameType, number>> = {
  initialHandshake: 8,
  mainPoll: 111,
  extraPoll: 111,
  mainResponse: 203,
  extraResponse: 203,
  mainSet: 111,
  optionalPcbPoll: 20,
};

/**
 * Initial-handshake payload (7 bytes, no checksum).
 * Sent once at boot to wake the heat pump.
 */
const INITIAL_HANDSHAKE_PAYLOAD: readonly number[] = [0x31, 0x05, 0x10, 0x01, 0x00, 0x00, 0x00];

/**
 * Optional-PCB-poll payload (19 bytes, no checksum). Unlike the other
 * templates this is NOT all-zero past the header — the trailing bytes
 * encode the default state HeishaMon advertises to the heat pump.
 */
const OPTIONAL_PCB_PAYLOAD: readonly number[] = [
  0xf1, 0x11, 0x01, 0x50, 0x00, 0x00, 0x40, 0xff, 0xff, 0xe5, 0xff, 0xff, 0x00, 0xff, 0xeb, 0xff,
  0xff, 0x00, 0x00,
];

/**
 * Identify a frame from its first 4 bytes. Returns `null` if the header
 * does not match any known signature or if the buffer is shorter than
 * 4 bytes. Does NOT verify total length or checksum — that is the
 * caller's responsibility.
 */
export function identifyFrame(frame: Uint8Array): FrameType | null {
  if (frame.length < 4) {
    return null;
  }
  for (const type of Object.keys(FRAME_HEADERS) as FrameType[]) {
    const header = FRAME_HEADERS[type];
    if (
      frame[0] === header[0] &&
      frame[1] === header[1] &&
      frame[2] === header[2] &&
      frame[3] === header[3]
    ) {
      return type;
    }
  }
  return null;
}

/**
 * Build a fresh, mutable payload buffer for the requested frame type.
 * The returned buffer has length `FRAME_LENGTHS[type] - 1`: it contains
 * the header and any default body bytes, but NOT the trailing checksum.
 *
 * Callers are free to mutate the buffer and must append the checksum
 * (see `computeChecksum`) before sending.
 *
 * @throws RangeError for `mainResponse` / `extraResponse` — those frames
 *   are emitted by the heat pump and have no send-side template.
 */
export function createTemplate(type: FrameType): Uint8Array {
  switch (type) {
    case 'initialHandshake':
      return Uint8Array.from(INITIAL_HANDSHAKE_PAYLOAD);
    case 'optionalPcbPoll':
      return Uint8Array.from(OPTIONAL_PCB_PAYLOAD);
    case 'mainPoll':
    case 'extraPoll':
    case 'mainSet':
      return buildZeroPaddedTemplate(type);
    case 'mainResponse':
    case 'extraResponse':
      throw new RangeError(
        `cannot create a send-side template for ${type}: response frames are emitted by the heat pump`,
      );
  }
}

/**
 * Build a complete, sendable frame: take the template for `type`, let the
 * optional `mutate` callback patch the payload in place, then append the
 * checksum byte. Returns a new Uint8Array of length `FRAME_LENGTHS[type]`.
 */
export function buildFrame(type: FrameType, mutate?: (payload: Uint8Array) => void): Uint8Array {
  const payload = createTemplate(type);
  mutate?.(payload);

  const frame = new Uint8Array(payload.length + 1);
  frame.set(payload, 0);
  frame[payload.length] = computeChecksum(payload);
  return frame;
}

/**
 * Build a 110-byte all-zero-padded payload for one of the three frame
 * types that share that layout (mainPoll, extraPoll, mainSet). Only the
 * 4-byte header differs between them.
 */
function buildZeroPaddedTemplate(type: 'mainPoll' | 'extraPoll' | 'mainSet'): Uint8Array {
  const payloadLength = FRAME_LENGTHS[type] - 1;
  const payload = new Uint8Array(payloadLength);
  const header = FRAME_HEADERS[type];
  payload[0] = header[0];
  payload[1] = header[1];
  payload[2] = header[2];
  payload[3] = header[3];
  return payload;
}
