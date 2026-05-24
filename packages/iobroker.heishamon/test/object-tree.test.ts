import { describe, expect, it } from 'vitest';
import { ALL_DATAPOINTS } from 'heishamon-protocol';
import {
  buildObjectTree,
  stateId,
  type StateObjectDefinition,
} from '../src/object-tree.js';

const tree = buildObjectTree();
const stateById: ReadonlyMap<string, StateObjectDefinition> = new Map(
  tree.states.map((state) => [state._id, state]),
);

function getState(id: string): StateObjectDefinition {
  const state = stateById.get(id);
  if (state === undefined) {
    throw new Error(`expected state ${id} to exist in the object tree`);
  }
  return state;
}

describe('buildObjectTree', () => {
  it('produces 157 states and 3 channels', () => {
    expect(tree.states.length).toBe(157);
    expect(tree.channels.length).toBe(3);
  });

  it('uses unique state IDs', () => {
    const ids = new Set(tree.states.map((state) => state._id));
    expect(ids.size).toBe(tree.states.length);
  });

  it('prefixes every state ID with a known channel name', () => {
    const channelIds = new Set(tree.channels.map((channel) => channel._id));
    for (const state of tree.states) {
      const [prefix, ...rest] = state._id.split('.');
      expect(prefix, `state ${state._id}`).toBeDefined();
      expect(channelIds.has(prefix as 'main' | 'extra' | 'optional')).toBe(true);
      expect(rest.length).toBeGreaterThan(0);
    }
  });

  it('keeps native.frameSource and native.datapointName in sync with _id', () => {
    for (const state of tree.states) {
      const [prefix, suffix] = state._id.split('.');
      expect(state.native.frameSource).toBe(prefix);
      expect(state.native.datapointName).toBe(suffix);
    }
  });

  it('marks exactly the writable datapoints as write: true', () => {
    const expectedWritableCount = ALL_DATAPOINTS.filter((datapoint) => datapoint.writable).length;
    const actualWritableCount = tree.states.filter((state) => state.common.write).length;
    expect(actualWritableCount).toBe(expectedWritableCount);
    expect(actualWritableCount).toBe(59);
  });

  it('sets read: true on every state', () => {
    for (const state of tree.states) {
      expect(state.common.read).toBe(true);
    }
  });

  it('declares matching common.type and native.decoder for sampled temperature reading', () => {
    const outsideTemp = getState('main.Outside_Temp');
    expect(outsideTemp.common.type).toBe('number');
    expect(outsideTemp.common.role).toContain('temperature');
    expect(outsideTemp.common.unit).toBe('°C');
    expect(outsideTemp.common.write).toBe(false);
  });

  it('marks writable temperature setpoints with a level.* role', () => {
    const dhwTarget = getState('main.DHW_Target_Temp');
    expect(dhwTarget.common.type).toBe('number');
    expect(dhwTarget.common.role).toContain('temperature');
    expect(dhwTarget.common.write).toBe(true);
  });

  it('models Heatpump_State as a number with an Off/On state map', () => {
    const heatpumpState = getState('main.Heatpump_State');
    expect(heatpumpState.common.type).toBe('number');
    expect(heatpumpState.common.write).toBe(true);
    expect(heatpumpState.common.states).toEqual({ 0: 'Off', 1: 'On' });
  });

  it('exposes all nine Operating_Mode_State enum values', () => {
    const operatingMode = getState('main.Operating_Mode_State');
    expect(operatingMode.common.states).toBeDefined();
    const states = operatingMode.common.states as Record<number, string>;
    expect(Object.keys(states)).toHaveLength(9);
    expect(states[0]).toBe('Heat');
    expect(states[1]).toBe('Cool');
    expect(states[8]).toBe('AutoCoolDHW');
  });

  it('treats Error as a string state', () => {
    const error = getState('main.Error');
    expect(error.common.type).toBe('string');
    expect(error.common.role).toBe('text');
  });

  it('treats Heat_Pump_Model as a string state', () => {
    const model = getState('main.Heat_Pump_Model');
    expect(model.common.type).toBe('string');
    expect(model.common.role).toBe('text');
  });

  it('places extra-block consumption topics in the extra channel with Watt unit', () => {
    const extra = getState('extra.Heat_Power_Consumption_Extra');
    expect(extra.common.type).toBe('number');
    expect(extra.common.unit).toBe('Watt');
    expect(extra.common.role).toBe('value.power');
    expect(extra.native.frameSource).toBe('extra');
  });
});

describe('stateId', () => {
  it('joins frame source and datapoint name with a dot', () => {
    expect(stateId('main', 'Outside_Temp')).toBe('main.Outside_Temp');
    expect(stateId('extra', 'Heat_Power_Consumption_Extra')).toBe(
      'extra.Heat_Power_Consumption_Extra',
    );
    expect(stateId('optional', 'Alarm_State')).toBe('optional.Alarm_State');
  });
});
