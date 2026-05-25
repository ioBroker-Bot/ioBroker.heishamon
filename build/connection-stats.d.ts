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
export interface ConnectionStatsSnapshot {
    readonly framesSent: number;
    readonly framesReceived: number;
    readonly framesCrcOk: number;
    readonly framesCrcFail: number;
    /** 0-100, integer. 0 when the window is still empty. */
    readonly connectionQuality: number;
}
export interface ConnectionStatsOptions {
    /** Number of slots in the sliding window. Defaults to 20. */
    readonly windowSize?: number;
}
export declare class ConnectionStats {
    private readonly windowSize;
    private framesSent;
    private framesReceived;
    private framesCrcOk;
    private framesCrcFail;
    private readonly slots;
    private writeIndex;
    private pendingSent;
    constructor(options?: ConnectionStatsOptions);
    /**
     * Record that a poll frame was just sent on the wire. The corresponding
     * slot in the sliding window is opened as "pending" and resolved later
     * by the next `recordReceived()` or `markPendingAsTimeout()` call.
     */
    recordSent(): void;
    /**
     * Record that a frame arrived from the heat pump. Increments the
     * received counter and the appropriate CRC counter, and:
     *
     *  - in normal mode, resolves the pending `recordSent()` slot with the
     *    CRC verdict;
     *  - in listen-only mode (no pending sent), appends one slot directly
     *    to the window.
     */
    recordReceived(crcOk: boolean): void;
    /**
     * Resolve a still-open `recordSent()` slot as a timeout (slot = false).
     * No-op when there is no pending sent — typically invoked right before
     * the next poll tick.
     */
    markPendingAsTimeout(): void;
    /** Current counters and quality percentage. */
    snapshot(): ConnectionStatsSnapshot;
    private pushSlot;
    private computeQuality;
}
//# sourceMappingURL=connection-stats.d.ts.map