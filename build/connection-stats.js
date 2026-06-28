/**
 * Connection-quality tracking for the adapter.
 *
 * `ConnectionStats` is a pure, side-effect-free book-keeping class that the
 * adapter feeds with two kinds of events:
 *
 *  - `recordSent()` — a poll frame was just written to the wire (normal mode).
 *  - `recordReceived(crcOk)` — a frame came back from the heat pump; the
 *     boolean says whether the CRC matched.
 *
 * It maintains four lifetime counters (frames sent/received/CRC-ok/CRC-fail)
 * and a sliding-window quality metric over the last `windowSize` ping-pongs.
 *
 * Two scoring modes are intentionally not encoded as an explicit flag; the
 * caller decides which mutators it invokes:
 *
 *  - **Normal mode (active polling):** call `recordSent()` for every poll,
 *    then either `recordReceived(crcOk)` when the response arrives, or
 *    `markPendingAsTimeout()` right before the *next* poll if the previous
 *    response never came back. One slot per poll, true ↔ CRC-ok response,
 *    false ↔ timeout or CRC-fail.
 *
 *  - **Listen-only mode (read-only / parallel HeishaMon):** never call
 *    `recordSent()`. Each `recordReceived(crcOk)` is one window slot.
 *
 * The class deliberately knows nothing about ioBroker, timers, or the
 * concept of polling itself — that keeps it trivially unit-testable.
 */
const DEFAULT_WINDOW_SIZE = 20;
export class ConnectionStats {
    windowSize;
    framesSent = 0;
    framesReceived = 0;
    framesCrcOk = 0;
    framesCrcFail = 0;
    // Ring buffer of recent ping-pong / received-frame outcomes.
    // We keep a fixed-capacity array plus a write index for O(1) appends
    // and `length` semantics that match "how many slots are actually used".
    slots = [];
    writeIndex = 0;
    // True when the last `recordSent()` has not yet been resolved by either
    // a `recordReceived()` or a `markPendingAsTimeout()`. Used only in
    // normal mode; listen-only callers ignore it because they never call
    // `recordSent()`.
    pendingSent = false;
    constructor(options = {}) {
        const size = options.windowSize ?? DEFAULT_WINDOW_SIZE;
        if (!Number.isInteger(size) || size <= 0) {
            throw new Error(`ConnectionStats: windowSize must be a positive integer, got ${size}`);
        }
        this.windowSize = size;
    }
    /**
     * Record that a poll frame was just sent on the wire. The corresponding
     * slot in the sliding window is opened as "pending" and resolved later
     * by the next `recordReceived()` or `markPendingAsTimeout()` call.
     */
    recordSent() {
        this.framesSent += 1;
        this.pendingSent = true;
    }
    /**
     * Record that a frame arrived from the heat pump. Increments the
     * received counter and the appropriate CRC counter, and:
     *
     *  - in normal mode, resolves the pending `recordSent()` slot with the
     *    CRC verdict;
     *  - in listen-only mode (no pending sent), appends one slot directly
     *    to the window.
     */
    recordReceived(crcOk) {
        this.framesReceived += 1;
        if (crcOk) {
            this.framesCrcOk += 1;
        }
        else {
            this.framesCrcFail += 1;
        }
        if (this.pendingSent) {
            this.pendingSent = false;
            this.pushSlot(crcOk);
            return;
        }
        this.pushSlot(crcOk);
    }
    /**
     * Resolve a still-open `recordSent()` slot as a timeout (slot = false).
     * No-op when there is no pending sent — typically invoked right before
     * the next poll tick.
     */
    markPendingAsTimeout() {
        if (!this.pendingSent) {
            return;
        }
        this.pendingSent = false;
        this.pushSlot(false);
    }
    /** Current counters and quality percentage. */
    snapshot() {
        return {
            framesSent: this.framesSent,
            framesReceived: this.framesReceived,
            framesCrcOk: this.framesCrcOk,
            framesCrcFail: this.framesCrcFail,
            connectionQuality: this.computeQuality(),
        };
    }
    pushSlot(value) {
        if (this.slots.length < this.windowSize) {
            this.slots.push(value);
            this.writeIndex = this.slots.length % this.windowSize;
            return;
        }
        this.slots[this.writeIndex] = value;
        this.writeIndex = (this.writeIndex + 1) % this.windowSize;
    }
    computeQuality() {
        if (this.slots.length === 0) {
            return 0;
        }
        let good = 0;
        for (const slot of this.slots) {
            if (slot) {
                good += 1;
            }
        }
        return Math.round((good / this.slots.length) * 100);
    }
}
//# sourceMappingURL=connection-stats.js.map