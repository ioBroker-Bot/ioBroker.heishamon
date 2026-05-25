/**
 * Tests for the heat-pump state model.
 */

import { describe, expect, it } from 'vitest';
import {
  ALL_DATAPOINTS,
  EXTRA_DATAPOINTS,
  MAIN_DATAPOINTS,
  OPTIONAL_DATAPOINTS,
} from '../../src/protocol/index.js';

import {
  TOTAL_DATAPOINT_COUNT,
  createDefaultState,
} from '../../tools/simulator/state.js';

describe('createDefaultState', () => {
  it('contains an entry for every datapoint (157 in total)', () => {
    const state = createDefaultState();
    expect(Object.keys(state)).toHaveLength(TOTAL_DATAPOINT_COUNT);
    expect(TOTAL_DATAPOINT_COUNT).toBe(
      MAIN_DATAPOINTS.length + OPTIONAL_DATAPOINTS.length + EXTRA_DATAPOINTS.length,
    );
    for (const datapoint of ALL_DATAPOINTS) {
      expect(state[datapoint.name]).toBeDefined();
    }
  });

  it('reports the heat pump as running in heat mode', () => {
    const state = createDefaultState();
    expect(state.Heatpump_State).toBe(1);
    expect(state.Operating_Mode_State).toBe(0);
  });

  it('uses plausible temperature defaults', () => {
    const state = createDefaultState();
    // Outside temperature should be a realistic ambient.
    expect(state.Outside_Temp).toBeGreaterThanOrEqual(-50);
    expect(state.Outside_Temp).toBeLessThanOrEqual(50);
    // Flow / DHW temperatures should be above 0 °C, below 90 °C.
    expect(state.Main_Outlet_Temp).toBeGreaterThan(0);
    expect(state.Main_Outlet_Temp).toBeLessThan(90);
    expect(state.DHW_Temp).toBeGreaterThan(0);
    expect(state.DHW_Temp).toBeLessThan(90);
  });

  it('starts the operating counters at zero', () => {
    const state = createDefaultState();
    expect(state.Operations_Hours).toBe(0);
    expect(state.Operations_Counter).toBe(0);
    expect(state.Room_Heater_Operations_Hours).toBe(0);
    expect(state.DHW_Heater_Operations_Hours).toBe(0);
  });

  it('uses "No error" as the default error state', () => {
    const state = createDefaultState();
    expect(state.Error).toBe('No error');
  });

  it('uses the canonical heat-pump model identifier', () => {
    const state = createDefaultState();
    expect(state.Heat_Pump_Model).toBe('E2 CE 0D 71 81 72 CE 0C 92 81');
  });

  it('zeroes all power readings by default', () => {
    const state = createDefaultState();
    expect(state.Heat_Power_Production).toBe(0);
    expect(state.Heat_Power_Consumption).toBe(0);
    expect(state.Cool_Power_Production).toBe(0);
    expect(state.Cool_Power_Consumption).toBe(0);
    expect(state.DHW_Power_Production).toBe(0);
    expect(state.DHW_Power_Consumption).toBe(0);
  });

  it('zeroes all OPT outputs by default', () => {
    const state = createDefaultState();
    for (const datapoint of OPTIONAL_DATAPOINTS) {
      expect(state[datapoint.name]).toBe(0);
    }
  });

  it('zeroes all XTOP outputs by default', () => {
    const state = createDefaultState();
    for (const datapoint of EXTRA_DATAPOINTS) {
      expect(state[datapoint.name]).toBe(0);
    }
  });

  it('returns an independent object on every call', () => {
    const a = createDefaultState();
    const b = createDefaultState();
    a.Outside_Temp = 99;
    expect(b.Outside_Temp).not.toBe(99);
  });
});
