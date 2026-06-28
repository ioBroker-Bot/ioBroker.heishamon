/**
 * Polling scheduler for the ioBroker adapter.
 *
 * Periodically pushes a `mainPoll` (and optionally an `extraPoll`) frame
 * onto the wire via the injected `AdapterTransport`. The scheduler is
 * intentionally minimal: it owns nothing but a timer handle and a small
 * piece of round-robin state, and never mutates the transport beyond
 * calling `send()`. Decoding of the responses is the state-applier's job.
 *
 * Timers are injected to keep the unit tests deterministic and to let the
 * adapter supply ioBroker-managed timers — `main.ts` passes the base-class
 * `this.setTimeout` / `this.clearTimeout`; tests inject deterministic fakes.
 */

import { buildFrame, type FrameType } from './protocol/index.js';

import type { AdapterTransport, Logger } from './transport.js';

export interface PollerTimers {
  /**
   * One-shot timer. Returns an opaque handle treated as `unknown` so an
   * adapter-managed handle (e.g. `ioBroker.Timeout`) is accepted without the
   * poller depending on its concrete shape.
   */
  readonly setTimeout: (fn: () => void, ms: number) => unknown;
  readonly clearTimeout: (handle: unknown) => void;
}

/**
 * Hand-off contract for a single send operation. The poller passes the frame
 * to the sender, which is responsible for routing it through whatever
 * serialisation layer (e.g. a `WireQueue`) the adapter has wired up. The
 * returned promise resolves once the byte stream has been handed to the
 * transport.
 */
export type FrameSender = (frame: Uint8Array) => Promise<void>;

export interface PollerOptions {
  readonly pollIntervalMs: number;
  readonly extraPollEnabled: boolean;
  /**
   * Direct transport reference. Used when no `send` override is supplied —
   * the poller calls `transport.send(frame)` itself. Tests can drop this in
   * to keep the previous semantics.
   */
  readonly transport: AdapterTransport;
  /**
   * Optional indirection layer. When provided, the poller hands every frame
   * to this function instead of calling `transport.send` directly. Production
   * code passes a closure that pushes through the shared `WireQueue`.
   */
  readonly send?: FrameSender;
  readonly log?: Logger;
  /**
   * Invoked synchronously right before each poll frame is handed to the
   * transport. The connection-quality tracker uses this to flush a still-
   * pending response from the previous tick as a timeout, then book the
   * new send. Exceptions thrown here propagate and skip the send, which
   * is the desired behaviour for a misconfigured callback.
   */
  readonly onBeforeSend?: (frameType: FrameType) => void;
  /**
   * Required seam — adapter-managed one-shot timers. `main.ts` supplies the
   * ioBroker base-class `this.setTimeout` / `this.clearTimeout`; tests
   * inject deterministic fakes.
   */
  readonly timers: PollerTimers;
}

/**
 * Round-robin polling scheduler.
 *
 *  - `extraPollEnabled = false`: every tick sends a `mainPoll` frame.
 *  - `extraPollEnabled = true`: ticks alternate `mainPoll` / `extraPoll`,
 *    starting with `mainPoll`.
 *
 * Scheduling is **end-of-tick**: `start()` runs the first tick immediately
 * (so the adapter sees a response on startup instead of waiting), and the
 * *next* tick is scheduled with a one-shot `setTimeout` only after the
 * current one has fully completed — including the bus exchange's retries.
 * This guarantees poll ticks can never overlap or pile up in the wire queue,
 * even when the heat pump stops answering and every send runs its full retry
 * budget. `stop()` is idempotent and safe to call before `start()`.
 */
export class Poller {
  private readonly options: PollerOptions;
  private readonly timers: PollerTimers;
  private handle: unknown = null;
  private stopped = true;
  private nextFrameType: FrameType = 'mainPoll';

  constructor(options: PollerOptions) {
    this.options = options;
    this.timers = options.timers;
  }

  start(): void {
    if (!this.stopped) {
      return;
    }
    this.stopped = false;
    void this.runCycle();
  }

  stop(): void {
    this.stopped = true;
    if (this.handle !== null) {
      this.timers.clearTimeout(this.handle);
      this.handle = null;
    }
    this.nextFrameType = 'mainPoll';
  }

  /**
   * Run one tick to completion, then — unless stopped meanwhile — arm a
   * one-shot timer for the next cycle. Because `tick()` awaits the full send
   * (which, in production, resolves only after the bus exchange has finished
   * its retries), the interval is measured from the end of one poll to the
   * start of the next, so ticks never overrun each other.
   */
  private async runCycle(): Promise<void> {
    await this.tick();
    if (this.stopped) {
      return;
    }
    this.handle = this.timers.setTimeout(() => {
      this.handle = null;
      void this.runCycle();
    }, this.options.pollIntervalMs);
  }

  private async tick(): Promise<void> {
    const frameType = this.nextFrameType;
    this.nextFrameType = this.computeNextFrameType(frameType);

    const frame = buildFrame(frameType);
    const send = this.options.send ?? ((bytes) => this.options.transport.send(bytes));

    // `onBeforeSend` must fire right before the actual write so the
    // connection-stats tracker counts the send at the moment it really
    // hits the wire — not when the frame is merely enqueued. The hook
    // therefore runs inside the closure handed to the sender (which may
    // delay execution via a queue).
    if (this.options.onBeforeSend !== undefined) {
      try {
        this.options.onBeforeSend(frameType);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.log('error', `onBeforeSend hook failed for ${frameType}: ${message}`);
        return;
      }
    }

    // Promise rejections must not crash the scheduler — log and move on.
    // The next cycle will retry, which is the right behaviour for a flaky
    // serial link.
    try {
      await send(frame);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.log('error', `failed to send ${frameType}: ${message}`);
    }
  }

  private computeNextFrameType(current: FrameType): FrameType {
    if (!this.options.extraPollEnabled) {
      return 'mainPoll';
    }
    return current === 'mainPoll' ? 'extraPoll' : 'mainPoll';
  }

  private log(level: 'info' | 'warn' | 'error' | 'debug', message: string): void {
    if (this.options.log !== undefined) {
      this.options.log(level, message);
    }
  }
}
