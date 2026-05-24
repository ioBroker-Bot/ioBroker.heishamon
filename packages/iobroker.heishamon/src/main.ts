/**
 * ioBroker adapter entry point — wires the protocol building blocks
 * (`SerialAdapterTransport`, `Poller`, `StateApplier`, `buildObjectTree`)
 * together with the `utils.Adapter` lifecycle.
 *
 * This file is the single boundary against `@iobroker/adapter-core`. All
 * protocol-specific logic lives in the other modules under `src/` and is
 * fully unit-tested without an ioBroker runtime.
 */

import { pathToFileURL } from 'node:url';

import * as utils from '@iobroker/adapter-core';
import {
  encodeSetCommand,
  findByName,
  type FramerEvent,
} from 'heishamon-protocol';

import { buildObjectTree } from './object-tree.js';
import { Poller } from './poller.js';
import { StateApplier } from './state-applier.js';
import {
  SerialAdapterTransport,
  type AdapterTransport,
  type LogLevel,
  type Logger,
} from './transport.js';

interface NativeConfig {
  readonly device: string;
  readonly baudRate: number;
  readonly pollIntervalSec: number;
  readonly extraPollEnabled: boolean;
  readonly optionalPcbPollEnabled: boolean;
  readonly readOnlyMode: boolean;
}

// `@iobroker/adapter-core` re-types `Adapter` as a bare `AdapterConstructor`
// without a prototype/instance type, which makes `extends utils.Adapter`
// lose the method surface (log, setStateAsync, …). Casting the runtime
// constructor to `new (...) => ioBroker.Adapter` (the global namespace type)
// gives the subclass the full AdapterClass instance shape.
const AdapterBase = utils.Adapter as unknown as new (
  options: utils.AdapterOptions | string,
) => ioBroker.Adapter;

class HeishamonAdapter extends AdapterBase {
  private transport: AdapterTransport | null = null;
  private poller: Poller | null = null;
  private applier: StateApplier | null = null;
  private nativeConfig: NativeConfig | null = null;

  constructor(options: Partial<utils.AdapterOptions> = {}) {
    super({ ...options, name: 'heishamon' });
    this.on('ready', this.onReady.bind(this));
    this.on('stateChange', this.onStateChange.bind(this));
    this.on('unload', this.onUnload.bind(this));
  }

  private async onReady(): Promise<void> {
    const cfg = this.config as unknown as NativeConfig;

    if (!this.validateConfig(cfg)) {
      return;
    }
    this.nativeConfig = cfg;

    await this.ensureObjectTree();
    this.subscribeStates('main.*');

    const logger = this.buildLogger();
    this.applier = new StateApplier({
      setState: async (id, value, ack) => {
        await this.setStateAsync(id, { val: value, ack });
      },
      log: logger,
    });

    const transport = new SerialAdapterTransport({
      path: cfg.device,
      baudRate: cfg.baudRate,
      onEvent: (event) => {
        this.handleFramerEvent(event);
      },
      onError: (error) => {
        this.log.error(`serial: ${error.message}`);
        void this.setStateAsync('info.connection', { val: false, ack: true });
      },
      log: logger,
    });
    this.transport = transport;

    try {
      await transport.open();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.log.error(`failed to open serial device ${cfg.device}: ${message}`);
      this.terminate?.(11);
      return;
    }
    await this.setStateAsync('info.connection', { val: true, ack: true });

    if (!cfg.readOnlyMode) {
      this.poller = new Poller({
        pollIntervalMs: cfg.pollIntervalSec * 1000,
        extraPollEnabled: cfg.extraPollEnabled,
        transport,
        log: logger,
      });
      this.poller.start();
    } else {
      this.log.info('readOnlyMode active — no polling, listening only');
    }
  }

  private validateConfig(cfg: NativeConfig): boolean {
    if (typeof cfg.device !== 'string' || cfg.device.length === 0) {
      this.log.error('config.device must be a non-empty serial device path');
      this.terminate?.(11);
      return false;
    }
    if (typeof cfg.baudRate !== 'number' || cfg.baudRate <= 0) {
      this.log.error(`config.baudRate must be > 0, got ${String(cfg.baudRate)}`);
      this.terminate?.(11);
      return false;
    }
    if (typeof cfg.pollIntervalSec !== 'number' || cfg.pollIntervalSec < 1) {
      this.log.error(
        `config.pollIntervalSec must be >= 1, got ${String(cfg.pollIntervalSec)}`,
      );
      this.terminate?.(11);
      return false;
    }
    return true;
  }

