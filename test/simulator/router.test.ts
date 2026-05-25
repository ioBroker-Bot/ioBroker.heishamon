/**
 * Tests for the simulator's frame router.
 *
 * The router is a pure function over (frame, state) plus the documented
 * in-place mutation of `state`. The tests exercise:
 *  - poll frames produce the correct response and no state change,
 *  - set-commands mutate state and report the touched topics, including
 *    shared-byte topics where only the explicitly-set field must change,
 *  - administrative frames (initial handshake, optional-PCB poll) are
 *    silently ignored,
 *  - frames that should never arrive on the WP->master side (mainResponse
 *    and extraResponse) are flagged as unexpected,
 *  - unrecognised frames are flagged as unrecognized.
 */

import { describe, expect, it } from 'vitest';
import {
  buildFrame,
  decodeMainFrame,
  encodeSetCommand,
  identifyFrame,
} from '../../src/protocol/index.js';

import { handleIncomingFrame } from '../../tools/simulator/router.js';
import { buildExtraResponse, buildMainResponse } from '../../tools/simulator/response-builder.js';
import { createDefaultState } from '../../tools/simulator/state.js';

describe('handleIncomingFrame', () => {
  describe('mainPoll', () => {
    it('responds with the current mainResponse and changes no state', () => {
      const state = createDefaultState();
      const pollFrame = buildFrame('mainPoll');
      const expected = buildMainResponse(state);

      const result = handleIncomingFrame(pollFrame, state);

      expect(result.response).not.toBeNull();
      expect(Array.from(result.response!)).toEqual(Array.from(expected));
      expect(identifyFrame(result.response!)).toBe('mainResponse');
      expect(result.stateChanges).toEqual({});
      expect(result.summary).toContain('mainPoll');
    });

    it('reflects state mutations made between two polls', () => {
      const state = createDefaultState();
      state.DHW_Target_Temp = 55;

      const result = handleIncomingFrame(buildFrame('mainPoll'), state);

      const decoded = decodeMainFrame(result.response!);
      expect(decoded.DHW_Target_Temp).toBe(55);
    });
  });

  describe('extraPoll', () => {
    it('responds with the current extraResponse and changes no state', () => {
      const state = createDefaultState();
      const expected = buildExtraResponse(state);

      const result = handleIncomingFrame(buildFrame('extraPoll'), state);

      expect(result.response).not.toBeNull();
      expect(Array.from(result.response!)).toEqual(Array.from(expected));
      expect(identifyFrame(result.response!)).toBe('extraResponse');
      expect(result.stateChanges).toEqual({});
      expect(result.summary).toContain('extraPoll');
    });
  });

  describe('mainSet — single topic', () => {
    it('updates DHW_Target_Temp and reports it as the only change', () => {
      const state = createDefaultState();
      const before = state.DHW_Target_Temp;
      expect(before).not.toBe(50);

      const setFrame = encodeSetCommand('DHW_Target_Temp', 50);
      const result = handleIncomingFrame(setFrame, state);

      expect(result.response).toBeNull();
      expect(result.stateChanges).toEqual({ DHW_Target_Temp: 50 });
      expect(state.DHW_Target_Temp).toBe(50);
    });

    it('updates Max_Pump_Duty (getIntMinus1) correctly', () => {
      const state = createDefaultState();
      const setFrame = encodeSetCommand('Max_Pump_Duty', 80);

      const result = handleIncomingFrame(setFrame, state);

      expect(result.stateChanges).toEqual({ Max_Pump_Duty: 80 });
      expect(state.Max_Pump_Duty).toBe(80);
    });

    it('updates Operating_Mode_State (getOpMode) correctly', () => {
      const state = createDefaultState();
      const setFrame = encodeSetCommand('Operating_Mode_State', 4);

      const result = handleIncomingFrame(setFrame, state);

      expect(result.stateChanges).toEqual({ Operating_Mode_State: 4 });
      expect(state.Operating_Mode_State).toBe(4);
    });
  });

  describe('mainSet — shared-byte filtering', () => {
    it('reports only Quiet_Mode_Level when byte 7 is written for it', () => {
      // Byte 7 carries Quiet_Mode_Level (bits 3-5), Powerful_Mode_Time
      // (bottom 3 bits) and Quiet_Mode_Schedule (top 2 bits). Setting
      // Quiet_Mode_Level = 2 writes byte 7 = 24 (0x18). The other two
      // fields read all-zero bits and must NOT be reported as changed.
      const state = createDefaultState();
      const setFrame = encodeSetCommand('Quiet_Mode_Level', 2);

      const result = handleIncomingFrame(setFrame, state);

      expect(result.stateChanges).toEqual({ Quiet_Mode_Level: 2 });
      expect(Object.keys(result.stateChanges)).not.toContain('Powerful_Mode_Time');
      expect(Object.keys(result.stateChanges)).not.toContain('Quiet_Mode_Schedule');
      expect(state.Quiet_Mode_Level).toBe(2);
    });

    it('reports only Powerful_Mode_Time when byte 7 is written for it', () => {
      const state = createDefaultState();
      const setFrame = encodeSetCommand('Powerful_Mode_Time', 3);

      const result = handleIncomingFrame(setFrame, state);

      expect(result.stateChanges).toEqual({ Powerful_Mode_Time: 3 });
      expect(state.Powerful_Mode_Time).toBe(3);
    });

    it('reports only Force_DHW_State when byte 4 is written for it', () => {
      // Byte 4 carries Heatpump_State (bottom 2 bits) and Force_DHW_State
      // (top 2 bits). Setting Force_DHW_State = 1 writes byte 4 = 0x80.
      // Decoding Heatpump_State from 0x80 yields (0x80 & 0b11) - 1 = -1,
      // which is the "all-zero default" sentinel and must be filtered.
      const state = createDefaultState();
      const previousHeatpumpState = state.Heatpump_State;
      const setFrame = encodeSetCommand('Force_DHW_State', 1);

      const result = handleIncomingFrame(setFrame, state);

      expect(result.stateChanges).toEqual({ Force_DHW_State: 1 });
      expect(state.Force_DHW_State).toBe(1);
      expect(state.Heatpump_State).toBe(previousHeatpumpState);
    });

    it('reports only Heatpump_State when byte 4 is written for it', () => {
      // Heatpump_State = 1 writes byte 4 = 2 (mapping [1, 2]).
      // Force_DHW_State decoded from byte 4 = 2 -> (2 >> 6) - 1 = -1,
      // again the all-zero default sentinel -> must be filtered.
      const state = createDefaultState();
      const previousForce = state.Force_DHW_State;
      const setFrame = encodeSetCommand('Heatpump_State', 1);

      const result = handleIncomingFrame(setFrame, state);

      expect(result.stateChanges).toEqual({ Heatpump_State: 1 });
      expect(state.Heatpump_State).toBe(1);
      expect(state.Force_DHW_State).toBe(previousForce);
    });

    it('reports only Operating_Mode_State when byte 6 is written for it', () => {
      // Operating_Mode_State = 4 writes byte 6 = 34 (0x22). Zones_State
      // decoded from byte 6 = 0x22 -> (0x22 >> 6) - 1 = -1.
      const state = createDefaultState();
      const previousZones = state.Zones_State;
      const setFrame = encodeSetCommand('Operating_Mode_State', 4);

      const result = handleIncomingFrame(setFrame, state);

      expect(result.stateChanges).toEqual({ Operating_Mode_State: 4 });
      expect(state.Operating_Mode_State).toBe(4);
      expect(state.Zones_State).toBe(previousZones);
    });
  });

  describe('initialHandshake', () => {
    it('is ignored: no response, no state changes', () => {
      const state = createDefaultState();
      const result = handleIncomingFrame(buildFrame('initialHandshake'), state);

      expect(result.response).toBeNull();
      expect(result.stateChanges).toEqual({});
      expect(result.summary).toBe('ignored: initialHandshake');
    });
  });

  describe('optionalPcbPoll', () => {
    it('is ignored: no response, no state changes', () => {
      const state = createDefaultState();
      const result = handleIncomingFrame(buildFrame('optionalPcbPoll'), state);

      expect(result.response).toBeNull();
      expect(result.stateChanges).toEqual({});
      expect(result.summary).toBe('ignored: optionalPcbPoll');
    });
  });

  describe('unexpected response frames', () => {
    it('flags a mainResponse as unexpected and returns no response', () => {
      const state = createDefaultState();
      const wpFrame = buildMainResponse(state);

      const result = handleIncomingFrame(wpFrame, state);

      expect(result.response).toBeNull();
      expect(result.stateChanges).toEqual({});
      expect(result.summary).toMatch(/^unexpected: mainResponse/);
    });

    it('flags an extraResponse as unexpected and returns no response', () => {
      const state = createDefaultState();
      const wpFrame = buildExtraResponse(state);

      const result = handleIncomingFrame(wpFrame, state);

      expect(result.response).toBeNull();
      expect(result.stateChanges).toEqual({});
      expect(result.summary).toMatch(/^unexpected: extraResponse/);
    });
  });

  describe('unrecognised frames', () => {
    it('reports an unknown header without throwing', () => {
      const garbage = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x00, 0x00, 0x00, 0x00]);
      const state = createDefaultState();

      const result = handleIncomingFrame(garbage, state);

      expect(result.response).toBeNull();
      expect(result.stateChanges).toEqual({});
      expect(result.summary).toMatch(/^unrecognized/);
    });

    it('reports a too-short buffer as unrecognized', () => {
      const tooShort = new Uint8Array([0x71]);
      const state = createDefaultState();

      const result = handleIncomingFrame(tooShort, state);

      expect(result.response).toBeNull();
      expect(result.stateChanges).toEqual({});
      expect(result.summary).toMatch(/^unrecognized/);
    });
  });
});
