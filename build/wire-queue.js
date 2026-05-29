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
const defaultSleep = (ms) => new Promise((resolve) => {
    setTimeout(resolve, ms);
});
export class WireQueue {
    minSendGapMs;
    sleep;
    entries = [];
    running = false;
    constructor(options) {
        if (!Number.isFinite(options.minSendGapMs) || options.minSendGapMs < 0) {
            throw new Error(`WireQueue: minSendGapMs must be a non-negative finite number, got ${options.minSendGapMs}`);
        }
        this.minSendGapMs = options.minSendGapMs;
        this.sleep = options.sleep ?? defaultSleep;
    }
    /**
     * Append a task to the FIFO queue. The returned promise resolves once the
     * task has run to completion, or rejects with the task's error.
     * A task that throws does NOT abort the queue — the next entry runs after
     * the usual gap.
     */
    enqueue(task) {
        return new Promise((resolve, reject) => {
            this.entries.push({ task, resolve, reject });
            if (!this.running) {
                this.running = true;
                // Kick the drain loop off the microtask queue so callers can finish
                // enqueueing related work synchronously before anything fires.
                void this.drain();
            }
        });
    }
    /** Number of entries still waiting in the queue (excludes the running one). */
    pendingCount() {
        return this.entries.length;
    }
    async drain() {
        try {
            let first = true;
            while (this.entries.length > 0) {
                if (!first && this.minSendGapMs > 0) {
                    await this.sleep(this.minSendGapMs);
                }
                first = false;
                const entry = this.entries.shift();
                if (entry === undefined) {
                    break;
                }
                try {
                    await entry.task();
                    entry.resolve();
                }
                catch (error) {
                    entry.reject(error);
                }
            }
        }
        finally {
            this.running = false;
        }
    }
}
//# sourceMappingURL=wire-queue.js.map