  private async ensureObjectTree(): Promise<void> {
    const { channels, states } = buildObjectTree();
    for (const channel of channels) {
      await this.setObjectNotExistsAsync(
        channel._id,
        channel as unknown as ioBroker.SettableObject,
      );
    }
    for (const state of states) {
      await this.setObjectNotExistsAsync(
        state._id,
        state as unknown as ioBroker.SettableObject,
      );
    }
  }

  private buildLogger(): Logger {
    return (level: LogLevel, message: string): void => {
      this.log[level](message);
    };
  }

  private handleFramerEvent(event: FramerEvent): void {
    if (event.kind === 'invalid') {
      const hex = Array.from(event.bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' ');
      this.log.debug(`framer: invalid (${event.reason}, bytes=${hex})`);
      return;
    }
    if (this.applier === null) {
      // Frame arrived before onReady finished wiring the applier — drop it.
      return;
    }
    switch (event.frameType) {
      case 'mainResponse':
        void this.applier.applyMainResponse(event.frame);
        return;
      case 'extraResponse':
        void this.applier.applyExtraResponse(event.frame);
        return;
      case 'mainPoll':
      case 'extraPoll':
      case 'mainSet':
      case 'optionalPcbPoll':
      case 'initialHandshake':
        // Master->WP frame on the bus. We are the master ourselves, so this
        // is either readOnlyMode (a real HeishaMon is polling) or noise.
        this.log.debug(`framer: master->WP frame ${event.frameType} ignored`);
        return;
    }
  }

  private async onStateChange(
    id: string,
    state: ioBroker.State | null | undefined,
  ): Promise<void> {
    if (!state || state.ack) {
      return;
    }
    const cfg = this.nativeConfig;
    if (cfg === null) {
      return;
    }
    if (cfg.readOnlyMode) {
      this.log.warn(`set ignored in readOnlyMode: ${id}`);
      return;
    }

    const prefix = `${this.namespace}.`;
    if (!id.startsWith(prefix)) {
      this.log.warn(`onStateChange: unexpected id ${id}`);
      return;
    }
    const localId = id.substring(prefix.length);

    const parts = localId.split('.');
    if (parts.length !== 2 || parts[0] !== 'main') {
      this.log.warn(`onStateChange: only main.* writes supported, got ${localId}`);
      return;
    }
    const topicName = parts[1] as string;

    const datapoint = findByName(topicName);
    if (datapoint === undefined || datapoint.source !== 'main' || !datapoint.writable) {
      this.log.warn(`onStateChange: ${topicName} is not a writable main datapoint`);
      return;
    }

    const numericValue = Number(state.val);
    if (!Number.isFinite(numericValue)) {
      this.log.error(`onStateChange: ${topicName} value not numeric: ${String(state.val)}`);
      return;
    }

    let frame: Uint8Array;
    try {
      frame = encodeSetCommand(topicName, numericValue);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.log.error(`encodeSetCommand(${topicName}, ${numericValue}) failed: ${message}`);
      return;
    }

    const transport = this.transport;
    if (transport === null) {
      this.log.error(`onStateChange: transport not ready, dropping set for ${topicName}`);
      return;
    }

    try {
      await transport.send(frame);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.log.error(`send mainSet for ${topicName} failed: ${message}`);
      return;
    }

    // Optimistically ack with the value we just wrote. The next mainResponse
    // poll will overwrite with the true reading from the heat pump.
    await this.setStateAsync(id, { val: numericValue, ack: true });
  }

  private async onUnload(callback: () => void): Promise<void> {
    try {
      this.poller?.stop();
      this.poller = null;
      if (this.transport !== null) {
        await this.transport.close();
        this.transport = null;
      }
      await this.setStateAsync('info.connection', { val: false, ack: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.log.error(`unload: ${message}`);
    } finally {
      callback();
    }
  }
}

export default function createAdapter(
  options: Partial<utils.AdapterOptions> = {},
): HeishamonAdapter {
  return new HeishamonAdapter(options);
}

// Auto-start when invoked directly via `node build/main.js`. NodeNext ESM does
// not populate `require.main`, so we compare `import.meta.url` against argv[1].
const invokedPath = process.argv[1];
if (invokedPath !== undefined && import.meta.url === pathToFileURL(invokedPath).href) {
  createAdapter();
}
