/**
 * Encoder for HeishaMon `mainSet` write-command frames.
 *
 * One public entry point: `encodeSetCommand(name, value)` returns a complete
 * 111-byte frame (110-byte payload + checksum) ready to be transmitted.
 *
 * Each writable datapoint is represented by a rule that knows how to translate
 * the user-facing value into a byte offset and byte value within the payload.
 * Rules are small and explicit — one per topic — so the encoding for any
 * given topic is easy to audit against HeishaMon's `commands.cpp` and the
 * goldvectors in `test/fixtures/checksum-vectors.json`.
 *
 * Out of scope:
 * - Optional-PCB commands (set_pool_temp, set_buffer_temp, ...): those mutate
 *   the 20-byte optional-PCB frame, not the mainSet frame, and belong in a
 *   separate encoder module.
 * - Topics whose upstream encoding is unknown or ambiguous: those are listed
 *   here with `kind: 'notImplemented'` and produce a clear error on use.
 */
/**
 * Encode a write-command (mainSet frame) for a single writable datapoint.
 * Returns a complete 111-byte frame ready to be transmitted (header +
 * payload + checksum).
 *
 * @throws RangeError if no datapoint with the given name exists, or if
 *         the datapoint is not writable.
 * @throws Error if the value is out of the documented range, or if the
 *         encoder for this topic is not yet implemented.
 */
export declare function encodeSetCommand(name: string, value: number): Uint8Array;
//# sourceMappingURL=encoder.d.ts.map