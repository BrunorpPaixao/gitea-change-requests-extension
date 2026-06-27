/**
 * Popup ZIP helpers.
 * Builds a simple ZIP archive in-browser for combined JSON + diff downloads.
 */

/**
 * Creates an uncompressed ZIP blob for the provided text entries.
 *
 * @param {Array<{name: string, text: string}>} entries Files to include in the ZIP archive.
 * @returns {Blob} ZIP archive blob.
 */
function createZipBlob(entries) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const fileNameBytes = encoder.encode(String(entry?.name || "file.txt"));
    const dataBytes = encoder.encode(String(entry?.text || ""));
    const crc32 = computeCrc32(dataBytes);
    const compressedSize = dataBytes.length;
    const uncompressedSize = dataBytes.length;

    const localHeader = new ArrayBuffer(30);
    const localView = new DataView(localHeader);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, crc32 >>> 0, true);
    localView.setUint32(18, compressedSize, true);
    localView.setUint32(22, uncompressedSize, true);
    localView.setUint16(26, fileNameBytes.length, true);
    localView.setUint16(28, 0, true);

    localParts.push(localHeader, fileNameBytes, dataBytes);

    const centralHeader = new ArrayBuffer(46);
    const centralView = new DataView(centralHeader);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, crc32 >>> 0, true);
    centralView.setUint32(20, compressedSize, true);
    centralView.setUint32(24, uncompressedSize, true);
    centralView.setUint16(28, fileNameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralParts.push(centralHeader, fileNameBytes);

    offset += localHeader.byteLength + fileNameBytes.length + dataBytes.length;
  }

  const centralDirectorySize = sumBlobPartsLength(centralParts);
  const endOfCentralDirectory = new ArrayBuffer(22);
  const endView = new DataView(endOfCentralDirectory);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralDirectorySize, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);

  return new Blob([...localParts, ...centralParts, endOfCentralDirectory], {
    type: "application/zip",
  });
}

/**
 * Sums the encoded byte length of blob parts used by ZIP structures.
 *
 * @param {Array<ArrayBuffer | ArrayBufferView>} parts Binary parts to measure.
 * @returns {number} Total byte length.
 */
function sumBlobPartsLength(parts) {
  let total = 0;
  for (const part of parts) {
    if (part instanceof ArrayBuffer) {
      total += part.byteLength;
      continue;
    }
    if (ArrayBuffer.isView(part)) {
      total += part.byteLength;
    }
  }
  return total;
}

/**
 * Computes the CRC32 checksum required by the ZIP file format.
 *
 * @param {Uint8Array} bytes Encoded file contents.
 * @returns {number} Unsigned CRC32 checksum.
 */
function computeCrc32(bytes) {
  let crc = 0 ^ -1;
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ -1) >>> 0;
}
