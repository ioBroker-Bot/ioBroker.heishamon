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
import { type FrameType } from './protocol/index.js';
import type { AdapterTransport, Logger } from './transport.js';
export interface PollerTimers {
    readonly setInterval: (fn: () => void, ms: number) => NodeJS.Timeout | number;
    readonly clearInterval: (handle: NodeJS.Timeout | number) => void;
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
    /** Override for testing — defaults to global setInterval/clearInterval. */
    readonly timers?: PollerTimers;
}
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
export declare class Poller {
    private readonly options;
    private readonly timers;
    private handle;
    private nextFrameType;
    constructor(options: PollerOptions);
    start(): void;
    stop(): void;
    private tick;
    private computeNextFrameType;
    private log;
}
//# sourceMappingURL=poller.d.ts.map