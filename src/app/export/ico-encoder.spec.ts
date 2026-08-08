import { encodeIcoBuffer } from './ico-encoder';

function fakePng(byteLength: number, fill: number): Uint8Array {
  const data = new Uint8Array(byteLength);
  data.fill(fill);
  return data;
}

function readHeader(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    reserved: view.getUint16(0, true),
    type: view.getUint16(2, true),
    count: view.getUint16(4, true),
  };
}

function readEntry(bytes: Uint8Array, index: number) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const offset = 6 + 16 * index;
  return {
    width: view.getUint8(offset + 0),
    height: view.getUint8(offset + 1),
    colorCount: view.getUint8(offset + 2),
    reserved: view.getUint8(offset + 3),
    colorPlanes: view.getUint16(offset + 4, true),
    bitsPerPixel: view.getUint16(offset + 6, true),
    bytesInResource: view.getUint32(offset + 8, true),
    imageOffset: view.getUint32(offset + 12, true),
  };
}

describe('encodeIcoBuffer', () => {
  it('encodes a 2-image ICO with a correct header and directory', () => {
    const pngs = [
      { size: 16, data: fakePng(10, 0xaa) },
      { size: 32, data: fakePng(20, 0xbb) },
    ];
    const bytes = encodeIcoBuffer(pngs);

    const header = readHeader(bytes);
    expect(header.reserved).toBe(0);
    expect(header.type).toBe(1);
    expect(header.count).toBe(2);

    const headerSize = 6 + 16 * 2;
    expect(bytes.byteLength).toBe(headerSize + 10 + 20);

    const entry0 = readEntry(bytes, 0);
    expect(entry0.width).toBe(16);
    expect(entry0.height).toBe(16);
    expect(entry0.colorCount).toBe(0);
    expect(entry0.reserved).toBe(0);
    expect(entry0.colorPlanes).toBe(1);
    expect(entry0.bitsPerPixel).toBe(32);
    expect(entry0.bytesInResource).toBe(10);
    expect(entry0.imageOffset).toBe(headerSize);

    const entry1 = readEntry(bytes, 1);
    expect(entry1.width).toBe(32);
    expect(entry1.height).toBe(32);
    expect(entry1.bytesInResource).toBe(20);
    expect(entry1.imageOffset).toBe(headerSize + 10);

    // Data round-trips at the recorded offsets.
    const data0 = bytes.slice(entry0.imageOffset, entry0.imageOffset + entry0.bytesInResource);
    const data1 = bytes.slice(entry1.imageOffset, entry1.imageOffset + entry1.bytesInResource);
    expect(Array.from(new Set(data0))).toEqual([0xaa]);
    expect(Array.from(new Set(data1))).toEqual([0xbb]);
  });

  it('encodes a 3-image ICO with sequential, non-overlapping offsets', () => {
    const pngs = [
      { size: 16, data: fakePng(5, 1) },
      { size: 32, data: fakePng(7, 2) },
      { size: 48, data: fakePng(9, 3) },
    ];
    const bytes = encodeIcoBuffer(pngs);

    const header = readHeader(bytes);
    expect(header.count).toBe(3);

    const headerSize = 6 + 16 * 3;
    expect(bytes.byteLength).toBe(headerSize + 5 + 7 + 9);

    const entries = [0, 1, 2].map((i) => readEntry(bytes, i));
    expect(entries.map((e) => e.width)).toEqual([16, 32, 48]);
    expect(entries.map((e) => e.bytesInResource)).toEqual([5, 7, 9]);
    expect(entries[0].imageOffset).toBe(headerSize);
    expect(entries[1].imageOffset).toBe(headerSize + 5);
    expect(entries[2].imageOffset).toBe(headerSize + 5 + 7);

    // No overlap: each entry's [offset, offset+len) region is disjoint.
    const sorted = [...entries].sort((a, b) => a.imageOffset - b.imageOffset);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].imageOffset).toBeGreaterThanOrEqual(sorted[i - 1].imageOffset + sorted[i - 1].bytesInResource);
    }
  });

  it('maps a 256px image dimension to the 0-means-256 sentinel byte', () => {
    const bytes = encodeIcoBuffer([{ size: 256, data: fakePng(4, 9) }]);
    const entry = readEntry(bytes, 0);
    expect(entry.width).toBe(0);
    expect(entry.height).toBe(0);
  });

  it('produces an empty-but-valid header for zero images', () => {
    const bytes = encodeIcoBuffer([]);
    const header = readHeader(bytes);
    expect(header.count).toBe(0);
    expect(bytes.byteLength).toBe(6);
  });
});
