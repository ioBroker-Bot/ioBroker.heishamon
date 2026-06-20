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
  type FrameType,
  type FramerEvent,
} from './protocol/index.js';

import {
  BusExchange,
  DEFAULT_MAX_RETRIES,
  DEFAULT_RESPONSE_TIMEOUT_MS,
} from './bus-exchange.js';
import { ConnectionStats, type ConnectionStatsSnapshot } from './connection-stats.js';
import { buildObjectTree } from './object-tree.js';
import { Poller } from './poller.js';
import { StateApplier } from './state-applier.js';
import {
  SerialAdapterTransport,
  type AdapterTransport,
  type LogLevel,
  type Logger,
} from './transport.js';
import { WireQueue, WireQueueFullError } from './wire-queue.js';

/**
 * Minimum gap between two consecutive flushes of the connection-stats
 * info-states. Updates that arrive in less time are coalesced into a
 * single trailing-edge write so we don't spam the ioBroker jsonl store.
 */
const STATS_FLUSH_THROTTLE_MS = 1000;

/**
 * How long after a `mainSet` hits the wire we keep logging inbound frames
 * as candidate set-acknowledgements. Diagnostic instrumentation only: the
 * Panasonic SET response has not been reverse-engineered yet, so we capture
 * the WP's reply (type, timing, hexdump) to learn what it looks like. The
 * window is generous (well past the original firmware's 2 s read timeout)
 * so a slow reply is never missed. See [[session-checkpoints]].
 */
const SET_PROBE_WINDOW_MS = 3000;

interface NativeConfig {
  readonly device: string;
  readonly baudRate: number;
  readonly pollIntervalSec: number;
  readonly extraPollEnabled: boolean;
  readonly optionalPcbPollEnabled: boolean;
  readonly readOnlyMode: boolean;
  /**
   * Minimum gap (ms) between two successive frames pushed to the wire.
   * Falls back to {@link DEFAULT_COMMAND_GAP_MS} when unset.
   */
  readonly setCommandGapMs?: number;
  /**
   * How long (ms) the bus exchange waits for the WP reply after a send
   * before retrying. Falls back to the BusExchange default when unset.
   */
  readonly responseTimeoutMs?: number;
  /**
   * Number of retries the bus exchange makes after the first send (so up to
   * `sendMaxRetries + 1` total sends). Falls back to the BusExchange default.
   */
  readonly sendMaxRetries?: number;
  /**
   * When true, log every set-command frame and the heat pump's reply (type,
   * timing, hexdump) at info level — a diagnostic aid for reverse-engineering
   * the SET acknowledgement. Off by default to keep the log clean.
   */
  readonly setProbeLogging?: boolean;
}

/**
 * Default minimum gap between two wire operations. Chosen to comfortably
 * exceed a single poll round-trip on a healthy bus while still feeling
 * snappy for interactive set-commands.
 */
