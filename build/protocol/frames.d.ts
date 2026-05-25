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
/**
 * The seven well-known frame types of the Panasonic CN-CNT protocol.
 * Each one is uniquely identified by its 4-byte header signature.
 */
export type FrameType = 'initialHandshake' | 'mainPoll' | 'extraPoll' | 'mainResponse' | 'extraResponse' | 'mainSet' | 'optionalPcbPoll';
/**
 * Total length in bytes for each frame type, INCLUDING the trailing
 * checksum byte.
 */
export declare const FRAME_LENGTHS: Readonly<Record<FrameType, number>>;
/**
 * Identify a frame from its first 4 bytes. Returns `null` if the header
 * does not match any known signature or if the buffer is shorter than
 * 4 bytes. Does NOT verify total length or checksum — that is the
 * caller's responsibility.
 */
export declare function identifyFrame(frame: Uint8Array): FrameType | null;
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
export declare function createTemplate(type: FrameType): Uint8Array;
/**
 * Build a complete, sendable frame: take the template for `type`, let the
 * optional `mutate` callback patch the payload in place, then append the
 * checksum byte. Returns a new Uint8Array of length `FRAME_LENGTHS[type]`.
 */
export declare function buildFrame(type: FrameType, mutate?: (payload: Uint8Array) => void): Uint8Array;
//# sourceMappingURL=frames.d.ts.map