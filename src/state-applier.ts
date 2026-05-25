/**
 * State-applier: bridge between decoded protocol frames and ioBroker states.
 *
 * Decodes a response frame using `heishamon-protocol` and pushes each
 * resulting topic to ioBroker via an injected `setState` function. The
 * indirection through the callback keeps this module decoupled from
 * `@iobroker/adapter-core` and trivially unit-testable.
 *
 * State IDs are *device-relative* (`main.Outside_Temp`, `extra.X`). The
 * adapter (main.ts) is responsible for prefixing the instance namespace
 * (e.g. `heishamon.0.`) when it binds `setState`.
 */

import {
  EXTRA_DATAPOINTS,
  MAIN_DATAPOINTS,
  decodeExtraFrame,
  decodeMainFrame,
  type DecodedValue,
} from './protocol/index.js';

import { stateId } from './object-tree.js';
import type { Logger } from './transport.js';

const MAIN_FRAME_LENGTH = 203;
const EXTRA_FRAME_LENGTH = 203;

/**
 * Signature of the ioBroker `setState` method we care about. The adapter
 * binds this from its actual `setState` so this module stays decoupled
 * from `@iobroker/adapter-core`.
 */
export type SetStateFn = (
  id: string,
  value: number | string,
  ack: true,
) => Promise<void> | void;

export interface StateApplierOptions {
  readonly setState: SetStateFn;
  readonly log?: Logger;
}

export class StateApplier {
  private readonly setState: SetStateFn;
  private readonly logger?: Logger;

  constructor(options: StateApplierOptions) {
    this.setState = options.setState;
    if (options.log !== undefined) {
      this.logger = options.log;
    }
  }

  /**
   * Decode a mainResponse frame (203 bytes) and push every main datapoint
   * to ioBroker. Logs and skips when the frame is the wrong length.
   */
  async applyMainResponse(frame: Uint8Array): Promise<void> {
    if (frame.length !== MAIN_FRAME_LENGTH) {
      this.log(
        'error',
        `mainResponse frame must be ${MAIN_FRAME_LENGTH} bytes, got ${frame.length}`,
      );
      return;
    }
    const decoded = decodeMainFrame(frame);
    await this.applyDecoded('main', MAIN_DATAPOINTS, decoded);
  }

  /**
   * Decode an extraResponse frame (203 bytes) and push every extra
   * datapoint to ioBroker. Logs and skips when the frame is the wrong length.
   */
  async applyExtraResponse(frame: Uint8Array): Promise<void> {
    if (frame.length !== EXTRA_FRAME_LENGTH) {
      this.log(
        'error',
        `extraResponse frame must be ${EXTRA_FRAME_LENGTH} bytes, got ${frame.length}`,
      );
      return;
    }
    const decoded = decodeExtraFrame(frame);
    await this.applyDecoded('extra', EXTRA_DATAPOINTS, decoded);
  }

  private async applyDecoded(
    source: 'main' | 'extra',
    datapoints: ReadonlyArray<{ readonly name: string }>,
    decoded: Record<string, DecodedValue>,
  ): Promise<void> {
    // Fire every setState in parallel and use `allSettled` so a single
    // failing topic does not abort the whole frame. ioBroker's setState
    // is async; awaiting in a loop would serialise 144 round-trips.
    const writes = datapoints.map(async (datapoint) => {
      const value = decoded[datapoint.name];
      if (value === undefined) {
        // Should never happen — decoder is the source of truth. Defensive.
        this.log('warn', `decoder produced no value for ${datapoint.name}`);
        return;
      }
      const id = stateId(source, datapoint.name);
      try {
        await this.setState(id, value, true);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.log('warn', `setState ${id} failed: ${message}`);
      }
    });
    await Promise.allSettled(writes);
  }

  private log(level: 'info' | 'warn' | 'error' | 'debug', message: string): void {
    if (this.logger !== undefined) {
      this.logger(level, message);
    }
  }
}
