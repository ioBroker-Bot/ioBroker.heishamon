/**
 * Public surface of the `iobroker.heishamon` package.
 *
 * The adapter entry point (`main.ts`) lives separately and is loaded by
 * ioBroker via `package.json#main`. This file re-exports the building blocks
 * we want to make available for testing and for the adapter's internal use.
 */

export { buildObjectTree, stateId } from './object-tree.js';
export type {
  ChannelObjectDefinition,
  InfoStateObjectDefinition,
  ObjectTree,
  StateObjectDefinition,
} from './object-tree.js';

export { ConnectionStats } from './connection-stats.js';
export type { ConnectionStatsOptions, ConnectionStatsSnapshot } from './connection-stats.js';

export { SerialAdapterTransport } from './transport.js';
export type {
  AdapterTransport,
  LogLevel,
  Logger,
  SerialAdapterTransportOptions,
} from './transport.js';

export { Poller } from './poller.js';
export type { PollerOptions, PollerTimers } from './poller.js';

export { StateApplier } from './state-applier.js';
export type { SetStateFn, StateApplierOptions } from './state-applier.js';
