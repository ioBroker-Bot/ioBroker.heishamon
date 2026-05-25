import { describe, expect, it } from 'vitest';

import { verifyFrame } from '../../src/protocol/crc.js';
import {
  FRAME_LENGTHS,
  buildFrame,
  createTemplate,
  identifyFrame,
  type FrameType,
} from '../../src/protocol/frames.js';

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error(`hex string has odd length: ${hex.length}`);
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

// Real on-wire fixtures borrowed from
// vendor/heishamon-upstream/Tools/chksumChecker.js. Used to assert
// identifyFrame works on data that actually leaves the bus, not just on
// synthetic 4-byte stubs.
const QRY_FRAME_HEX =
  '716c01100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000012';
const ANS_FRAME_HEX =
  '71c801105655624900050000000000000000000019151155165e550509000000000000000000808f808ab27171979900000000000000000000008085158a8585d07b781f7e1f1f79798d8d9e96718fb7a37b8f8e85808f8a949e8a8a949e82908b056578c10b00000000000000005556552153155a051212190000000000000000e2ce0d718172ce0c9281b000aa7cabb032329cb632323280b7afcd9aac79807780ff9101295900003b0b1c51590136790101c30200dd02000500000100000601010101010a1400000077';
const QUIETMODE1_FRAME_HEX =
  'f16c01100000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000082';
const SET_TANK_TO_48C_FRAME_HEX =
  'f16c01100000000000000000000000000000000000000000000000000000000000000000000000000000b000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000e2';

// Headers used for synthetic identifyFrame tests. Pad each one out so
// identifyFrame sees a buffer of realistic shape, even though it only
// inspects the first four bytes.
const HEADER_BY_TYPE: Readonly<Record<FrameType, readonly number[]>> = {
  initialHandshake: [0x31, 0x05, 0x10, 0x01],
  mainPoll: [0x71, 0x6c, 0x01, 0x10],
  extraPoll: [0x71, 0x6c, 0x01, 0x21],
  mainResponse: [0x71, 0xc8, 0x01, 0x10],
  extraResponse: [0x71, 0xc8, 0x01, 0x21],
  mainSet: [0xf1, 0x6c, 0x01, 0x10],
  optionalPcbPoll: [0xf1, 0x11, 0x01, 0x50],
};

function paddedFrame(type: FrameType): Uint8Array {
  const header = HEADER_BY_TYPE[type];
  const frame = new Uint8Array(8);
  frame.set(header, 0);
  return frame;
}

describe('identifyFrame', () => {
  it.each(Object.keys(HEADER_BY_TYPE) as FrameType[])(
    'identifies frame type from header: %s',
    (type) => {
      expect(identifyFrame(paddedFrame(type))).toBe(type);
    },
  );

  it('returns null for an unknown header signature', () => {
    expect(identifyFrame(Uint8Array.of(0x00, 0x00, 0x00, 0x00))).toBeNull();
    expect(identifyFrame(Uint8Array.of(0xff, 0xff, 0xff, 0xff))).toBeNull();
    // Looks almost like mainPoll but the third byte is wrong.
    expect(identifyFrame(Uint8Array.of(0x71, 0x6c, 0x02, 0x10))).toBeNull();
  });

  it('returns null for frames shorter than 4 bytes', () => {
    expect(identifyFrame(new Uint8Array(0))).toBeNull();
    expect(identifyFrame(Uint8Array.of(0x71))).toBeNull();
    expect(identifyFrame(Uint8Array.of(0x71, 0x6c))).toBeNull();
    expect(identifyFrame(Uint8Array.of(0x71, 0x6c, 0x01))).toBeNull();
  });

  it('identifies the real qry fixture as mainPoll', () => {
    expect(identifyFrame(hexToBytes(QRY_FRAME_HEX))).toBe('mainPoll');
  });

  it('identifies the real ans fixture as mainResponse', () => {
    expect(identifyFrame(hexToBytes(ANS_FRAME_HEX))).toBe('mainResponse');
  });

  it.each([
    ['Quietmode1', QUIETMODE1_FRAME_HEX],
    ['settankto48C', SET_TANK_TO_48C_FRAME_HEX],
  ])('identifies real set fixture as mainSet: %s', (_label, hex) => {
    expect(identifyFrame(hexToBytes(hex))).toBe('mainSet');
  });
});

