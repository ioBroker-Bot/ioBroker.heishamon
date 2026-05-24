/**
 * Round-trip tests for the response-frame builders.
 *
 * Strategy: take a default state, override one (or two) datapoints to
 * a known value, build the frame, and decode it again with the
 * protocol library. The decoded value must match what we put in.
 */

import { describe, expect, it } from 'vitest';
import {
  MAIN_DATAPOINTS,
  decodeExtraFrame,
  decodeMainFrame,
  identifyFrame,
  verifyFrame,
  type DataPoint,
} from 'heishamon-protocol';

import { buildExtraResponse, buildMainResponse } from '../src/response-builder.js';
import { createDefaultState, type HeatPumpState } from '../src/state.js';

function withOverrides(overrides: HeatPumpState): HeatPumpState {
  return { ...createDefaultState(), ...overrides };
}

function findMain(name: string): DataPoint {
  const datapoint = MAIN_DATAPOINTS.find((entry) => entry.name === name);
  if (datapoint === undefined) {
    throw new Error(`unknown main datapoint: ${name}`);
  }
  return datapoint;
}

describe('buildMainResponse', () => {
  it('produces a 203-byte frame', () => {
    const frame = buildMainResponse(createDefaultState());
    expect(frame).toHaveLength(203);
  });

  it('uses the mainResponse header', () => {
    const frame = buildMainResponse(createDefaultState());
    expect(Array.from(frame.subarray(0, 4))).toEqual([0x71, 0xc8, 0x01, 0x10]);
    expect(identifyFrame(frame)).toBe('mainResponse');
  });

  it('produces a frame with a valid checksum', () => {
    const frame = buildMainResponse(createDefaultState());
    expect(verifyFrame(frame)).toBe(true);
  });

  it('round-trips the default state through the decoder', () => {
    const state = createDefaultState();
    const frame = buildMainResponse(state);
    const decoded = decodeMainFrame(frame);

    for (const datapoint of MAIN_DATAPOINTS) {
      const original = state[datapoint.name];
      const roundTripped = decoded[datapoint.name];
      if (typeof original === 'number' && typeof roundTripped === 'number') {
        // Some decoders lose precision (Div5/Div50, Times10/50, getPower):
        // they only store one byte. We accept rounding errors up to the
        // step size of the encoding.
        const tolerance = toleranceFor(datapoint);
        expect(
          Math.abs(roundTripped - original),
          `roundtrip mismatch for ${datapoint.name}: ${original} -> ${roundTripped}`,
        ).toBeLessThanOrEqual(tolerance);
      } else {
        expect(roundTripped).toBe(original);
      }
    }
  });

  describe('round-trip per decoder kind', () => {
    it.each([
      ['Outside_Temp', -40],
      ['Outside_Temp', 0],
      ['Outside_Temp', 35],
      ['Outside_Temp', 60],
      ['Main_Outlet_Temp', -10],
      ['Main_Outlet_Temp', 55],
      ['DHW_Target_Temp', 48],
    ])('getIntMinus128 %s = %i', (name, value) => {
      const frame = buildMainResponse(withOverrides({ [name]: value }));
      expect(decodeMainFrame(frame)[name]).toBe(value);
    });

    it.each([
      ['Compressor_Freq', 0],
      ['Compressor_Freq', 30],
      ['Compressor_Freq', 120],
      ['Pump_Duty', 0],
      ['Pump_Duty', 50],
      ['Sterilization_Max_Time', 30],
    ])('getIntMinus1 %s = %i', (name, value) => {
      const frame = buildMainResponse(withOverrides({ [name]: value }));
      expect(decodeMainFrame(frame)[name]).toBe(value);
    });

    it.each([
      ['Heat_Power_Production', 0],
      ['Heat_Power_Production', 200],
      ['Heat_Power_Consumption', 1000],
      ['DHW_Power_Production', 10000],
    ])('getPower %s = %i', (name, value) => {
      const frame = buildMainResponse(withOverrides({ [name]: value }));
      expect(decodeMainFrame(frame)[name]).toBe(value);
    });

    it.each([
      ['Fan1_Motor_Speed', 0],
      ['Fan1_Motor_Speed', 1500],
      ['Fan2_Motor_Speed', 2540], // (254-1)*10 max from a byte
    ])('getIntMinus1Times10 %s = %i', (name, value) => {
      const frame = buildMainResponse(withOverrides({ [name]: value }));
      expect(decodeMainFrame(frame)[name]).toBe(value);
    });

    it.each([
      ['Pump_Speed', 0],
      ['Pump_Speed', 2500],
      ['Low_Pressure', 0],
      ['Low_Pressure', 5000],
    ])('getIntMinus1Times50 %s = %i', (name, value) => {
      const frame = buildMainResponse(withOverrides({ [name]: value }));
      expect(decodeMainFrame(frame)[name]).toBe(value);
    });

    it.each([
      ['High_Pressure', 0],
      ['High_Pressure', 30],
      ['Compressor_Current', 5],
    ])('getIntMinus1Div5 %s = %i', (name, value) => {
      const frame = buildMainResponse(withOverrides({ [name]: value }));
      expect(decodeMainFrame(frame)[name]).toBe(value);
    });

    it.each([
      ['Water_Pressure', 1.0],
      ['Water_Pressure', 2.5],
      ['Water_Pressure', 5.0],
    ])('getIntMinus1Div50 %s = %f', (name, value) => {
      const frame = buildMainResponse(withOverrides({ [name]: value }));
      const decoded = decodeMainFrame(frame)[name];
      expect(decoded).toBeCloseTo(value as number, 2);
    });

    it.each([
      ['Z1_Valve_PID', 0],
      ['Z1_Valve_PID', 50],
      ['Z2_Valve_PID', 100],
    ])('getValvePID %s = %i', (name, value) => {
      const frame = buildMainResponse(withOverrides({ [name]: value }));
      expect(decodeMainFrame(frame)[name]).toBe(value);
    });

    it.each([0, 1, 2, 3, 4, 5, 6, 7, 8])(
      'getOpMode Operating_Mode_State = %i',
      (value) => {
        const frame = buildMainResponse(withOverrides({ Operating_Mode_State: value }));
        expect(decodeMainFrame(frame).Operating_Mode_State).toBe(value);
      },
    );

    it.each([
      ['Heatpump_State', 0],
      ['Heatpump_State', 1],
      ['Force_DHW_State', 0],
      ['Force_DHW_State', 1],
      ['Zones_State', 0],
      ['Zones_State', 1],
      ['Zones_State', 2],
    ])('getBit1and2 %s = %i', (name, value) => {
      const frame = buildMainResponse(withOverrides({ [name]: value }));
      expect(decodeMainFrame(frame)[name]).toBe(value);
    });

    it.each([
      ['Holiday_Mode_State', 0],
      ['Holiday_Mode_State', 1],
      ['Holiday_Mode_State', 2],
    ])('getBit3and4 %s = %i', (name, value) => {
      const frame = buildMainResponse(withOverrides({ [name]: value }));
      expect(decodeMainFrame(frame)[name]).toBe(value);
    });

    it.each([
      ['Quiet_Mode_Level', 0],
      ['Quiet_Mode_Level', 1],
      ['Quiet_Mode_Level', 2],
      ['Quiet_Mode_Level', 3],
    ])('getBit3and4and5 %s = %i', (name, value) => {
      const frame = buildMainResponse(withOverrides({ [name]: value }));
      expect(decodeMainFrame(frame)[name]).toBe(value);
    });

    it.each([
      ['Defrosting_State', 0],
      ['Defrosting_State', 1],
      ['Sterilization_State', 1],
    ])('getBit5and6 %s = %i', (name, value) => {
      const frame = buildMainResponse(withOverrides({ [name]: value }));
      expect(decodeMainFrame(frame)[name]).toBe(value);
    });

    it.each([
      ['ThreeWay_Valve_State', 0],
      ['ThreeWay_Valve_State', 1],
      ['DHW_Sensor_Selection', 1],
    ])('getBit7and8 %s = %i', (name, value) => {
      const frame = buildMainResponse(withOverrides({ [name]: value }));
      expect(decodeMainFrame(frame)[name]).toBe(value);
    });

    it.each([
      ['Powerful_Mode_Time', 0],
      ['Powerful_Mode_Time', 1],
      ['Powerful_Mode_Time', 2],
      ['Powerful_Mode_Time', 3],
    ])('getRight3bits %s = %i', (name, value) => {
      const frame = buildMainResponse(withOverrides({ [name]: value }));
      expect(decodeMainFrame(frame)[name]).toBe(value);
    });

    it.each([
      ['Z1_Sensor_Settings', 0],
      ['Z1_Sensor_Settings', 3],
    ])('getSecondByte %s = %i', (name, value) => {
      const frame = buildMainResponse(withOverrides({ [name]: value }));
      expect(decodeMainFrame(frame)[name]).toBe(value);
    });

    it.each([
      ['Z2_Sensor_Settings', 0],
      ['Z2_Sensor_Settings', 3],
    ])('getFirstByte %s = %i', (name, value) => {
      const frame = buildMainResponse(withOverrides({ [name]: value }));
      expect(decodeMainFrame(frame)[name]).toBe(value);
    });

    it.each([
      ['Liquid_Type', 0],
      ['Liquid_Type', 1],
    ])('getBit1 %s = %i', (name, value) => {
      const frame = buildMainResponse(withOverrides({ [name]: value }));
      expect(decodeMainFrame(frame)[name]).toBe(value);
    });
  });

  describe('special-case main datapoints', () => {
    it.each([0, 11.5, 25.123])('Pump_Flow round-trips %f', (value) => {
      const frame = buildMainResponse(withOverrides({ Pump_Flow: value }));
      const decoded = decodeMainFrame(frame).Pump_Flow as number;
      // Fractional byte has 1/256 step, so tolerance ~ 1/256.
      expect(decoded).toBeCloseTo(value, 2);
    });

    it.each([0, 1, 100, 9999])('Operations_Hours = %i', (value) => {
      const frame = buildMainResponse(withOverrides({ Operations_Hours: value }));
      expect(decodeMainFrame(frame).Operations_Hours).toBe(value);
    });

    it.each([0, 1, 65534])('Operations_Counter = %i', (value) => {
      const frame = buildMainResponse(withOverrides({ Operations_Counter: value }));
      expect(decodeMainFrame(frame).Operations_Counter).toBe(value);
    });

    it.each([0, 50, 500])('Room_Heater_Operations_Hours = %i', (value) => {
      const frame = buildMainResponse(withOverrides({ Room_Heater_Operations_Hours: value }));
      expect(decodeMainFrame(frame).Room_Heater_Operations_Hours).toBe(value);
    });

    it.each([0, 50, 500])('DHW_Heater_Operations_Hours = %i', (value) => {
      const frame = buildMainResponse(withOverrides({ DHW_Heater_Operations_Hours: value }));
      expect(decodeMainFrame(frame).DHW_Heater_Operations_Hours).toBe(value);
    });

    it.each(['No error', 'F12', 'H05'])('Error = %s', (value) => {
      const frame = buildMainResponse(withOverrides({ Error: value }));
      expect(decodeMainFrame(frame).Error).toBe(value);
    });

    it('encodes an empty Error string as "No error"', () => {
      const frame = buildMainResponse(withOverrides({ Error: '' }));
      expect(decodeMainFrame(frame).Error).toBe('No error');
    });

    it('round-trips the heat pump model identifier', () => {
      const model = 'E2 CE 0D 71 81 72 CE 0C 92 81';
      const frame = buildMainResponse(withOverrides({ Heat_Pump_Model: model }));
      expect(decodeMainFrame(frame).Heat_Pump_Model).toBe(model);
    });
  });

  describe('shared-byte bit merge', () => {
    it('preserves both Quiet_Mode_Level and Powerful_Mode_Time on byte 7', () => {
      // Byte 7 carries Powerful_Mode_Time (bottom 3 bits), Quiet_Mode_Level
      // (bits 3-5), and Quiet_Mode_Schedule (top 2 bits). Setting any two
      // of them must not clobber the third.
      const state = withOverrides({
        Quiet_Mode_Level: 2,
        Powerful_Mode_Time: 1,
        Quiet_Mode_Schedule: 1,
      });
      const decoded = decodeMainFrame(buildMainResponse(state));
      expect(decoded.Quiet_Mode_Level).toBe(2);
      expect(decoded.Powerful_Mode_Time).toBe(1);
      expect(decoded.Quiet_Mode_Schedule).toBe(1);
    });

    it('preserves Operating_Mode_State and Zones_State on byte 6', () => {
      const state = withOverrides({
        Operating_Mode_State: 4, // -> 34
        Zones_State: 2,          // -> top 2 bits
      });
      const decoded = decodeMainFrame(buildMainResponse(state));
      expect(decoded.Operating_Mode_State).toBe(4);
      expect(decoded.Zones_State).toBe(2);
    });

    it('preserves all four bit-fields on byte 20', () => {
      const state = withOverrides({
        Liquid_Type: 1,
        Alt_External_Sensor: 1,
        Anti_Freeze_Mode: 1,
        Optional_PCB: 1,
      });
      const decoded = decodeMainFrame(buildMainResponse(state));
      expect(decoded.Liquid_Type).toBe(1);
      expect(decoded.Alt_External_Sensor).toBe(1);
      expect(decoded.Anti_Freeze_Mode).toBe(1);
      expect(decoded.Optional_PCB).toBe(1);
    });
  });
});

