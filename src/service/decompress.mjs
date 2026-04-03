import zlib from 'node:zlib'
import snappyjs from 'snappyjs'
import lz4 from 'lz4js'
import { decompress as fzstdDecompress } from 'fzstd'

/**
 * Detect compression format by magic bytes.
 * Returns { algorithm, decompressed } or null if not compressed.
 */
export async function tryDecompress(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 2) return null

    const b0 = buffer[0]
    const b1 = buffer[1]

    // GZIP: 1F 8B
    if (b0 === 0x1f && b1 === 0x8b) {
        try {
            const result = zlib.gunzipSync(buffer)
            if (isLikelyUtf8(result)) return { algorithm: 'gzip', decompressed: result }
        } catch {}
        return null
    }

    // ZIP (PKZip): 50 4B 03 04
    if (buffer.length >= 4 && b0 === 0x50 && b1 === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
        try {
            const result = await decompressZip(buffer)
            if (result && isLikelyUtf8(result)) return { algorithm: 'zip', decompressed: result }
        } catch {}
        return null
    }

    // zlib/deflate: first byte 0x78, CMF/FLG checksum: (0x78 * 256 + b1) % 31 === 0
    if (b0 === 0x78 && (0x78 * 256 + b1) % 31 === 0) {
        try {
            const result = zlib.inflateSync(buffer)
            if (isLikelyUtf8(result)) return { algorithm: 'zlib', decompressed: result }
        } catch {}
        return null
    }

    // Zstandard: 28 B5 2F FD
    if (buffer.length >= 4 && b0 === 0x28 && b1 === 0xb5 && buffer[2] === 0x2f && buffer[3] === 0xfd) {
        try {
            const result = Buffer.from(fzstdDecompress(buffer))
            if (isLikelyUtf8(result)) return { algorithm: 'zstd', decompressed: result }
        } catch {}
        return null
    }

    // LZ4 frame: 04 22 4D 18
    if (buffer.length >= 4 && b0 === 0x04 && b1 === 0x22 && buffer[2] === 0x4d && buffer[3] === 0x18) {
        try {
            const result = Buffer.from(lz4.decompress(buffer))
            if (isLikelyUtf8(result)) return { algorithm: 'lz4', decompressed: result }
        } catch {}
        return null
    }

    // Snappy + Brotli: no reliable magic bytes — try on binary data only
    if (!isLikelyUtf8(buffer)) {
        try {
            const result = Buffer.from(snappyjs.uncompress(buffer))
            if (result.length > 0 && isLikelyUtf8(result)) {
                return { algorithm: 'snappy', decompressed: result }
            }
        } catch { /* not snappy */ }

        try {
            const result = zlib.brotliDecompressSync(buffer)
            if (result.length > 0 && isLikelyUtf8(result)) {
                return { algorithm: 'brotli', decompressed: result }
            }
        } catch { /* not brotli */ }
    }

    return null
}

/**
 * Extract the first file from a ZIP archive using raw inflate (no external dependency).
 * ZIP local file header: signature 50 4B 03 04, then metadata, then compressed data.
 */
async function decompressZip(buffer) {
    // Local file header offsets
    const compressionMethod = buffer.readUInt16LE(8)
    const compressedSize = buffer.readUInt32LE(18)
    const filenameLen = buffer.readUInt16LE(26)
    const extraLen = buffer.readUInt16LE(28)
    const dataOffset = 30 + filenameLen + extraLen

    if (dataOffset + compressedSize > buffer.length) return null

    const compressedData = buffer.subarray(dataOffset, dataOffset + compressedSize)

    if (compressionMethod === 0) {
        // Stored (no compression)
        return Buffer.from(compressedData)
    }
    if (compressionMethod === 8) {
        // Deflated — use raw inflate (no zlib header)
        return zlib.inflateRawSync(compressedData)
    }
    return null
}

/**
 * Quick check if buffer looks like valid UTF-8 text.
 * Checks first 64 bytes for control characters (except common ones).
 */
function isLikelyUtf8(buffer) {
    const checkLen = Math.min(buffer.length, 64)
    for (let i = 0; i < checkLen; i++) {
        const b = buffer[i]
        // Allow: tab (9), newline (10), carriage return (13), printable ASCII (32-126), and UTF-8 continuation bytes (128+)
        if (b < 9 || (b > 13 && b < 32) || b === 127) {
            return false
        }
    }
    return true
}
