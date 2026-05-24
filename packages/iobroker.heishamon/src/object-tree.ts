/**
 * Build ioBroker-style object definitions from the HeishaMon datapoint table.
 *
 * This module is a pure function: same input (the `ALL_DATAPOINTS` table from
 * `heishamon-protocol`) always produces the same output. It does not depend on
 * `@iobroker/types` at runtime — the returned shapes mirror the subset of
 * fields that `iobroker.setObject` accepts.
 *
 * The adapter layer is responsible for calling `setObject` with each entry
 * and prefixing its instance namespace (e.g. `heishamon.0.`); this module
 * returns device-relative IDs only (`main.Outside_Temp`).
 */

import {
  ALL_DATAPOINTS,
  type DataPoint,
  type DecoderKind,
  type FrameSource,
} from 'heishamon-protocol';

export interface StateObjectDefinition {
  readonly _id: string;
  readonly type: 'state';
  readonly common: {
    readonly name: string;
    readonly type: 'number' | 'string' | 'boolean';
    readonly role: string;
    readonly read: true;
    readonly write: boolean;
    readonly unit?: string;
    readonly desc?: string;
    readonly states?: Readonly<Record<number, string>>;
  };
  readonly native: Readonly<{
    readonly datapointId: string;
    readonly datapointName: string;
    readonly frameSource: FrameSource;
    readonly decoder: DecoderKind;
  }>;
}

export interface ChannelObjectDefinition {
  readonly _id: FrameSource;
  readonly type: 'channel';
  readonly common: {
    readonly name: string;
  };
  readonly native: Record<string, never>;
}

export interface ObjectTree {
  readonly channels: readonly ChannelObjectDefinition[];
  readonly states: readonly StateObjectDefinition[];
}

const CHANNEL_DEFINITIONS: readonly ChannelObjectDefinition[] = [
  {
    _id: 'main',
    type: 'channel',
    common: { name: 'Main response frame (TOP0–TOP143)' },
    native: {},
  },
  {
    _id: 'extra',
    type: 'channel',
    common: { name: 'Extra block response (XTOP0–XTOP5, K/L-series)' },
    native: {},
  },
  {
    _id: 'optional',
    type: 'channel',
    common: { name: 'Optional PCB frame (OPT0–OPT6)' },
    native: {},
  },
];

/**
 * Enum-state mappings. Keys are datapoint names (HeishaMon MQTT topic suffixes).
 *
 * Values are derived from the decoder mappings in `heishamon-protocol`'s
 * `decoders.ts`. We hard-code them here because the protocol library returns
 * the *decoded* enum string, not the original numeric code — and ioBroker
 * convention stores enums as numbers with a `states` label map.
 */
const ENUM_STATES: ReadonlyMap<string, Readonly<Record<number, string>>> = new Map([
  // Pure on/off topics (most getBit*-based booleans modelled as 0/1 numbers).
  ['Heatpump_State', { 0: 'Off', 1: 'On' }],
  ['Force_DHW_State', { 0: 'Off', 1: 'On' }],
  ['Defrosting_State', { 0: 'Off', 1: 'On' }],
  ['DHW_Heater_State', { 0: 'Off', 1: 'On' }],
  ['Room_Heater_State', { 0: 'Off', 1: 'On' }],
  ['Internal_Heater_State', { 0: 'Off', 1: 'On' }],
  ['External_Heater_State', { 0: 'Off', 1: 'On' }],
  ['Force_Heater_State', { 0: 'Off', 1: 'On' }],
  ['Sterilization_State', { 0: 'Off', 1: 'On' }],
  ['Main_Schedule_State', { 0: 'Off', 1: 'On' }],
  ['Quiet_Mode_Schedule', { 0: 'Off', 1: 'On' }],
  ['Z1_Pump_State', { 0: 'Off', 1: 'On' }],
  ['Z2_Pump_State', { 0: 'Off', 1: 'On' }],

  // Multi-state enums.
  ['Holiday_Mode_State', { 0: 'Off', 1: 'Scheduled', 2: 'Active' }],
  [
    'Operating_Mode_State',
    {
      0: 'Heat',
      1: 'Cool',
      2: 'AutoHeat',
      3: 'DHW',
      4: 'HeatDHW',
      5: 'CoolDHW',
      6: 'AutoHeatDHW',
      7: 'AutoCool',
      8: 'AutoCoolDHW',
    },
  ],
  ['Powerful_Mode_Time', { 0: 'Off', 1: '30min', 2: '60min', 3: '90min' }],
  ['Quiet_Mode_Level', { 0: 'Off', 1: 'Level1', 2: 'Level2', 3: 'Level3' }],
  ['ThreeWay_Valve_State', { 0: 'Room', 1: 'DHW' }],
  ['ThreeWay_Valve_State2', { 0: 'Inactive', 1: 'Active' }],
  ['TwoWay_Valve_State', { 0: 'Cool', 1: 'Heat' }],
  ['Heating_Mode', { 0: 'CompensationCurve', 1: 'Direct' }],
  ['Cooling_Mode', { 0: 'CompensationCurve', 1: 'Direct' }],
  ['Zones_State', { 0: 'Z1Only', 1: 'Z2Only', 2: 'Z1AndZ2' }],

  // Optional PCB outputs.
  ['Z1_Water_Pump', { 0: 'Off', 1: 'On' }],
  ['Z2_Water_Pump', { 0: 'Off', 1: 'On' }],
  ['Pool_Water_Pump', { 0: 'Off', 1: 'On' }],
  ['Solar_Water_Pump', { 0: 'Off', 1: 'On' }],
  ['Alarm_State', { 0: 'Off', 1: 'On' }],
  ['Z1_Mixing_Valve', { 0: 'Off', 1: 'Decrease', 2: 'Increase', 3: 'Invalid' }],
  ['Z2_Mixing_Valve', { 0: 'Off', 1: 'Decrease', 2: 'Increase', 3: 'Invalid' }],
]);

