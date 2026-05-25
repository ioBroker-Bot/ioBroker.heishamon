import { describe, expect, it } from 'vitest';

import { SerialAdapterTransport } from '../../src/transport.js';

describe('SerialAdapterTransport', () => {
  it('constructs without touching the port', () => {
    expect(
      () =>
        new SerialAdapterTransport({
          path: '/dev/null-nonexistent',
          onEvent: () => {},
        }),
    ).not.toThrow();
  });

  it('rejects open() for a non-existent device path', async () => {
    const transport = new SerialAdapterTransport({
      path: '/dev/this-port-cannot-exist-xyz',
      onEvent: () => {},
    });

    await expect(transport.open()).rejects.toBeInstanceOf(Error);
  });

  it('treats close() as a no-op when never opened', async () => {
    const transport = new SerialAdapterTransport({
      path: '/dev/null-nonexistent',
      onEvent: () => {},
    });

    await expect(transport.close()).resolves.toBeUndefined();
  });

  it('rejects send() when the port is not open', async () => {
    const transport = new SerialAdapterTransport({
      path: '/dev/null-nonexistent',
      onEvent: () => {},
    });

    await expect(transport.send(new Uint8Array([0x00]))).rejects.toBeInstanceOf(Error);
  });
});
