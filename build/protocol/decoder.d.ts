/**
 * Frame-level decoders.
 *
 * Translates the three HeishaMon CN-CNT response frame types into a
 * `Record<topic, DecodedValue>`. Topic names are identical to the
 * HeishaMon MQTT topic suffixes (case-sensitive).
 *
 * These decoders intentionally do NOT verify the frame's checksum or
 * inspect the header bytes — that is the caller's responsibility (see
 * `verifyFrame` in `crc.ts`). Decoders only require that the frame is
 * long enough for the highest byte offset they read.
 */
import { type DecodedValue } from './decoders.js';
/** Mapping from HeishaMon topic suffix to its decoded value. */
export type DecodedFrame = Record<string, DecodedValue>;
/**
 * Decode a main-frame response.
 *
 * @param frame  the 203-byte main-frame buffer (header + payload + checksum)
 * @throws RangeError if the buffer is shorter than 203 bytes
 */
export declare function decodeMainFrame(frame: Uint8Array): DecodedFrame;
/**
 * Decode an extra-block response (K/L-series).
 *
 * @param frame  the 203-byte extra-block buffer
 * @throws RangeError if the buffer is shorter than 203 bytes
 */
export declare function decodeExtraFrame(frame: Uint8Array): DecodedFrame;
/**
 * Decode an optional-PCB frame.
 *
 * @param frame  the 20-byte optional-PCB buffer
 * @throws RangeError if the buffer is shorter than 20 bytes
 */
export declare function decodeOptionalFrame(frame: Uint8Array): DecodedFrame;
//# sourceMappingURL=decoder.d.ts.map