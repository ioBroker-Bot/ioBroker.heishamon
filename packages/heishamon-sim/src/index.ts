/**
 * Public API for the heat-pump simulator.
 *
 * This package is consumed by the simulator CLI and (in tests) by the
 * adapter to drive a fake heat pump. Only state and frame-building are
 * re-exported here; transport/router/CLI modules live in their own
 * files and are not yet wired up.
 */

export {
  TOTAL_DATAPOINT_COUNT,
  createDefaultState,
  type HeatPumpState,
} from './state.js';

export { buildExtraResponse, buildMainResponse } from './response-builder.js';

export { handleIncomingFrame, type RouterResult } from './router.js';

export { Framer, type FramerEvent } from './framer.js';
