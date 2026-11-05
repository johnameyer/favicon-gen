import { compress } from 'brotli/compress';
import { axisLabel, parseFvar, readFontAxes } from './font-axes';

// Synthetic fonts: just enough container structure around a real-format
// fvar table to exercise each code path. Real-font coverage (Roboto Flex
// from Google Fonts) is in e2e/letter.spec.ts.

interface AxisSpec {
  tag: string;
  min: number;
  def: number;
  max: number;
  hidden?: boolean;
}

function fvarTable(axes: AxisSpec[]): Uint8Array {
  const axisSize = 20;
  const bytes = new Uint8Array(16 + axes.length * axisSize);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, 1); // majorVersion
  view.setUint16(4, 16); // axesArrayOffset
  view.setUint16(6, 2); // reserved
  view.setUint16(8, axes.length);
  view.setUint16(10, axisSize);
  axes.forEach((axis, i) => {
    const offset = 16 + i * axisSize;
    for (let c = 0; c < 4; c++) view.setUint8(offset + c, axis.tag.charCodeAt(c));
    view.setInt32(offset + 4, Math.round(axis.min * 0x10000));
    view.setInt32(offset + 8, Math.round(axis.def * 0x10000));
    view.setInt32(offset + 12, Math.round(axis.max * 0x10000));
    view.setUint16(offset + 16, axis.hidden ? 1 : 0);
  });
  return bytes;
}

function tagBytes(tag: string): number[] {
  return [...tag].map((c) => c.charCodeAt(0));
}

function u32(value: number): number[] {
  return [value >>> 24, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function u16(value: number): number[] {
  return [value >>> 8, value & 0xff];
}

/** A minimal sfnt (TTF) with the given tables. */
function sfnt(tables: Record<string, Uint8Array>): Uint8Array {
  const entries = Object.entries(tables);
  const header = [...u32(0x00010000), ...u16(entries.length), 0, 0, 0, 0, 0, 0];
  let offset = 12 + entries.length * 16;
  const records: number[] = [];
  const data: number[] = [];
  for (const [tag, table] of entries) {
    records.push(...tagBytes(tag), ...u32(0), ...u32(offset), ...u32(table.length));
    data.push(...table);
    offset += table.length;
  }
  return new Uint8Array([...header, ...records, ...data]);
}

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Response(data as BodyInit).body!.pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** A minimal WOFF 1.0 whose tables are zlib-compressed. */
async function woff(tables: Record<string, Uint8Array>): Promise<Uint8Array> {
  const entries = Object.entries(tables);
  const compressed = await Promise.all(entries.map(([, table]) => deflate(table)));
  let offset = 44 + entries.length * 20;
  const directory: number[] = [];
  const data: number[] = [];
  entries.forEach(([tag, table], i) => {
    directory.push(...tagBytes(tag), ...u32(offset), ...u32(compressed[i].length));
    directory.push(...u32(table.length), ...u32(0));
    data.push(...compressed[i]);
    offset += compressed[i].length;
  });
  const header = [...tagBytes('wOFF'), ...u32(0x00010000), ...u32(0), ...u16(entries.length)];
  return new Uint8Array([
    ...header,
    ...new Array(44 - header.length).fill(0),
    ...directory,
    ...data,
  ]);
}

/** UIntBase128, as used in WOFF2 table directories. */
function base128(value: number): number[] {
  const bytes = [value & 0x7f];
  for (value >>>= 7; value > 0; value >>>= 7) bytes.unshift((value & 0x7f) | 0x80);
  return bytes;
}

/**
 * A minimal WOFF2 with a transformed glyf (which carries a transformLength
 * and occupies that many stream bytes, not its original length), an
 * arbitrary-tag table, and fvar last, so finding fvar's place in the
 * decompressed stream depends on stepping over each of those correctly.
 */
async function woff2(fvar: Uint8Array): Promise<Uint8Array> {
  const head = new Uint8Array(54).fill(1);
  const glyfTransformed = new Uint8Array(30).fill(2);
  const custom = new Uint8Array(7).fill(3);
  const directory = [
    1,
    ...base128(head.length), // head: known index 1, null transform
    10,
    ...base128(500),
    ...base128(glyfTransformed.length), // glyf: version 0 = transformed
    11,
    ...base128(100),
    ...base128(0), // loca: transformed, empty in the stream
    63,
    ...tagBytes('ZZZZ'),
    ...base128(custom.length), // arbitrary tag
    47,
    ...base128(fvar.length), // fvar: known index 47
  ];
  const stream = new Uint8Array([...head, ...glyfTransformed, ...custom, ...fvar]);
  const compressed = (await compress(stream))!;
  const header = [
    ...tagBytes('wOF2'),
    ...u32(0x00010000),
    ...u32(0),
    ...u16(5),
    ...u16(0),
    ...u32(0),
    ...u32(compressed.length),
  ];
  return new Uint8Array([
    ...header,
    ...new Array(48 - header.length).fill(0),
    ...directory,
    ...compressed,
  ]);
}

const AXES: AxisSpec[] = [
  { tag: 'XOPQ', min: 27, def: 96, max: 175, hidden: true },
  { tag: 'wght', min: 100, def: 400, max: 1000 },
  { tag: 'slnt', min: -10, def: 0, max: 0 },
];

const EXPECTED = [
  { tag: 'wght', min: 100, default: 400, max: 1000, hidden: false },
  { tag: 'slnt', min: -10, default: 0, max: 0, hidden: false },
  { tag: 'XOPQ', min: 27, default: 96, max: 175, hidden: true },
];

describe('parseFvar', () => {
  it('reads every axis, listing hidden (parametric) axes after visible ones', () => {
    expect(parseFvar(fvarTable(AXES))).toEqual(EXPECTED);
  });

  it('keeps fractional values', () => {
    const [axis] = parseFvar(fvarTable([{ tag: 'ital', min: 0, def: 0.5, max: 1 }]));
    expect(axis.default).toBe(0.5);
  });
});

describe('readFontAxes', () => {
  it('reads axes from a TTF/OTF', async () => {
    const font = sfnt({ head: new Uint8Array(54), fvar: fvarTable(AXES) });
    expect(await readFontAxes(font)).toEqual(EXPECTED);
  });

  it('reads axes from a zlib-compressed WOFF', async () => {
    const font = await woff({ head: new Uint8Array(54), fvar: fvarTable(AXES) });
    expect(await readFontAxes(font)).toEqual(EXPECTED);
  });

  it('reads axes from a Brotli-compressed WOFF2, stepping over transformed and custom tables', async () => {
    expect(await readFontAxes(await woff2(fvarTable(AXES)))).toEqual(EXPECTED);
  });

  it('returns no axes for a static font', async () => {
    expect(await readFontAxes(sfnt({ head: new Uint8Array(54) }))).toEqual([]);
  });

  it('returns no axes, without throwing, for bytes that are not a font', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await readFontAxes(new Uint8Array([1, 2, 3]))).toEqual([]);
  });
});

describe('axisLabel', () => {
  it('names registered and Roboto Flex parametric axes, and falls back to the tag', () => {
    expect(axisLabel('wdth')).toBe('Width');
    expect(axisLabel('YTUC')).toBe('Uppercase height');
    expect(axisLabel('ZZZZ')).toBe('ZZZZ');
  });
});
