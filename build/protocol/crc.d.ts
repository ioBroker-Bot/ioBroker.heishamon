/**
 * Panasonic CN-CNT 8-bit checksum.
 *
 * The protocol does not use a real CRC; the trailing byte of every frame
 * is chosen so that the 8-bit sum over the entire frame is zero. See
 * docs/protocol/crc.md for the full derivation.
 */
/**
 * Compute the Panasonic CN-CNT checksum byte for a payload.
 *
 * Algorithm: two's complement of the 8-bit sum of all payload bytes.
 * Equivalent to `(sum ^ 0xFF) + 1` used in HeishaMon, but expressed
 * directly as `(256 - sum) & 0xFF`, which is more readable.
 *
 * @param payload  the frame bytes WITHOUT the trailing checksum byte
 * @returns the checksum byte (0..255)
 */
export declare function computeChecksum(payload: Uint8Array): number;
/**
 * Verify that a frame (including its trailing checksum byte) is valid.
 *
 * A frame is valid iff the 8-bit sum over ALL its bytes is zero.
 *
 * @param frame  the complete frame including the trailing checksum byte
 * @returns true if the frame's checksum is valid
 */
export declare function verifyFrame(frame: Uint8Array): boolean;
//# sourceMappingURL=crc.d.ts.map