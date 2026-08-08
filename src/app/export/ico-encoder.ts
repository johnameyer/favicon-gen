/**
 * Hand-rolled encoder for the "ICO with PNG entries" format, supported by
 * Windows Vista+ and all modern favicon consumers. This avoids needing a
 * BMP/DIB fallback: each directory entry simply points at a raw PNG image.
 *
 * File layout:
 *   ICONDIR (6 bytes)
 *     reserved:  u16 = 0
 *     type:      u16 = 1 (icon)
 *     count:     u16 = number of images
 *   ICONDIRENTRY[count] (16 bytes each)
 *     width:          u8  (0 means 256)
 *     height:         u8  (0 means 256)
 *     colorCount:     u8  = 0
 *     reserved:       u8  = 0
 *     colorPlanes:    u16 = 1
 *     bitsPerPixel:   u16 = 32
 *     bytesInResource:u32 = length of this image's PNG data
 *     imageOffset:    u32 = byte offset from start of file to this image's PNG data
 *   PNG data for each image, concatenated in directory order.
 */

const ICONDIR_SIZE = 6;
const ICONDIRENTRY_SIZE = 16;

export interface IcoImageInput {
  size: number;
  data: Uint8Array;
}

/** Encodes a set of same-format PNG images into a single .ico file Blob. */
export function encodeIco(pngs: IcoImageInput[]): Blob {
  const buffer = encodeIcoBuffer(pngs);
  return new Blob([buffer.buffer as ArrayBuffer], { type: 'image/x-icon' });
}

/** Same as {@link encodeIco} but returns the raw bytes instead of a Blob. */
export function encodeIcoBuffer(pngs: IcoImageInput[]): Uint8Array {
  const headerSize = ICONDIR_SIZE + ICONDIRENTRY_SIZE * pngs.length;
  const totalSize = headerSize + pngs.reduce((sum, png) => sum + png.data.byteLength, 0);

  const out = new Uint8Array(totalSize);
  const view = new DataView(out.buffer);

  // ICONDIR
  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // type = icon
  view.setUint16(4, pngs.length, true); // count

  let dataOffset = headerSize;
  pngs.forEach((png, index) => {
    const entryOffset = ICONDIR_SIZE + ICONDIRENTRY_SIZE * index;
    const dim = png.size >= 256 ? 0 : png.size;

    view.setUint8(entryOffset + 0, dim); // width
    view.setUint8(entryOffset + 1, dim); // height
    view.setUint8(entryOffset + 2, 0); // colorCount
    view.setUint8(entryOffset + 3, 0); // reserved
    view.setUint16(entryOffset + 4, 1, true); // colorPlanes
    view.setUint16(entryOffset + 6, 32, true); // bitsPerPixel
    view.setUint32(entryOffset + 8, png.data.byteLength, true); // bytesInResource
    view.setUint32(entryOffset + 12, dataOffset, true); // imageOffset

    out.set(png.data, dataOffset);
    dataOffset += png.data.byteLength;
  });

  return out;
}
