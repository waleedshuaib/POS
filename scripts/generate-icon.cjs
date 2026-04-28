#!/usr/bin/env node
/**
 * Generate build/icon.png — a 1024x1024 PNG used by electron-builder for the
 * macOS .icns and Windows .ico. Uses ONLY Node built-ins (zlib + Buffer) so
 * there's nothing to install. The output is a brand-blue rounded square with
 * a centered white "M" — a placeholder until a designed icon is dropped in.
 *
 * Run:  node scripts/generate-icon.cjs
 * (or via:  npm run icon)
 *
 * Replace build/icon.png with any 1024x1024 PNG of your own at any time.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const W = 1024;
const H = 1024;
const RADIUS = 220;
// Brand gradient endpoints (vertical linear): #0EA5E9 -> #0369A1
const TOP = [0x0E, 0xA5, 0xE9];
const BOTTOM = [0x03, 0x69, 0xA1];

// 4-bit raster of the letter "M" inside a 16x16 grid; we'll scale it up.
// Each byte is one pixel: 1 = ink, 0 = transparent.
const M_GRID = [
  '1100000000000011',
  '1110000000000111',
  '1111000000001111',
  '1101100000011011',
  '1100110000110011',
  '1100011001100011',
  '1100001111000011',
  '1100000110000011',
  '1100000000000011',
  '1100000000000011',
  '1100000000000011',
  '1100000000000011',
  '1100000000000011',
  '1100000000000011',
  '1100000000000011',
  '1100000000000011',
];

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}
function gradient(y) {
  const t = y / (H - 1);
  return [lerp(TOP[0], BOTTOM[0], t), lerp(TOP[1], BOTTOM[1], t), lerp(TOP[2], BOTTOM[2], t)];
}

// Returns true if (x,y) is inside the rounded square.
function insideRounded(x, y) {
  if (x < RADIUS && y < RADIUS) {
    const dx = RADIUS - x, dy = RADIUS - y;
    return dx * dx + dy * dy <= RADIUS * RADIUS;
  }
  if (x >= W - RADIUS && y < RADIUS) {
    const dx = x - (W - RADIUS - 1), dy = RADIUS - y;
    return dx * dx + dy * dy <= RADIUS * RADIUS;
  }
  if (x < RADIUS && y >= H - RADIUS) {
    const dx = RADIUS - x, dy = y - (H - RADIUS - 1);
    return dx * dx + dy * dy <= RADIUS * RADIUS;
  }
  if (x >= W - RADIUS && y >= H - RADIUS) {
    const dx = x - (W - RADIUS - 1), dy = y - (H - RADIUS - 1);
    return dx * dx + dy * dy <= RADIUS * RADIUS;
  }
  return true;
}

// Map a render pixel to the 16x16 M grid (centered, ~60% size).
const GLYPH_PX = 600;
const GLYPH_X0 = (W - GLYPH_PX) / 2;
const GLYPH_Y0 = (H - GLYPH_PX) / 2 + 30;

function isInk(x, y) {
  if (x < GLYPH_X0 || x >= GLYPH_X0 + GLYPH_PX) return false;
  if (y < GLYPH_Y0 || y >= GLYPH_Y0 + GLYPH_PX) return false;
  const gx = Math.floor(((x - GLYPH_X0) / GLYPH_PX) * 16);
  const gy = Math.floor(((y - GLYPH_Y0) / GLYPH_PX) * 16);
  return M_GRID[gy][gx] === '1';
}

// 4 bytes per pixel (RGBA). 1 filter byte per row.
const rowLen = 1 + W * 4;
const raw = Buffer.alloc(rowLen * H);

for (let y = 0; y < H; y++) {
  raw[y * rowLen] = 0;
  const [gr, gg, gb] = gradient(y);
  for (let x = 0; x < W; x++) {
    const off = y * rowLen + 1 + x * 4;
    if (!insideRounded(x, y)) {
      raw[off] = 0; raw[off + 1] = 0; raw[off + 2] = 0; raw[off + 3] = 0;
      continue;
    }
    if (isInk(x, y)) {
      raw[off] = 255; raw[off + 1] = 255; raw[off + 2] = 255; raw[off + 3] = 255;
    } else {
      raw[off] = gr; raw[off + 1] = gg; raw[off + 2] = gb; raw[off + 3] = 255;
    }
  }
}

// CRC32 table for PNG chunks
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;     // bit depth
ihdr[9] = 6;     // color type RGBA
ihdr[10] = 0;    // compression
ihdr[11] = 0;    // filter
ihdr[12] = 0;    // interlace

const idat = zlib.deflateSync(raw);
const iend = Buffer.alloc(0);

const png = Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', iend)]);

const outPath = path.join(__dirname, '..', 'build', 'icon.png');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, png);
console.log(`✓ Wrote ${outPath} (${png.length} bytes, ${W}x${H})`);
