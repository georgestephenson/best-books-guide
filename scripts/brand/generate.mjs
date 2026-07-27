#!/usr/bin/env node
/**
 * Regenerates the raster brand assets in apps/web/public/ from two sources:
 * `apps/web/public/favicon.svg` (the mark) and `./og.html` (the social card).
 *
 * Run it only when a source changes — the outputs are committed, so neither the
 * build nor CI depends on a browser being installed:
 *
 *     node scripts/brand/generate.mjs            # finds a local Chrome/Chromium
 *     CHROME_PATH=/path/to/chrome node scripts/brand/generate.mjs
 *
 * Rendering is headless Chrome's `--screenshot`, so there's no image library to
 * keep patched (docs/05 §Supply chain). Two bits of plumbing earn their keep:
 *
 * - Chrome sizes the screenshot canvas to `--window-size` but lays the page out in
 *   a viewport that is ~85px shorter (browser chrome it reserves even headless), so
 *   the bottom of every capture came out blank. We measure that shortfall once,
 *   render into a padded window, and crop back to the exact size.
 * - The .ico is packed here: an ICO is a 6-byte header plus one 16-byte directory
 *   entry per image, and every browser we target reads PNG-compressed entries.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync, inflateSync } from 'node:zlib';

const here = fileURLToPath(new URL('.', import.meta.url));
const publicDir = fileURLToPath(new URL('../../apps/web/public/', import.meta.url));

const CANDIDATES = [
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

const chrome = CANDIDATES.find((p) => p && existsSync(p));
if (!chrome) {
  throw new Error(
    `No Chrome/Chromium found. Set CHROME_PATH. Tried:\n${CANDIDATES.filter(Boolean).join('\n')}`,
  );
}

const work = mkdtempSync(join(tmpdir(), 'bb-brand-'));
const page = (name, html) => {
  const path = join(work, name);
  writeFileSync(path, html);
  return path;
};

function run(args) {
  return execFileSync(chrome, ['--headless', '--no-sandbox', '--disable-gpu', ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

/** How much shorter/narrower the layout viewport is than the requested window. */
function measureChrome() {
  const probe = page(
    'probe.html',
    `<!doctype html><meta charset="utf-8"><body><script>
       document.body.textContent = '#' + innerWidth + 'x' + innerHeight + '#'
     </script>`,
  );
  const dom = run(['--window-size=1000,1000', '--dump-dom', `file://${probe}`]);
  const m = /#(\d+)x(\d+)#/.exec(dom);
  if (!m) throw new Error('Could not measure the browser viewport');
  return { x: 1000 - Number(m[1]), y: 1000 - Number(m[2]) };
}

const pad = measureChrome();

/** Screenshot a local page at an exact output size. `transparent` leaves it unpainted. */
function shoot(htmlPath, out, width, height, { transparent = false } = {}) {
  const raw = join(work, 'shot.png');
  run([
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    ...(transparent ? ['--default-background-color=00000000'] : []),
    `--window-size=${width + pad.x},${height + pad.y}`,
    `--screenshot=${raw}`,
    `file://${htmlPath}`,
  ]);
  writeFileSync(out, cropPng(readFileSync(raw), width, height));
}

// ---------------------------------------------------------------- PNG crop
// Just enough PNG to take the top-left w×h of Chrome's capture: inflate the
// image data, undo the per-row filters, copy the rows we want, re-emit them
// unfiltered. 8-bit RGB/RGBA only — the only two formats Chrome writes here.

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, tail]);
}

/** Reverse the PNG row filters (spec §9.2) into a flat pixel buffer. */
function unfilter(raw, width, height, bpp) {
  const stride = width * bpp;
  const out = Buffer.alloc(height * stride);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const row = raw.subarray(pos, pos + stride);
    pos += stride;
    const base = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[base + x - bpp] : 0; // left
      const b = y > 0 ? out[base - stride + x] : 0; // up
      const c = y > 0 && x >= bpp ? out[base - stride + x - bpp] : 0; // up-left
      let value = row[x];
      if (filter === 1) value += a;
      else if (filter === 2) value += b;
      else if (filter === 3) value += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (filter !== 0) throw new Error(`Unsupported PNG filter ${filter}`);
      out[base + x] = value & 0xff;
    }
  }
  return out;
}

function cropPng(png, width, height) {
  let offset = 8;
  let header;
  const idat = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') header = data;
    else if (type === 'IDAT') idat.push(data);
    offset += 12 + length;
  }
  if (!header) throw new Error('PNG has no IHDR');
  const srcWidth = header.readUInt32BE(0);
  const srcHeight = header.readUInt32BE(4);
  const [depth, colorType] = [header[8], header[9]];
  if (depth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`Unsupported PNG (depth ${depth}, colour type ${colorType})`);
  }
  if (srcWidth < width || srcHeight < height) {
    throw new Error(`Capture is ${srcWidth}×${srcHeight}, smaller than ${width}×${height}`);
  }
  const bpp = colorType === 6 ? 4 : 3;
  const pixels = unfilter(inflateSync(Buffer.concat(idat)), srcWidth, srcHeight, bpp);

  const stride = width * bpp;
  const out = Buffer.alloc(height * (stride + 1)); // one filter byte (0 = none) per row
  for (let y = 0; y < height; y++) {
    pixels.copy(out, y * (stride + 1) + 1, y * srcWidth * bpp, y * srcWidth * bpp + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = depth;
  ihdr[9] = colorType;
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(out, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- icons

/** Wrap an SVG in a bare page sized to the icon, so the capture is exactly N×N. */
function renderIcon(svg, size, out, opts) {
  const html = page(
    `icon-${size}-${out.length}.html`,
    `<!doctype html><meta charset="utf-8"><style>
       html,body{margin:0;padding:0;width:${size}px;height:${size}px;overflow:hidden}
       svg{display:block;width:${size}px;height:${size}px}
     </style>${svg}`,
  );
  shoot(html, out, size, size, opts);
}

/** Pack PNGs into an ICO (PNG-compressed entries, Vista+ / all modern browsers). */
function packIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + images.length * 16;
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // 0 means 256
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

// ---------------------------------------------------------------- outputs

const markSvg = readFileSync(join(publicDir, 'favicon.svg'), 'utf8');
/** Full-bleed variant: iOS and Android mask their own corners, so ours must not be round. */
const fullBleed = markSvg.replace('rx="14"', 'rx="0"');

try {
  shoot(join(here, 'og.html'), join(publicDir, 'og.png'), 1200, 630);
  console.log('og.png 1200×630');

  renderIcon(fullBleed, 180, join(publicDir, 'apple-touch-icon.png'));
  renderIcon(markSvg, 192, join(publicDir, 'icon-192.png'), { transparent: true });
  renderIcon(markSvg, 512, join(publicDir, 'icon-512.png'), { transparent: true });
  console.log('apple-touch-icon.png, icon-192.png, icon-512.png');

  // Legacy favicon.ico — browsers that ignore the SVG, plus bare /favicon.ico hits.
  const sizes = [16, 32, 48];
  const images = sizes.map((size) => {
    const out = join(work, `ico-${size}.png`);
    renderIcon(fullBleed, size, out, { transparent: true });
    return { size, data: readFileSync(out) };
  });
  writeFileSync(join(publicDir, 'favicon.ico'), packIco(images));
  console.log(`favicon.ico (${sizes.join(', ')})`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
