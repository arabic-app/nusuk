import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function createPng(width, height, isMaskable = false, brand = 'nusuk') {
  // Simple uncompressed RGBA PNG generator
  const bytesPerPixel = 4;
  const rowSize = width * bytesPerPixel;
  const rawData = Buffer.alloc(height * (1 + rowSize));

  const bgR = brand === 'nusuk' ? 0x00 : 0x02;
  const bgG = brand === 'nusuk' ? 0x6c : 0x84;
  const bgB = brand === 'nusuk' ? 0x35 : 0xc7;

  // Nusuk branding constants
  const goldR = 0xd4, goldG = 0xaf, goldB = 0x37; // Gold #D4AF37
  const blackR = 0x10, blackG = 0x10, blackB = 0x10;

  // Portrait branding constants
  const padding = isMaskable ? Math.round(width * 0.22) : Math.round(width * 0.16);
  const cardLeft = padding;
  const cardRight = width - padding;
  const cardTop = isMaskable ? padding : Math.round(height * 0.14);
  const cardBottom = height - (isMaskable ? padding : Math.round(height * 0.14));
  const cr = Math.round((cardRight - cardLeft) * 0.15);

  const headCx = Math.round(width / 2);
  const headCy = cardTop + Math.round((cardBottom - cardTop) * 0.36);
  const headR = Math.round((cardRight - cardLeft) * 0.18);

  const shoulderCx = headCx;
  const shoulderCy = cardTop + Math.round((cardBottom - cardTop) * 0.78);
  const shoulderRx = Math.round((cardRight - cardLeft) * 0.34);
  const shoulderRy = Math.round((cardBottom - cardTop) * 0.28);

  // Nusuk box bounding relative to canvas
  const nusukPadding = isMaskable ? Math.round(width * 0.22) : Math.round(width * 0.18);
  const boxLeft = nusukPadding;
  const boxRight = width - nusukPadding;
  const boxTop = nusukPadding + Math.round(height * 0.05);
  const boxBottom = height - nusukPadding;
  const goldBandTop = boxTop + Math.round((boxBottom - boxTop) * 0.18);
  const goldBandBottom = goldBandTop + Math.max(2, Math.round(height * 0.04));

  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter type: None
    for (let x = 0; x < width; x++) {
      let r = bgR, g = bgG, b = bgB, a = 255;

      if (brand === 'nusuk') {
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
      } else {
        // Portrait brand: modern rounded ID photo badge with silhouette
        let inCard = x >= cardLeft && x <= cardRight && y >= cardTop && y <= cardBottom;
        if (inCard) {
          if (x < cardLeft + cr && y < cardTop + cr) {
            const dx = x - (cardLeft + cr), dy = y - (cardTop + cr);
            if (dx * dx + dy * dy > cr * cr) inCard = false;
          } else if (x > cardRight - cr && y < cardTop + cr) {
            const dx = x - (cardRight - cr), dy = y - (cardTop + cr);
            if (dx * dx + dy * dy > cr * cr) inCard = false;
          } else if (x < cardLeft + cr && y > cardBottom - cr) {
            const dx = x - (cardLeft + cr), dy = y - (cardBottom - cr);
            if (dx * dx + dy * dy > cr * cr) inCard = false;
          } else if (x > cardRight - cr && y > cardBottom - cr) {
            const dx = x - (cardRight - cr), dy = y - (cardBottom - cr);
            if (dx * dx + dy * dy > cr * cr) inCard = false;
          }
        }

        if (inCard) {
          r = 0xff; g = 0xff; b = 0xff; // White card surface
          const hdx = x - headCx, hdy = y - headCy;
          if (hdx * hdx + hdy * hdy <= headR * headR) {
            r = 0x02; g = 0x84; b = 0xc7; // Silhouette head
          } else {
            const sdx = x - shoulderCx, sdy = y - shoulderCy;
            const inShoulder = (sdx * sdx) / (shoulderRx * shoulderRx) + (sdy * sdy) / (shoulderRy * shoulderRy) <= 1;
            if (
              inShoulder &&
              y >= headCy + headR + Math.max(1, Math.round(height * 0.02)) &&
              y <= cardBottom - Math.max(2, Math.round(height * 0.04))
            ) {
              r = 0x02; g = 0x84; b = 0xc7; // Silhouette shoulders
            }
          }
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
  // Nusuk brand icons
  { name: 'pwa-64x64.png', size: 64, maskable: false, brand: 'nusuk' },
  { name: 'pwa-192x192.png', size: 192, maskable: false, brand: 'nusuk' },
  { name: 'pwa-512x512.png', size: 512, maskable: false, brand: 'nusuk' },
  { name: 'maskable-icon-512x512.png', size: 512, maskable: true, brand: 'nusuk' },
  { name: 'apple-touch-icon-180x180.png', size: 180, maskable: false, brand: 'nusuk' },

  // Portrait (Azure) brand icons
  { name: 'portrait-pwa-64x64.png', size: 64, maskable: false, brand: 'portrait' },
  { name: 'portrait-pwa-192x192.png', size: 192, maskable: false, brand: 'portrait' },
  { name: 'portrait-pwa-512x512.png', size: 512, maskable: false, brand: 'portrait' },
  { name: 'portrait-maskable-icon-512x512.png', size: 512, maskable: true, brand: 'portrait' },
  { name: 'portrait-apple-touch-icon-180x180.png', size: 180, maskable: false, brand: 'portrait' },
];

for (const t of targets) {
  const buf = createPng(t.size, t.size, t.maskable, t.brand);
  fs.writeFileSync(path.join(iconsDir, t.name), buf);
  console.log(`Generated ${t.name} (${t.size}x${t.size}, ${t.brand})`);
}
