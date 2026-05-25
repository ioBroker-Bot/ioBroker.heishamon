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
import { type FrameType } from './frames.js';
/**
 * One event produced by `Framer.push`.
 *
 * `frame` events carry a complete, header-recognised, checksum-validated
 * frame ready for the consumer. `invalid` events carry the bytes that the
 * framer had to discard in order to resynchronise the stream — exposing
 * them lets callers log/forward noise instead of silently swallowing it.
 */
export type FramerEvent = {
    readonly kind: 'frame';
    readonly frameType: FrameType;
    readonly frame: Uint8Array;
} | {
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
export declare class Framer {
    private buffer;
    /**
     * Push bytes from the wire into the framer and return all events
     * produced by this chunk, in arrival order. The framer keeps any
     * partial frame in its internal buffer until the next call.
     */
    push(chunk: Uint8Array): readonly FramerEvent[];
    /**
     * Discard any bytes currently held in the internal buffer. Useful when
     * the transport reconnects or the caller knows the upstream stream is
     * out of sync.
     */
    reset(): void;
    /**
     * Try to consume one frame (or one byte of noise) from the buffer.
     * Pushes at most one event into `events` and returns true if the
     * caller should try again, false if the buffer cannot make further
     * progress without more input.
     */
    private tryConsumeOne;
}
//# sourceMappingURL=framer.d.ts.map