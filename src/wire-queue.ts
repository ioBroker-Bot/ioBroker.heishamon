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
  /**
   * Required seam — an adapter-managed sleep. `main.ts` supplies the ioBroker
   * base-class `this.delay(ms)`; tests inject a deterministic fake.
   */
  readonly sleep: SleepFn;
  /** Test seam — defaults to Date.now. */
  readonly now?: NowFn;
}

interface QueueEntry {
  readonly task: () => Promise<void>;
  readonly resolve: () => void;
  readonly reject: (error: unknown) => void;
}

const defaultNow: NowFn = () => Date.now();

const DEFAULT_MAX_QUEUE_SIZE = 100;

/**
 * Largest delay Node.js `setTimeout` accepts; a larger gap would wrap around
 * and fire almost immediately, defeating the throttle. The adapter clamps the
 * configured value before constructing the queue, but the constructor enforces
 * the ceiling too as defense-in-depth for any other caller.
 */
const MAX_SEND_GAP_MS = 2_147_483_647;

export class WireQueueFullError extends Error {
  constructor(public readonly maxQueueSize: number) {
    super(`WireQueue: queue full (max ${maxQueueSize}), dropping task`);
    this.name = 'WireQueueFullError';
  }
}

export class WireQueue {
  private readonly minSendGapMs: number;
  private readonly maxQueueSize: number;
  private readonly sleep: SleepFn;
  private readonly now: NowFn;
  private readonly entries: QueueEntry[] = [];
  private running = false;
  // Wall-clock timestamp (ms) at which the previous send finished. Negative
  // sentinel marks "no send yet" so the first task never waits.
  private lastSendCompletedAt = Number.NEGATIVE_INFINITY;

  constructor(options: WireQueueOptions) {
    if (!Number.isFinite(options.minSendGapMs) || options.minSendGapMs < 0) {
      throw new Error(
        `WireQueue: minSendGapMs must be a non-negative finite number, got ${options.minSendGapMs}`,
      );
    }
    if (options.minSendGapMs > MAX_SEND_GAP_MS) {
      throw new Error(
        `WireQueue: minSendGapMs must not exceed ${MAX_SEND_GAP_MS} ms, got ${options.minSendGapMs}`,
      );
    }
    const maxSize = options.maxQueueSize ?? DEFAULT_MAX_QUEUE_SIZE;
    if (!Number.isInteger(maxSize) || maxSize <= 0) {
      throw new Error(`WireQueue: maxQueueSize must be a positive integer, got ${maxSize}`);
    }
    this.minSendGapMs = options.minSendGapMs;
    this.maxQueueSize = maxSize;
    this.sleep = options.sleep;
    this.now = options.now ?? defaultNow;
  }

  /**
   * Append a task to the FIFO queue. The returned promise resolves once the
   * task has run to completion, rejects with the task's error, or rejects
   * with `WireQueueFullError` if the queue is already at capacity.
   *
   * A task that throws does NOT abort the queue — the next entry still runs
   * after the usual gap.
   */
  enqueue(task: () => Promise<void>): Promise<void> {
    if (this.entries.length >= this.maxQueueSize) {
      return Promise.reject(new WireQueueFullError(this.maxQueueSize));
    }
    return new Promise<void>((resolve, reject) => {
      this.entries.push({ task, resolve, reject });
      if (!this.running) {
        this.running = true;
        void this.drain();
      }
    });
  }

  /** Number of entries still waiting in the queue (excludes the running one). */
  pendingCount(): number {
    return this.entries.length;
  }

  /** Configured queue capacity, for diagnostics. */
  capacity(): number {
    return this.maxQueueSize;
  }

  private async drain(): Promise<void> {
    try {
      while (this.entries.length > 0) {
        if (this.minSendGapMs > 0) {
          const elapsed = this.now() - this.lastSendCompletedAt;
          const wait = this.minSendGapMs - elapsed;
          if (wait > 0 && Number.isFinite(wait)) {
            await this.sleep(wait);
          }
        }

        const entry = this.entries.shift();
        if (entry === undefined) {
          break;
        }
        try {
          await entry.task();
          entry.resolve();
        } catch (error: unknown) {
          entry.reject(error);
        }
        // Record completion AFTER the task finished so the gap covers both
        // the task duration and the configured idle window.
        this.lastSendCompletedAt = this.now();
      }
    } finally {
      this.running = false;
    }
  }
}
