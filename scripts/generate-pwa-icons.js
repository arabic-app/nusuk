import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function createPng(width, height, isMaskable = false) {
  // Simple uncompressed RGBA PNG generator
  const bytesPerPixel = 4;
  const rowSize = width * bytesPerPixel;
  const rawData = Buffer.alloc(height * (1 + rowSize));

  const bgR = 0x00, bgG = 0x6c, bgB = 0x35; // #006C35
  const goldR = 0xd4, goldG = 0xaf, goldB = 0x37; // Gold #D4AF37
  const blackR = 0x10, blackG = 0x10, blackB = 0x10;
  const whiteR = 0xff, whiteG = 0xff, whiteB = 0xff;

  // Kaaba box bounding relative to canvas
  const padding = isMaskable ? Math.round(width * 0.22) : Math.round(width * 0.18);
  const boxLeft = padding;
  const boxRight = width - padding;
  const boxTop = padding + Math.round(height * 0.05);
  const boxBottom = height - padding;
  const goldBandTop = boxTop + Math.round((boxBottom - boxTop) * 0.18);
  const goldBandBottom = goldBandTop + Math.max(2, Math.round(height * 0.04));

  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter type: None
    for (let x = 0; x < width; x++) {
      let r = bgR, g = bgG, b = bgB, a = 255;

      if (x >= boxLeft && x <= boxRight && y >= boxTop && y <= boxBottom) {
        if (y >= goldBandTop && y <= goldBandBottom) {
          r = goldR; g = goldG; b = goldB;
        } else {
          r = blackR; g = blackG; b = blackB;
        }
        // Border outline
        if (x === boxLeft || x === boxRight || y === boxTop || y === boxBottom) {
          r = goldR; g = goldG; b = goldB;
        }
      }

      rawData[offset++] = r;
      rawData[offset++] = g;
      rawData[offset++] = b;
      rawData[offset++] = a;
    }
  }

  const deflated = zlib.deflateSync(rawData);

  function createChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const crcData = Buffer.concat([typeBuf, data]);
    const crc = crc32(crcData);
    crcBuf.writeUInt32BE(crc, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  function crc32(buf) {
    let crc = -1;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ -1) >>> 0;
  }

  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    header,
    createChunk('IHDR', ihdr),
    createChunk('IDAT', deflated),
    createChunk('IEND', Buffer.alloc(0))
  ]);
}

const table = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  table[i] = c;
}

const iconsDir = path.resolve(process.cwd(), 'public/icons');
fs.mkdirSync(iconsDir, { recursive: true });

const targets = [
  { name: 'pwa-64x64.png', size: 64, maskable: false },
  { name: 'pwa-192x192.png', size: 192, maskable: false },
  { name: 'pwa-512x512.png', size: 512, maskable: false },
  { name: 'maskable-icon-512x512.png', size: 512, maskable: true },
  { name: 'apple-touch-icon-180x180.png', size: 180, maskable: false },
];

for (const t of targets) {
  const buf = createPng(t.size, t.size, t.maskable);
  fs.writeFileSync(path.join(iconsDir, t.name), buf);
  console.log(`Generated ${t.name} (${t.size}x${t.size})`);
}
