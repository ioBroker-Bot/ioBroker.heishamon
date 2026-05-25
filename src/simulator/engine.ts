/**
 * Transport-agnostic heat-pump simulator engine.
 *
 * The engine glues the byte-level `Framer` to the frame-level `Router`
 * and keeps the mutable `HeatPumpState` they share. It is intentionally
 * pure with respect to I/O: bytes go in, bytes come out, and there is no
 * dependency on `serialport`, `net`, files or timers. The CLI / serial
 * transport / TCP transport / unit tests all drive the same engine.
 */

import { Framer, type FramerEvent } from '../protocol/index.js';

import { handleIncomingFrame, type RouterResult } from './router.js';
import { createDefaultState, type HeatPumpState } from './state.js';

/**
 * Result of one fully-decoded frame on the wire. `routerResult` is null
 * when the framer reported an `invalid` event (noise / bad checksum /
 * unknown header) — in that case `framerEvent.kind === 'invalid'` and the
 * engine produced no response.
 */
export interface SimulatorEvent {
  /** The framer-level event (frame or invalid). */
  readonly framerEvent: FramerEvent;
  /** The router result, or null for invalid framer events. */
  readonly routerResult: RouterResult | null;
}

/**
 * Aggregate of everything one `processIncoming` call produced.
 */
export interface ProcessResult {
  /** Per-frame events in arrival order. */
  readonly events: readonly SimulatorEvent[];
  /** Response frames to write back to the wire, in order. */
  readonly outgoing: readonly Uint8Array[];
}

/**
 * Stateful simulator engine. One instance per logical heat-pump
 * connection. Holds a `Framer` (byte-stream resync) plus the heat-pump
 * `state` that the router reads and mutates.
 */
export class SimulatorEngine {
  /** Mutable current state. Read freely; write via `updateState`. */
  readonly state: HeatPumpState;

  private readonly framer = new Framer();

  constructor(initialState?: HeatPumpState) {
    this.state = initialState ?? createDefaultState();
  }

  /**
   * Feed bytes from the wire into the engine. Returns one event per
   * frame (or per invalid event) produced by this chunk, plus any
   * response frames the router decided to emit, in order.
   */
  processIncoming(chunk: Uint8Array): ProcessResult {
    const framerEvents = this.framer.push(chunk);
    const events: SimulatorEvent[] = [];
    const outgoing: Uint8Array[] = [];

    for (const framerEvent of framerEvents) {
      if (framerEvent.kind !== 'frame') {
        events.push({ framerEvent, routerResult: null });
        continue;
      }
      const routerResult = handleIncomingFrame(framerEvent.frame, this.state);
      events.push({ framerEvent, routerResult });
      if (routerResult.response !== null) {
        outgoing.push(routerResult.response);
      }
    }

    return { events, outgoing };
  }

  /**
   * Patch one or more datapoints on the live state. Keys must be valid
   * HeishaMon topic suffixes (same casing as in `MAIN_DATAPOINTS` etc.);
   * unknown keys are accepted but will never make it onto the wire
   * because the response builders only serialise documented topics.
   */
  updateState(partial: Readonly<Record<string, number | string>>): void {
    Object.assign(this.state, partial);
  }
}
