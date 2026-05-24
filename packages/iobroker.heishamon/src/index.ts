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
  ObjectTree,
  StateObjectDefinition,
} from './object-tree.js';