const DEFAULT_COMMAND_GAP_MS = 200;

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
  private wireQueue: WireQueue | null = null;
  private busExchange: BusExchange | null = null;
  private readonly connectionStats: ConnectionStats = new ConnectionStats();
  private lastStatsFlushAt = 0;
  private statsFlushTimer: ioBroker.Timeout | undefined = undefined;
  private lastWrittenSnapshot: ConnectionStatsSnapshot | null = null;
  // The framer drops one byte per failed-checksum resync, so a single
  // garbled 203-byte response yields many `invalid/checksum` events. We
  // collapse runs of them into a single CRC-fail frame for stats.
  private invalidRunActive = false;
  // Active SET-response probe. Armed the moment a `mainSet` is written to
  // the wire; the next inbound framer events are logged with timing and a
  // hexdump so the Panasonic SET acknowledgement can be reverse-engineered.
  // Read-only diagnostics — never alters wire behaviour. Disarmed on the
  // first complete reply, on the next outbound send, or when the window
  // elapses. See SET_PROBE_WINDOW_MS.
  private setResponseProbe: { topic: string; value: number; sentAt: number; seq: number } | null =
    null;
  // Mirrors `NativeConfig.setProbeLogging`. When false the SET-response probe
  // is never armed, so `logSetResponseProbe` stays a no-op and no hexdumps
  // reach the log. Toggleable from the adapter settings.
  private setProbeLoggingEnabled = false;

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
    this.setProbeLoggingEnabled = cfg.setProbeLogging ?? false;

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

    // The wire queue serialises *all* writes — polls and set-commands —
    // so concurrent onStateChange callbacks can never overlap a poll or
    // each other. See `src/wire-queue.ts` for the rationale.
    const gapMs = cfg.setCommandGapMs ?? DEFAULT_COMMAND_GAP_MS;
    this.wireQueue = new WireQueue({
      minSendGapMs: gapMs,
      sleep: (ms) => this.delay(ms),
    });
    this.log.info(
      `wire queue: minSendGapMs=${gapMs}, capacity=${this.wireQueue.capacity()}`,
    );

    // The bus exchange owns the half-duplex request/response handshake: each
    // send waits for the WP reply (fed via `handleFramerEvent`) and retries
    // on timeout. It runs *inside* the wire queue so only one transaction is
    // ever live and the configured inter-frame gap still applies.
    const responseTimeoutMs = cfg.responseTimeoutMs ?? DEFAULT_RESPONSE_TIMEOUT_MS;
    const maxRetries = cfg.sendMaxRetries ?? DEFAULT_MAX_RETRIES;
    this.busExchange = new BusExchange({
      send: (frame) => transport.send(frame),
      responseTimeoutMs,
      maxRetries,
      sleep: (ms) => this.delay(ms),
      log: logger,
    });
    this.log.info(`bus exchange: responseTimeoutMs=${responseTimeoutMs}, maxRetries=${maxRetries}`);

    if (!cfg.readOnlyMode) {
      const wireQueue = this.wireQueue;
      const busExchange = this.busExchange;
      this.poller = new Poller({
        pollIntervalMs: cfg.pollIntervalSec * 1000,
        extraPollEnabled: cfg.extraPollEnabled,
        transport,
        send: (frame) => {
          this.log.debug(`poll enqueue ${frame.length}B, pending=${wireQueue.pendingCount()}`);
          return wireQueue.enqueue(() => {
            this.log.debug(`poll send ${frame.length}B`);
            // A new outbound frame ends any open set-probe window: a reply
            // arriving after this point belongs to the poll, not the set.
            this.setResponseProbe = null;
            // The exchange drives the actual send and the response wait. Stats
            // bookkeeping moves into the per-call hooks so it reflects real
            // wire timing (one recordSent per send, one timeout per miss).
            return busExchange
              .runExchange(frame, 'poll', {
                onSend: () => {
                  this.connectionStats.recordSent();
                  this.scheduleStatsFlush();
                },
                onTimeout: () => {
                  this.connectionStats.markPendingAsTimeout();
                  this.scheduleStatsFlush();
                },
              })
              .then(() => undefined);
          });
        },
        log: logger,
        timers: {
          setInterval: (fn, ms) => this.setInterval(fn, ms),
          clearInterval: (handle) => this.clearInterval(handle as ioBroker.Interval),
        },
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
    const { channels, states, infoStates } = buildObjectTree();
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
    for (const infoState of infoStates) {
      await this.setObjectNotExistsAsync(
        infoState._id,
        infoState as unknown as ioBroker.SettableObject,
      );
    }
  }

  private buildLogger(): Logger {
    return (level: LogLevel, message: string): void => {
      this.log[level](message);
    };
  }

  private handleFramerEvent(event: FramerEvent): void {
    this.logSetResponseProbe(event);
    if (event.kind === 'invalid') {
      this.log.debug(`framer: invalid (${event.reason}, bytes=${this.toHexString(event.bytes)})`);
      // A failed-checksum candidate counts as one CRC-fail frame, but the
      // framer can emit many `invalid` events in a row while resynchronising
      // after a bad frame. Collapse the run so we only book one frame.
      if (event.reason === 'checksum' && !this.invalidRunActive) {
        this.invalidRunActive = true;
        this.connectionStats.recordReceived(false);
        this.scheduleStatsFlush();
        // A garbled frame on a multi-master bus may be a collision: arm the
        // exchange's randomised backoff before the next bus access. It does
        // NOT resolve the in-flight gate, so the attempt still times out and
        // retries on a clean frame.
        this.busExchange?.onCrcError();
      }
      return;
    }
    this.invalidRunActive = false;
    // A valid frame completes the in-flight bus transaction. The same frame
    // is also routed to the applier below — both must still happen.
    this.busExchange?.onResponse();
    if (this.isResponseFrame(event.frameType)) {
      this.connectionStats.recordReceived(true);
      this.scheduleStatsFlush();
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

  private isResponseFrame(frameType: FrameType): boolean {
    return frameType === 'mainResponse' || frameType === 'extraResponse';
  }

  /**
   * Diagnostic logging for the (not-yet-reverse-engineered) Panasonic SET
   * acknowledgement. When a probe is armed (a `mainSet` was just written),
   * log every inbound framer event with its delay since the send, frame
   * type/length and a full hexdump. The first *complete* frame is taken to
   * be the reply and disarms the probe; CRC-garbage that precedes it is
   * logged but does not disarm, so a corrupted reply still shows up. The
   * probe also self-clears once SET_PROBE_WINDOW_MS has elapsed.
   *
   * This never touches wire behaviour — it only observes. Once we know what
   * the reply looks like, this feeds the response-driven queue + retry work.
   */
  private logSetResponseProbe(event: FramerEvent): void {
    const probe = this.setResponseProbe;
    if (probe === null) {
      return;
    }
    const dt = Date.now() - probe.sentAt;
    if (dt > SET_PROBE_WINDOW_MS) {
      this.log.info(
        `set-probe ${probe.topic}=${probe.value}: no reply within ${SET_PROBE_WINDOW_MS} ms`,
      );
      this.setResponseProbe = null;
      return;
    }
    probe.seq += 1;
    if (event.kind === 'frame') {
      this.log.info(
        `set-probe ${probe.topic}=${probe.value}: reply #${probe.seq} +${dt}ms ` +
          `type=${event.frameType} len=${event.frame.length} [${this.toHexString(event.frame)}]`,
      );
      // First complete, header-recognised frame after the send: treat it as
      // the acknowledgement and stop probing this set.
      this.setResponseProbe = null;
    } else {
      this.log.info(
        `set-probe ${probe.topic}=${probe.value}: reply #${probe.seq} +${dt}ms ` +
          `INVALID(${event.reason}) [${this.toHexString(event.bytes)}]`,
      );
    }
  }

  /** Space-separated lower-case hexdump of a byte buffer, for diagnostics. */
  private toHexString(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(' ');
  }

  /**
   * Throttled flush of the connection-stats snapshot to ioBroker. Writes
   * immediately when the last flush is older than `STATS_FLUSH_THROTTLE_MS`,
   * otherwise schedules a single trailing-edge write.
   */
  private scheduleStatsFlush(): void {
    const now = Date.now();
    const sinceLast = now - this.lastStatsFlushAt;
    if (sinceLast >= STATS_FLUSH_THROTTLE_MS) {
      void this.flushStatsNow(now);
      return;
    }
    if (this.statsFlushTimer !== undefined) {
      return;
    }
    const delay = Math.max(0, STATS_FLUSH_THROTTLE_MS - sinceLast);
    this.statsFlushTimer = this.setTimeout(() => {
      this.statsFlushTimer = undefined;
      void this.flushStatsNow(Date.now());
    }, delay);
  }

  private async flushStatsNow(at: number): Promise<void> {
    this.lastStatsFlushAt = at;
    const snapshot = this.connectionStats.snapshot();
    const previous = this.lastWrittenSnapshot;
    this.lastWrittenSnapshot = snapshot;

    const writes: Array<Promise<void>> = [];
    if (previous === null || previous.framesSent !== snapshot.framesSent) {
      writes.push(this.writeInfoState('info.framesSent', snapshot.framesSent));
    }
    if (previous === null || previous.framesReceived !== snapshot.framesReceived) {
      writes.push(this.writeInfoState('info.framesReceived', snapshot.framesReceived));
    }
    if (previous === null || previous.framesCrcOk !== snapshot.framesCrcOk) {
      writes.push(this.writeInfoState('info.framesCrcOk', snapshot.framesCrcOk));
    }
    if (previous === null || previous.framesCrcFail !== snapshot.framesCrcFail) {
      writes.push(this.writeInfoState('info.framesCrcFail', snapshot.framesCrcFail));
    }
    if (previous === null || previous.connectionQuality !== snapshot.connectionQuality) {
      writes.push(this.writeInfoState('info.connectionQuality', snapshot.connectionQuality));
    }
    await Promise.allSettled(writes);
  }

  private async writeInfoState(id: string, value: number): Promise<void> {
    try {
      await this.setStateAsync(id, { val: value, ack: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.log.warn(`failed to write ${id}: ${message}`);
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
    const wireQueue = this.wireQueue;
    const busExchange = this.busExchange;
    if (transport === null || wireQueue === null || busExchange === null) {
      this.log.error(`onStateChange: transport not ready, dropping set for ${topicName}`);
      return;
    }

    const enqueuedAt = Date.now();
    this.log.debug(
      `set enqueue ${topicName}=${numericValue}, pending=${wireQueue.pendingCount()}`,
    );
    try {
      // Route through the shared queue so concurrent set-commands and the
      // running poller can never collide on the wire. The exchange owns the
      // actual send and retries until the WP replies (or the budget runs out).
      let probeArmed = false;
      await wireQueue.enqueue(() =>
        busExchange
          .runExchange(frame, `set:${topicName}`, {
            onSend: () => {
              // Run the first-send-only bookkeeping once; retries re-use it.
              if (probeArmed) {
                return;
              }
              probeArmed = true;
              const waited = Date.now() - enqueuedAt;
              this.log.debug(`set send ${topicName}=${numericValue}, waited ${waited} ms`);
              // Arm the SET-response probe only when diagnostic logging is
              // enabled in the adapter settings. The WP answers on the half-
              // duplex bus, but its set-acknowledgement frame is not yet
              // reverse-engineered; the probe logs the sent frame and the
              // next inbound frame(s) (type, timing, hexdump) to learn its
              // shape. Off by default to keep the log clean.
              if (!this.setProbeLoggingEnabled) {
                return;
              }
              this.setResponseProbe = {
                topic: topicName,
                value: numericValue,
                sentAt: Date.now(),
                seq: 0,
              };
              this.log.info(
                `set-probe armed ${topicName}=${numericValue}, sent ${frame.length}B ` +
                  `[${this.toHexString(frame)}]`,
              );
            },
          })
          .then(() => undefined),
      );
    } catch (error: unknown) {
      if (error instanceof WireQueueFullError) {
        this.log.warn(
          `wire queue full (cap ${error.maxQueueSize}), dropping set ${topicName}=${numericValue}`,
        );
        return;
      }
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
      if (this.statsFlushTimer !== undefined) {
        this.clearTimeout(this.statsFlushTimer);
        this.statsFlushTimer = undefined;
      }
      if (this.transport !== null) {
        await this.transport.close();
        this.transport = null;
      }
      this.wireQueue = null;
      this.busExchange = null;
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
