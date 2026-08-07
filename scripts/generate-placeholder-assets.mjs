#!/usr/bin/env node
/**
 * Generates placeholder app icons and the splash mark.
 *
 * `expo prebuild` fails if the files referenced by app.config.ts are missing or are not
 * valid PNGs, so Milestone 0 needs real image bytes. Rather than commit binaries nobody
 * can regenerate, this writes them deterministically from pure Node — zlib only, no
 * `sharp`, no native build step. Real brand artwork replaces these in Milestone 4.
 *
 * Usage: node scripts/generate-placeholder-assets.mjs
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSET_DIR = resolve(HERE, '..', 'apps', 'mobile', 'assets');

/** Brand tokens (spec §7.1). Kept in sync with packages/ui/src/tokens/colors.ts. */
const SCENE_EMERALD = [0x03, 0x2c, 0x24];
const SCENE_SAFFRON = [0xff, 0x7a, 0x1a];
const WARM_CREAM = [0xf5, 0xf1, 0xe8];

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

/**
 * @param {number} size square edge in pixels
 * @param {(x: number, y: number, size: number) => number[]} paint returns [r,g,b] or [r,g,b,a]
 */
function png(size, paint) {
  // Raw scanlines: one filter byte (0 = None) followed by RGBA pixels.
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);

  for (let y = 0; y < size; y += 1) {
    raw[y * stride] = 0;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a = 0xff] = paint(x, y, size);
      const offset = y * stride + 1 + x * 4;
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      raw[offset + 3] = a;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** A centred saffron square on Scene Emerald — obviously a placeholder, on-brand. */
const icon = (x, y, size) => {
  const inset = size * 0.3;
  const inMark = x >= inset && x < size - inset && y >= inset && y < size - inset;
  return inMark ? SCENE_SAFFRON : SCENE_EMERALD;
};

/** Adaptive foreground and splash: mark on transparency, per Android/Expo expectations. */
const markOnTransparent = (colour) => (x, y, size) => {
  const inset = size * 0.28;
  const inMark = x >= inset && x < size - inset && y >= inset && y < size - inset;
  return inMark ? colour : [0, 0, 0, 0];
};

const files = [
  ['icon.png', png(1024, icon)],
  ['adaptive-icon.png', png(1024, markOnTransparent(SCENE_SAFFRON))],
  // Android monochrome icons are tinted by the system; only the alpha channel matters (§19).
  ['adaptive-icon-monochrome.png', png(1024, markOnTransparent(WARM_CREAM))],
  ['splash-icon.png', png(512, markOnTransparent(SCENE_SAFFRON))],
];

mkdirSync(ASSET_DIR, { recursive: true });
for (const [name, buffer] of files) {
  const target = join(ASSET_DIR, name);
  writeFileSync(target, buffer);
  console.log(`wrote ${target} (${buffer.length} bytes)`);
}