describe('buildExtraResponse', () => {
  it('produces a 203-byte frame', () => {
    const frame = buildExtraResponse(createDefaultState());
    expect(frame).toHaveLength(203);
  });

  it('uses the extraResponse header', () => {
    const frame = buildExtraResponse(createDefaultState());
    expect(Array.from(frame.subarray(0, 4))).toEqual([0x71, 0xc8, 0x01, 0x21]);
    expect(identifyFrame(frame)).toBe('extraResponse');
  });

  it('produces a frame with a valid checksum', () => {
    const frame = buildExtraResponse(createDefaultState());
    expect(verifyFrame(frame)).toBe(true);
  });

  it.each([
    ['Heat_Power_Consumption_Extra', 1234],
    ['Cool_Power_Consumption_Extra', 0],
    ['DHW_Power_Consumption_Extra', 5000],
    ['Heat_Power_Production_Extra', 9999],
    ['Cool_Power_Production_Extra', 1],
    ['DHW_Power_Production_Extra', 42],
  ])('round-trips %s = %i', (name, value) => {
    const state = withOverrides({ [name]: value });
    const frame = buildExtraResponse(state);
    const decoded = decodeExtraFrame(frame);
    expect(decoded[name]).toBe(value);
  });
});

/**
 * Precision tolerance for round-trip comparisons. The decoders that
 * pack a value into a single byte lose precision; we accept errors up
 * to one encoding step. All other decoders are exact.
 */
function toleranceFor(datapoint: DataPoint): number {
  switch (datapoint.decoder) {
    case 'getIntMinus1Times10':
      return 10;
    case 'getIntMinus1Times50':
      return 50;
    case 'getPower':
      return 200;
    case 'getIntMinus1Div5':
      return 0.2 + 1e-9;
    case 'getIntMinus1Div50':
      return 0.02 + 1e-9;
    case 'getValvePID':
      return 0.5 + 1e-9;
    case 'unknown':
      // Pump_Flow has fractional precision 1/256; counters are exact.
      if (datapoint.name === 'Pump_Flow') {
        return 1 / 256 + 1e-9;
      }
      return 0;
    default:
      return 0;
  }
}
