/**
 * Serial-port transport for the heat-pump simulator.
 *
 * Thin wrapper around the `serialport` package: opens the port with the
 * Panasonic 9600 8E1 line settings, forwards every incoming chunk to the
 * `SimulatorEngine` and writes every response frame back to the wire.
 *
 * The transport contains no protocol logic of its own — all decoding,
 * routing and state-keeping lives in the engine. This file is the only
 * place in the package that imports `serialport`, which keeps the engine
 * unit-testable without any hardware or native binding.
 */

import { Buffer } from 'node:buffer';
import { SerialPort } from 'serialport';

import type { SimulatorEngine, SimulatorEvent } from './engine.js';

/** Panasonic CN-CNT line settings (see docs/protocol/code-map.md). */
const PANASONIC_BAUD_RATE = 9600;
const PANASONIC_DATA_BITS = 8;
const PANASONIC_PARITY = 'even' as const;
const PANASONIC_STOP_BITS = 1;

export type TransportLogLevel = 'info' | 'warn' | 'error';
export type TransportLogger = (level: TransportLogLevel, message: string) => void;

export interface SerialTransportOptions {
  /** Device path, e.g. `/dev/ttyUSB0`. */
  readonly path: string;
  /** Baud rate. Defaults to 9600 (Panasonic CN-CNT). */
  readonly baudRate?: number;
  /** Hook called once per framer event the engine produced. */
  readonly onEvent?: (event: SimulatorEvent) => void;
  /** Hook called once per chunk of bytes written to the wire. */
  readonly onWrite?: (bytes: Uint8Array) => void;
  /** Optional transport-level logger (open/close/errors). */
  readonly log?: TransportLogger;
}

/**
 * Connects a `SimulatorEngine` to a physical (or virtual) serial port.
 *
 * Lifecycle:
 *  1. `new SerialTransport(engine, options)` — does not touch the port.
 *  2. `await transport.open()` — opens the port and starts forwarding
 *     bytes between the wire and the engine. Rejects if the port cannot
 *     be opened.
 *  3. `await transport.close()` — drains and closes the port cleanly.
 *
 * The same instance is not designed to be reopened after `close()`;
 * create a new one if the caller needs to reconnect.
 */
export class SerialTransport {
  private readonly engine: SimulatorEngine;
  private readonly options: SerialTransportOptions;
  private port: SerialPort | null = null;

  constructor(engine: SimulatorEngine, options: SerialTransportOptions) {
    this.engine = engine;
    this.options = options;
  }

  /**
   * Open the serial port and start forwarding traffic. Rejects with the
   * underlying error if the port cannot be opened (wrong path, busy,
   * permissions denied, etc.).
   */
  open(): Promise<void> {
    if (this.port !== null) {
      return Promise.reject(new Error('SerialTransport is already open'));
    }
    return new Promise<void>((resolve, reject) => {
      const port = new SerialPort(
        {
          path: this.options.path,
          baudRate: this.options.baudRate ?? PANASONIC_BAUD_RATE,
          dataBits: PANASONIC_DATA_BITS,
          parity: PANASONIC_PARITY,
          stopBits: PANASONIC_STOP_BITS,
          autoOpen: false,
        },
        (error) => {
          // The constructor callback fires only on synchronous validation
          // errors when `autoOpen` is false. We use it as a belt-and-
          // braces guard; the real open-result comes from `port.open`.
          if (error) {
            this.port = null;
            reject(error);
          }
        },
      );

      this.port = port;
      this.attachListeners(port);

      port.open((openError) => {
        if (openError) {
          this.port = null;
          this.log('error', `failed to open ${this.options.path}: ${openError.message}`);
          reject(openError);
          return;
        }
        this.log('info', `opened ${this.options.path} @ ${port.baudRate} 8E1`);
        resolve();
      });
    });
  }

  /**
   * Close the serial port. Resolves once the underlying port has fired
   * its `close` event; rejects only if `close()` itself errors.
   */
  close(): Promise<void> {
    const port = this.port;
    if (port === null) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      if (!port.isOpen) {
        this.port = null;
        resolve();
        return;
      }
      port.close((closeError) => {
        this.port = null;
        if (closeError) {
          this.log('error', `failed to close ${this.options.path}: ${closeError.message}`);
          reject(closeError);
          return;
        }
        resolve();
      });
    });
  }

  private attachListeners(port: SerialPort): void {
    port.on('data', (chunk: Buffer) => {
      this.handleIncoming(chunk);
    });

    port.on('error', (error: Error) => {
      this.log('error', `serial error on ${this.options.path}: ${error.message}`);
    });

    port.on('close', () => {
      this.log('info', `closed ${this.options.path}`);
    });
  }

  private handleIncoming(chunk: Buffer): void {
    // Node's Buffer is a Uint8Array subclass; passing it directly into
    // the engine is fine and avoids an unnecessary copy.
    const bytes = chunk as Uint8Array;
    const { events, outgoing } = this.engine.processIncoming(bytes);

    if (this.options.onEvent !== undefined) {
      for (const event of events) {
        this.options.onEvent(event);
      }
    }

    for (const response of outgoing) {
      this.writeBytes(response);
    }
  }

  private writeBytes(bytes: Uint8Array): void {
    const port = this.port;
    if (port === null || !port.isOpen) {
      this.log('warn', 'dropping response: port is not open');
      return;
    }
    // `serialport.write` accepts Uint8Array but is typed as `any`; we
    // wrap into a Buffer to keep the call site explicit and to match
    // the documented preferred input.
    port.write(Buffer.from(bytes), (writeError) => {
      if (writeError) {
        this.log('error', `write failed on ${this.options.path}: ${writeError.message}`);
      }
    });
    if (this.options.onWrite !== undefined) {
      this.options.onWrite(bytes);
    }
  }

  private log(level: TransportLogLevel, message: string): void {
    if (this.options.log !== undefined) {
      this.options.log(level, message);
    }
  }
}
