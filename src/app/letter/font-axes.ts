/**
 * Reads a variable font's design axes (its `fvar` table) so the letter
 * generator can offer a slider per axis.
 *
 * Handles plain sfnt (TTF/OTF), WOFF (zlib, via the native
 * `DecompressionStream`) and WOFF2. WOFF2 is one Brotli stream, which
 * Chrome's `DecompressionStream` can't decode, so a JS decoder is
 * lazy-loaded for it. `fvar` itself is never transformed by WOFF2, so once
 * decompressed it's read exactly as in a TTF.
 */

export interface FontAxis {
  /** Four-character axis tag, e.g. `wght`, `wdth`, `opsz`, or a custom one like `GRAD`. */
  tag: string;
  min: number;
  default: number;
  max: number;
  /**
   * The font flags this axis as hidden: not meant for typical users. Fonts
   * like Roboto Flex use this for their low-level "parametric" axes (XOPQ,
   * YTUC, ...), which are still exposed here, just listed last.
   */
  hidden: boolean;
}

/** Display names for registered and common Google Fonts axes; others show their tag. */
const AXIS_NAMES: Record<string, string> = {
  wght: 'Weight',
  wdth: 'Width',
  slnt: 'Slant',
  ital: 'Italic',
  opsz: 'Optical size',
  GRAD: 'Grade',
  XOPQ: 'Thick stroke',
  YOPQ: 'Thin stroke',
  XTRA: 'Counter width',
  YTUC: 'Uppercase height',
  YTLC: 'Lowercase height',
  YTAS: 'Ascender height',
  YTDE: 'Descender depth',
  YTFI: 'Figure height',
  CASL: 'Casual',
  CRSV: 'Cursive',
  MONO: 'Monospace',
  SOFT: 'Softness',
  WONK: 'Wonky',
  FILL: 'Fill',
};

export function axisLabel(tag: string): string {
  return AXIS_NAMES[tag] ?? tag;
}

/** WOFF2's "known table tags", indexed by the low 6 bits of a directory entry's flags. */
const WOFF2_KNOWN_TAGS = (
  'cmap head hhea hmtx maxp name OS/2 post cvt  fpgm glyf loca prep CFF  VORG EBDT EBLC gasp ' +
  'hdmx kern LTSH PCLT VDMX vhea vmtx BASE GDEF GPOS GSUB EBSC JSTF MATH CBDT CBLC COLR CPAL ' +
  'SVG  sbix acnt avar bdat bloc bsln cvar fdsc feat fmtx fvar gvar hsty just lcar mort morx ' +
  'opbd prop trak Zapf Silf Glat Gloc Feat Sill'
)
  .match(/.{4}\s?/g)!
  .map((tag) => tag.slice(0, 4));

function readTag(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

/** Parses an `fvar` table into its axes, visible ones first, each group in font order. */
export function parseFvar(table: Uint8Array): FontAxis[] {
  const view = new DataView(table.buffer, table.byteOffset, table.byteLength);
  const axesArrayOffset = view.getUint16(4);
  const axisCount = view.getUint16(8);
  const axisSize = view.getUint16(10);
  const fixed = (offset: number) => view.getInt32(offset) / 0x10000;
  const round = (value: number) => Math.round(value * 1000) / 1000;
  const axes: FontAxis[] = [];
  for (let i = 0; i < axisCount; i++) {
    const offset = axesArrayOffset + i * axisSize;
    axes.push({
      tag: readTag(view, offset),
      min: round(fixed(offset + 4)),
      default: round(fixed(offset + 8)),
      max: round(fixed(offset + 12)),
      hidden: (view.getUint16(offset + 16) & 0x1) !== 0,
    });
  }
  return [...axes.filter((axis) => !axis.hidden), ...axes.filter((axis) => axis.hidden)];
}

function sfntFvar(bytes: Uint8Array): Uint8Array | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const numTables = view.getUint16(4);
  for (let i = 0; i < numTables; i++) {
    const record = 12 + i * 16;
    if (readTag(view, record) === 'fvar') {
      const offset = view.getUint32(record + 8);
      return bytes.subarray(offset, offset + view.getUint32(record + 12));
    }
  }
  return undefined;
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Response(data as BodyInit).body!.pipeThrough(
    new DecompressionStream('deflate'),
  );
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function woffFvar(bytes: Uint8Array): Promise<Uint8Array | undefined> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const numTables = view.getUint16(12);
  for (let i = 0; i < numTables; i++) {
    const entry = 44 + i * 20;
    if (readTag(view, entry) === 'fvar') {
      const offset = view.getUint32(entry + 4);
      const compLength = view.getUint32(entry + 8);
      const origLength = view.getUint32(entry + 12);
      const data = bytes.subarray(offset, offset + compLength);
      return compLength < origLength ? inflate(data) : data;
    }
  }
  return undefined;
}

async function woff2Fvar(bytes: Uint8Array): Promise<Uint8Array | undefined> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (readTag(view, 4) === 'ttcf') {
    return undefined; // Font collections: no single set of axes to offer.
  }
  const numTables = view.getUint16(12);
  const totalCompressedSize = view.getUint32(20);

  let position = 48;
  const readBase128 = () => {
    let value = 0;
    for (let i = 0; i < 5; i++) {
      const byte = view.getUint8(position++);
      value = value * 128 + (byte & 0x7f);
      if ((byte & 0x80) === 0) {
        return value;
      }
    }
    throw new Error('Invalid WOFF2 table directory.');
  };

  // Tables sit back to back in the decompressed stream, in directory order.
  let fvarStart: number | undefined;
  let fvarLength = 0;
  let streamOffset = 0;
  for (let i = 0; i < numTables; i++) {
    const flags = view.getUint8(position++);
    const tagIndex = flags & 0x3f;
    let tag: string;
    if (tagIndex === 63) {
      tag = readTag(view, position);
      position += 4;
    } else {
      tag = WOFF2_KNOWN_TAGS[tagIndex];
    }
    const origLength = readBase128();
    const transformVersion = flags >> 6;
    // Version 0 means "transformed" for glyf/loca but "untransformed" for everything else.
    const transformed =
      tag === 'glyf' || tag === 'loca' ? transformVersion === 0 : transformVersion !== 0;
    const storedLength = transformed ? readBase128() : origLength;
    if (tag === 'fvar') {
      fvarStart = streamOffset;
      fvarLength = origLength;
    }
    streamOffset += storedLength;
  }
  if (fvarStart === undefined) {
    return undefined;
  }

  const { decompress } = await import('brotli/decompress');
  const stream = decompress(bytes.subarray(position, position + totalCompressedSize));
  return stream.subarray(fvarStart, fvarStart + fvarLength);
}

/**
 * Returns the font's visible variation axes, or an empty list for a static
 * (non-variable) font or one this can't parse. Never throws: axes are an
 * optional extra, and the font itself still renders either way.
 */
export async function readFontAxes(bytes: Uint8Array): Promise<FontAxis[]> {
  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const signature = readTag(view, 0);
    const fvar =
      signature === 'wOF2'
        ? await woff2Fvar(bytes)
        : signature === 'wOFF'
          ? await woffFvar(bytes)
          : sfntFvar(bytes);
    return fvar ? parseFvar(fvar) : [];
  } catch (error) {
    console.warn('Could not read font variation axes:', error);
    return [];
  }
}
