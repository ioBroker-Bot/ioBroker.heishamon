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
import { buildFrame } from './protocol/index.js';
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
    options;
    timers;
    handle = null;
    stopped = true;
    nextFrameType = 'mainPoll';
    constructor(options) {
        this.options = options;
        this.timers = options.timers;
    }
    start() {
        if (!this.stopped) {
            return;
        }
        this.stopped = false;
        void this.runCycle();
    }
    stop() {
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
    async runCycle() {
        await this.tick();
        if (this.stopped) {
            return;
        }
        this.handle = this.timers.setTimeout(() => {
            this.handle = null;
            void this.runCycle();
        }, this.options.pollIntervalMs);
    }
    async tick() {
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
            }
            catch (error) {
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
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.log('error', `failed to send ${frameType}: ${message}`);
        }
    }
    computeNextFrameType(current) {
        if (!this.options.extraPollEnabled) {
            return 'mainPoll';
        }
        return current === 'mainPoll' ? 'extraPoll' : 'mainPoll';
    }
    log(level, message) {
        if (this.options.log !== undefined) {
            this.options.log(level, message);
        }
    }
}
//# sourceMappingURL=poller.js.map