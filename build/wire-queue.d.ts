/**
 * Serialises every wire operation (polls and set-commands) through a single
 * FIFO queue so they never collide on the bus.
 *
 * The Panasonic CN-CNT bus has exactly one master at any given time. When the
 * adapter polls and the ioBroker user concurrently writes multiple writable
 * datapoints, the raw `transport.send()` calls would overlap and the heat
 * pump silently drops everything. The original HeishaMon firmware solves this
 * with a command queue plus a fixed minimum gap between successive sends; we
 * replicate that behaviour here.
 *
 * The class is pure logic — no ioBroker, no transport. Callers pass in a
 * task that returns a `Promise<void>`, typically a closure over
 * `transport.send(frame)`. `sleep` and `now` are injectable so tests can
 * drive the queue deterministically.
 *
 * The gap is enforced between every two successive sends, including across
 * periods where the queue ran empty. A fresh task that arrives long after
 * the last send runs without waiting; one that arrives shortly after waits
 * just long enough to honour the configured gap.
 */
export type SleepFn = (ms: number) => Promise<void>;
export type NowFn = () => number;
export interface WireQueueOptions {
    /** Minimum delay between the completion of one send and the start of the next. */
    readonly minSendGapMs: number;
    /**
     * Hard cap on entries waiting in the queue. enqueue() rejects when the
     * queue already holds this many entries (the running task does not count).
     * Defaults to 100, which is far above any healthy steady-state load.
     */
    readonly maxQueueSize?: number;
    /** Test seam — defaults to setTimeout-based sleep. */
    readonly sleep?: SleepFn;
    /** Test seam — defaults to Date.now. */
    readonly now?: NowFn;
}
export declare class WireQueueFullError extends Error {
    readonly maxQueueSize: number;
    constructor(maxQueueSize: number);
}
export declare class WireQueue {
    private readonly minSendGapMs;
    private readonly maxQueueSize;
    private readonly sleep;
    private readonly now;
    private readonly entries;
    private running;
    private lastSendCompletedAt;
    constructor(options: WireQueueOptions);
    /**
     * Append a task to the FIFO queue. The returned promise resolves once the
     * task has run to completion, rejects with the task's error, or rejects
     * with `WireQueueFullError` if the queue is already at capacity.
     *
     * A task that throws does NOT abort the queue — the next entry still runs
     * after the usual gap.
     */
    enqueue(task: () => Promise<void>): Promise<void>;
    /** Number of entries still waiting in the queue (excludes the running one). */
    pendingCount(): number;
    /** Configured queue capacity, for diagnostics. */
    capacity(): number;
    private drain;
}
//# sourceMappingURL=wire-queue.d.ts.map