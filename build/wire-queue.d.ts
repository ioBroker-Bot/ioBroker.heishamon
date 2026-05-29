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
 * The class is pure logic — no ioBroker, no transport, no timers beyond the
 * injectable `sleep`. Callers pass in a task that returns a `Promise<void>`,
 * typically a closure over `transport.send(frame)`.
 */
export type SleepFn = (ms: number) => Promise<void>;
export interface WireQueueOptions {
    /** Minimum delay between the completion of one task and the start of the next. */
    readonly minSendGapMs: number;
    /**
     * Override for the gap delay — primarily a test seam so unit tests can
     * verify the requested gap without burning real wall-clock time.
     */
    readonly sleep?: SleepFn;
}
export declare class WireQueue {
    private readonly minSendGapMs;
    private readonly sleep;
    private readonly entries;
    private running;
    constructor(options: WireQueueOptions);
    /**
     * Append a task to the FIFO queue. The returned promise resolves once the
     * task has run to completion, or rejects with the task's error.
     * A task that throws does NOT abort the queue — the next entry runs after
     * the usual gap.
     */
    enqueue(task: () => Promise<void>): Promise<void>;
    /** Number of entries still waiting in the queue (excludes the running one). */
    pendingCount(): number;
    private drain;
}
//# sourceMappingURL=wire-queue.d.ts.map