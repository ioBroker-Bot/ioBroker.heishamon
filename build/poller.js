/**
 * Polling scheduler for the ioBroker adapter.
 *
 * Periodically pushes a `mainPoll` (and optionally an `extraPoll`) frame
 * onto the wire via the injected `AdapterTransport`. The scheduler is
 * intentionally minimal: it owns nothing but a timer handle and a small
 * piece of round-robin state, and never mutates the transport beyond
 * calling `send()`. Decoding of the responses is the state-applier's job.
 *
 * Timers are injected to keep the unit tests deterministic — the default
 * uses Node's `setInterval` / `clearInterval`.
 */
import { buildFrame } from './protocol/index.js';
const DEFAULT_TIMERS = {
    setInterval: (fn, ms) => setInterval(fn, ms),
    clearInterval: (handle) => clearInterval(handle),
};
/**
 * Round-robin polling scheduler.
 *
 *  - `extraPollEnabled = false`: every tick sends a `mainPoll` frame.
 *  - `extraPollEnabled = true`: ticks alternate `mainPoll` / `extraPoll`,
 *    starting with `mainPoll`.
 *
 *  `start()` runs the first tick synchronously so the adapter sees a
 *  response on startup instead of waiting `pollIntervalMs`. `stop()` is
 *  idempotent and safe to call before `start()`.
 */
export class Poller {
    options;
    timers;
    handle = null;
    nextFrameType = 'mainPoll';
    constructor(options) {
        this.options = options;
        this.timers = options.timers ?? DEFAULT_TIMERS;
    }
    start() {
        if (this.handle !== null) {
            return;
        }
        // Fire one tick immediately, then continue on the interval.
        this.tick();
        this.handle = this.timers.setInterval(() => {
            this.tick();
        }, this.options.pollIntervalMs);
    }
    stop() {
        if (this.handle === null) {
            return;
        }
        this.timers.clearInterval(this.handle);
        this.handle = null;
        this.nextFrameType = 'mainPoll';
    }
    tick() {
        const frameType = this.nextFrameType;
        this.nextFrameType = this.computeNextFrameType(frameType);
        const frame = buildFrame(frameType);
        const send = this.options.send ?? ((bytes) => this.options.transport.send(bytes));
        // `onBeforeSend` must fire right before the actual write so the
        // connection-stats tracker counts the send at the moment it really
        // hits the wire — not when the frame is merely enqueued. The hook
        // therefore runs inside the closure handed to the sender (which may
        // delay execution via a queue).
        const dispatch = async () => {
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
            await send(frame);
        };
        // Promise rejections must not crash the scheduler — log and move on.
        // The next tick will retry, which is the right behaviour for a flaky
        // serial link.
        void dispatch().catch((error) => {
            const message = error instanceof Error ? error.message : String(error);
            this.log('error', `failed to send ${frameType}: ${message}`);
        });
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