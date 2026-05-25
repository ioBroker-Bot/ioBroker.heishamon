/**
 * Byte-stream framer for the Panasonic CN-CNT wire protocol.
 *
 * Serial transports deliver bytes in arbitrary chunks: a single read may
 * contain a partial frame, several frames, or a frame followed by noise.
 * The framer accumulates incoming bytes and emits one event per complete
 * frame (or per byte of unrecoverable noise), so the consumer can treat
 * its input as a clean stream of "well-formed frames" without worrying
 * about chunk boundaries, checksum errors, or resync.
 *
 * The framer is intentionally dumb about frame *contents*: it only knows
 * about header signatures, fixed lengths and the 8-bit checksum. Decoding
 * is the consumer's job.
 */

import { verifyFrame } from './crc.js';
import { FRAME_LENGTHS, identifyFrame, type FrameType } from './frames.js';

/**
 * One event produced by `Framer.push`.
 *
 * `frame` events carry a complete, header-recognised, checksum-validated
 * frame ready for the consumer. `invalid` events carry the bytes that the
 * framer had to discard in order to resynchronise the stream — exposing
 * them lets callers log/forward noise instead of silently swallowing it.
 */
export type FramerEvent =
  | {
      readonly kind: 'frame';
      readonly frameType: FrameType;
      readonly frame: Uint8Array;
    }
  | {
      readonly kind: 'invalid';
      readonly reason: 'checksum' | 'unknownHeader' | 'truncated';
      readonly bytes: Uint8Array;
    };

/**
 * Stateful byte-stream framer. Hold one instance per serial connection
 * and feed every incoming chunk into `push`. The returned array contains
 * the events produced *by that chunk only*; events are not buffered
 * between calls.
 */
export class Framer {
  // Internal accumulator. We keep it as a plain Uint8Array and rebuild
  // it on each consume step — frames are small (max 203 bytes) and chunks
  // arrive a few times per second, so the copy cost is negligible and the
  // code is much easier to read than a ring buffer.
  private buffer: Uint8Array = new Uint8Array(0);

  /**
   * Push bytes from the wire into the framer and return all events
   * produced by this chunk, in arrival order. The framer keeps any
   * partial frame in its internal buffer until the next call.
   */
  push(chunk: Uint8Array): readonly FramerEvent[] {
    this.buffer = concat(this.buffer, chunk);

    const events: FramerEvent[] = [];
    while (this.tryConsumeOne(events)) {
      // tryConsumeOne pushes at most one event per call and returns true
      // iff there might be more to consume; loop until the buffer is
      // either too short to decide or waits for more bytes.
    }
    return events;
  }

  /**
   * Discard any bytes currently held in the internal buffer. Useful when
   * the transport reconnects or the caller knows the upstream stream is
   * out of sync.
   */
  reset(): void {
    this.buffer = new Uint8Array(0);
  }

  /**
   * Try to consume one frame (or one byte of noise) from the buffer.
   * Pushes at most one event into `events` and returns true if the
   * caller should try again, false if the buffer cannot make further
   * progress without more input.
   */
  private tryConsumeOne(events: FramerEvent[]): boolean {
    if (this.buffer.length < 4) {
      // Not enough bytes to even check the header — wait for more.
      return false;
    }

    const frameType = identifyFrame(this.buffer.subarray(0, 4));
    if (frameType === null) {
      // Unknown header: drop a single byte and try again. Dropping the
      // whole 4-byte window would risk skipping over a valid header that
      // begins at offset 1, 2 or 3.
      events.push({
        kind: 'invalid',
        reason: 'unknownHeader',
        bytes: this.buffer.slice(0, 1),
      });
      this.buffer = this.buffer.slice(1);
      return true;
    }

    const expectedLength = FRAME_LENGTHS[frameType];
    if (this.buffer.length < expectedLength) {
      // Known header, but the full frame has not arrived yet — wait.
      return false;
    }

    const candidate = this.buffer.slice(0, expectedLength);
    if (!verifyFrame(candidate)) {
      // The header matched but the checksum is wrong. The safe resync
      // strategy is to drop a single byte and re-evaluate: dropping the
      // entire `expectedLength` window would discard any genuine frame
      // that happens to start a few bytes into the corrupted window. The
      // tradeoff is more `invalid` events for badly-corrupted streams,
      // which is acceptable — they are exactly what a log filter wants.
      events.push({
        kind: 'invalid',
        reason: 'checksum',
        bytes: candidate.slice(0, 1),
      });
      this.buffer = this.buffer.slice(1);
      return true;
    }

    events.push({ kind: 'frame', frameType, frame: candidate });
    this.buffer = this.buffer.slice(expectedLength);
    return true;
  }
}

/**
 * Concatenate two byte arrays into a fresh buffer. Kept private to this
 * module to avoid pulling in a dependency for one trivial helper.
 */
function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.length === 0) {
    return b.slice();
  }
  if (b.length === 0) {
    return a.slice();
  }
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}