describe('FRAME_LENGTHS', () => {
  it('matches the documented total lengths', () => {
    expect(FRAME_LENGTHS).toEqual({
      initialHandshake: 8,
      mainPoll: 111,
      extraPoll: 111,
      mainResponse: 203,
      extraResponse: 203,
      mainSet: 111,
      optionalPcbPoll: 20,
    });
  });
});

describe('createTemplate', () => {
  const buildableTypes: FrameType[] = [
    'initialHandshake',
    'mainPoll',
    'extraPoll',
    'mainSet',
    'optionalPcbPoll',
  ];

  it.each(buildableTypes)(
    'produces a payload of FRAME_LENGTHS[type] - 1 bytes: %s',
    (type) => {
      const template = createTemplate(type);
      expect(template).toBeInstanceOf(Uint8Array);
      expect(template.length).toBe(FRAME_LENGTHS[type] - 1);
    },
  );

  it.each(buildableTypes)('starts with the correct 4-byte header: %s', (type) => {
    const template = createTemplate(type);
    const header = HEADER_BY_TYPE[type];
    expect(Array.from(template.slice(0, 4))).toEqual(Array.from(header));
  });

  it('mainPoll and extraPoll differ only in byte 3', () => {
    const main = createTemplate('mainPoll');
    const extra = createTemplate('extraPoll');
    expect(main.length).toBe(extra.length);

    const diffIndices: number[] = [];
    for (let i = 0; i < main.length; i++) {
      if (main[i] !== extra[i]) {
        diffIndices.push(i);
      }
    }
    expect(diffIndices).toEqual([3]);
    expect(main[3]).toBe(0x10);
    expect(extra[3]).toBe(0x21);
  });

  it('returns independent buffers on successive calls', () => {
    const a = createTemplate('mainPoll');
    const b = createTemplate('mainPoll');
    expect(a).not.toBe(b);
    a[10] = 0xaa;
    expect(b[10]).toBe(0x00);
  });

  it('optionalPcbPoll carries the documented non-zero default bytes', () => {
    const template = createTemplate('optionalPcbPoll');
    expect(Array.from(template)).toEqual([
      0xf1, 0x11, 0x01, 0x50, 0x00, 0x00, 0x40, 0xff, 0xff, 0xe5, 0xff, 0xff, 0x00, 0xff, 0xeb,
      0xff, 0xff, 0x00, 0x00,
    ]);
  });

  it('initialHandshake matches the documented 7-byte sequence', () => {
    const template = createTemplate('initialHandshake');
    expect(Array.from(template)).toEqual([0x31, 0x05, 0x10, 0x01, 0x00, 0x00, 0x00]);
  });

  it.each(['mainResponse', 'extraResponse'] as const)(
    'throws RangeError for response type: %s',
    (type) => {
      expect(() => createTemplate(type)).toThrow(RangeError);
      expect(() => createTemplate(type)).toThrow(/response frames are emitted by the heat pump/);
    },
  );
});

describe('buildFrame', () => {
  it('produces a 111-byte mainPoll frame ending in 0x12', () => {
    const frame = buildFrame('mainPoll');
    expect(frame.length).toBe(111);
    expect(frame[frame.length - 1]).toBe(0x12);
  });

  it('reproduces the Quietmode1 set fixture when byte 7 is set to 0x10', () => {
    const expected = hexToBytes(QUIETMODE1_FRAME_HEX);
    const frame = buildFrame('mainSet', (payload) => {
      payload[7] = 0x10;
    });
    expect(frame).toEqual(expected);
  });

  it('passes verifyFrame for every buildable type', () => {
    const buildableTypes: FrameType[] = [
      'initialHandshake',
      'mainPoll',
      'extraPoll',
      'mainSet',
      'optionalPcbPoll',
    ];
    for (const type of buildableTypes) {
      const frame = buildFrame(type);
      expect(frame.length).toBe(FRAME_LENGTHS[type]);
      expect(verifyFrame(frame)).toBe(true);
    }
  });

  it('does not require a mutator', () => {
    const frame = buildFrame('initialHandshake');
    expect(frame.length).toBe(FRAME_LENGTHS.initialHandshake);
    expect(verifyFrame(frame)).toBe(true);
  });

  it('propagates the RangeError from createTemplate for response types', () => {
    expect(() => buildFrame('mainResponse')).toThrow(RangeError);
    expect(() => buildFrame('extraResponse')).toThrow(RangeError);
  });
});
