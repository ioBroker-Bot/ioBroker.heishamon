/**
 * Tests for the transport-agnostic simulator engine.
 *
 * The engine is the seam between the byte-level framer and the
 * frame-level router. These tests exercise the contract the rest of the
 * system relies on:
 *  - a clean poll round-trip produces the documented response,
 *  - set-commands mutate state and produce no response,
 *  - noise interleaved with a valid frame is surfaced as invalid events
 *    without dropping the valid frame,
 *  - external state changes via `updateState` are reflected on the wire,
 *  - bytes split across multiple chunks are buffered until the frame is
 *    complete.
 */

import { describe, expect, it } from 'vitest';
import {
  buildFrame,
  decodeMainFrame,
  encodeSetCommand,
} from '../../src/protocol/index.js';

import { SimulatorEngine } from '../../src/simulator/engine.js';
import { buildMainResponse } from '../../src/simulator/response-builder.js';
import { createDefaultState } from '../../src/simulator/state.js';

function concat(...parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((acc, part) => acc + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

describe('SimulatorEngine', () => {
  describe('mainPoll round-trip', () => {
    it('responds with the expected mainResponse for the current state', () => {
      const engine = new SimulatorEngine();
      const expected = buildMainResponse(engine.state);
      const poll = buildFrame('mainPoll');

      const { events, outgoing } = engine.processIncoming(poll);

      expect(events).toHaveLength(1);
      const event = events[0];
      expect(event).toBeDefined();
      if (event === undefined) {
        return;
      }
      expect(event.framerEvent.kind).toBe('frame');
      if (event.framerEvent.kind !== 'frame') {
        return;
      }
      expect(event.framerEvent.frameType).toBe('mainPoll');
      expect(event.routerResult).not.toBeNull();
      expect(event.routerResult?.response).not.toBeNull();

      expect(outgoing).toHaveLength(1);
      expect(Array.from(outgoing[0] ?? new Uint8Array())).toEqual(Array.from(expected));
    });
  });

  describe('mainSet', () => {
    it('mutates state and produces no outgoing frame', () => {
      const engine = new SimulatorEngine();
      expect(engine.state.DHW_Target_Temp).not.toBe(55);
      const setFrame = encodeSetCommand('DHW_Target_Temp', 55);

      const { events, outgoing } = engine.processIncoming(setFrame);

      expect(outgoing).toEqual([]);
      expect(engine.state.DHW_Target_Temp).toBe(55);
      expect(events).toHaveLength(1);
      expect(events[0]?.routerResult?.stateChanges).toEqual({ DHW_Target_Temp: 55 });
    });
  });

  describe('garbage interleaved with a valid frame', () => {
    it('surfaces invalid events but still responds to the embedded poll', () => {
      const engine = new SimulatorEngine();
      const garbage = new Uint8Array([0xff, 0xff]);
      const poll = buildFrame('mainPoll');
      const chunk = concat(garbage, poll);

      const { events, outgoing } = engine.processIncoming(chunk);

      const invalids = events.filter((event) => event.framerEvent.kind === 'invalid');
      const frames = events.filter((event) => event.framerEvent.kind === 'frame');

      expect(invalids).toHaveLength(2);
      for (const invalid of invalids) {
        expect(invalid.routerResult).toBeNull();
      }
      expect(frames).toHaveLength(1);
      expect(outgoing).toHaveLength(1);

      const expected = buildMainResponse(engine.state);
      expect(Array.from(outgoing[0] ?? new Uint8Array())).toEqual(Array.from(expected));
    });
  });

  describe('updateState', () => {
    it('is reflected in the next mainResponse', () => {
      const engine = new SimulatorEngine();
      engine.updateState({ Outside_Temp: -7 });

      const { outgoing } = engine.processIncoming(buildFrame('mainPoll'));

      expect(outgoing).toHaveLength(1);
      const response = outgoing[0];
      expect(response).toBeDefined();
      if (response === undefined) {
        return;
      }
      const decoded = decodeMainFrame(response);
      expect(decoded.Outside_Temp).toBe(-7);
    });

    it('accepts a custom initial state via the constructor', () => {
      const state = createDefaultState();
      state.DHW_Target_Temp = 42;
      const engine = new SimulatorEngine(state);
      expect(engine.state).toBe(state);
      expect(engine.state.DHW_Target_Temp).toBe(42);
    });
  });

  describe('chunked input', () => {
    it('emits a response only once the final chunk completes the frame', () => {
      const engine = new SimulatorEngine();
      const poll = buildFrame('mainPoll');

      // Split a 10-byte mainPoll into three uneven chunks; the engine
      // must buffer the partial bytes and only emit a response on the
      // chunk that completes the frame.
      const splitA = poll.slice(0, 3);
      const splitB = poll.slice(3, 7);
      const splitC = poll.slice(7);
      expect(splitA.length + splitB.length + splitC.length).toBe(poll.length);

      const first = engine.processIncoming(splitA);
      expect(first.events).toEqual([]);
      expect(first.outgoing).toEqual([]);

      const second = engine.processIncoming(splitB);
      expect(second.events).toEqual([]);
      expect(second.outgoing).toEqual([]);

      const third = engine.processIncoming(splitC);
      expect(third.events).toHaveLength(1);
      expect(third.outgoing).toHaveLength(1);

      const expected = buildMainResponse(engine.state);
      expect(Array.from(third.outgoing[0] ?? new Uint8Array())).toEqual(Array.from(expected));
    });
  });
});