/**
 * Datapoints whose decoder runs through HeishaMon's `getDataValue()` dispatch
 * and produces a `string` instead of a number. These are listed in
 * `datapoints.ts` with decoder `'unknown'`; we name them explicitly because
 * the table also has numeric-`unknown` entries (Pump_Flow, Operations_Hours,
 * Operations_Counter, Room/DHW_Heater_Operations_Hours) that must stay numbers.
 */
const STRING_DATAPOINTS: ReadonlySet<string> = new Set(['Error', 'Heat_Pump_Model']);

function determineCommonType(datapoint: DataPoint): 'number' | 'string' {
  if (datapoint.decoder === 'getErrorInfo') return 'string';
  if (STRING_DATAPOINTS.has(datapoint.name)) return 'string';
  return 'number';
}

/**
 * Heuristic role mapping. ioBroker roles are convention, not contract — the
 * adapter UI and VIS use them as hints. We pick the most specific match.
 */
function determineRole(datapoint: DataPoint, commonType: 'number' | 'string'): string {
  if (commonType === 'string') return 'text';

  const { name, unit, decoder, writable } = datapoint;

  // Temperature: explicit name suffix wins, then unit °C with the canonical
  // signed-byte decoder.
  const looksLikeTemperature =
    name.endsWith('_Temp') || (decoder === 'getIntMinus128' && unit === '°C');
  if (looksLikeTemperature) {
    return writable ? 'level.temperature' : 'value.temperature';
  }

  if (decoder === 'getPower' || unit === 'Watt') return 'value.power';
  if (name.includes('_Pressure')) return 'value.pressure';

  if (
    name.includes('_Speed') ||
    name.includes('_Freq') ||
    name.includes('_Motor') ||
    unit === 'r/min' ||
    unit === 'Hz'
  ) {
    return 'value.speed';
  }

  // Generic numeric fallback. `l/min` (flow), `%` (duty), `K` (delta-T),
  // `bar`, `Ampere`, `min`, `h`, `Steps`, `count`, undefined units all land
  // here. ioBroker's `value` role is the documented default.
  return 'value';
}

/**
 * Look up a datapoint by name. Used by tests and the adapter layer to find
 * the StateObjectDefinition matching an incoming decoded value.
 */
export function stateId(frameSource: FrameSource, name: string): string {
  return `${frameSource}.${name}`;
}

function buildStateDefinition(datapoint: DataPoint): StateObjectDefinition {
  const commonType = determineCommonType(datapoint);
  const role = determineRole(datapoint, commonType);
  const enumStates = ENUM_STATES.get(datapoint.name);

  // We build `common` field-by-field because the optional properties
  // (`unit`, `desc`, `states`) must be omitted entirely when absent —
  // `exactOptionalPropertyTypes` in tsconfig forbids `undefined` values.
  const common: StateObjectDefinition['common'] = {
    name: datapoint.description ?? datapoint.name,
    type: commonType,
    role,
    read: true,
    write: datapoint.writable,
    ...(datapoint.unit !== undefined ? { unit: datapoint.unit } : {}),
    ...(datapoint.description !== undefined ? { desc: datapoint.description } : {}),
    ...(enumStates !== undefined ? { states: enumStates } : {}),
  };

  return {
    _id: stateId(datapoint.source, datapoint.name),
    type: 'state',
    common,
    native: {
      datapointId: datapoint.id,
      datapointName: datapoint.name,
      frameSource: datapoint.source,
      decoder: datapoint.decoder,
    },
  };
}

/**
 * Build the full object tree: all 157 datapoints as state objects, plus the
 * three channels they live in.
 */
export function buildObjectTree(): ObjectTree {
  const states = ALL_DATAPOINTS.map(buildStateDefinition);
  return {
    channels: CHANNEL_DEFINITIONS,
    states,
  };
}
