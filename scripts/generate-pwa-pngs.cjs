const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 table for PNG chunk checksums
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = 0xedb88320 ^ (c >>> 1);
    } else {
      c = c >>> 1;
    }
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(typeStr, dataBuf) {
  const typeBuf = Buffer.from(typeStr, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(dataBuf.length, 0);

  const toCrc = Buffer.concat([typeBuf, dataBuf]);
  const crcVal = crc32(toCrc);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);

  return Buffer.concat([lenBuf, typeBuf, dataBuf, crcBuf]);
}

function createPng(width, height, isMaskable = false) {
  // Signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth: 8
  ihdrData[9] = 6; // Color type: 6 (RGBA)
  ihdrData[10] = 0; // Compression
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace
  const ihdr = makeChunk('IHDR', ihdrData);

  // Scanlines: width * 4 bytes + 1 filter byte per row
  const rowSize = width * 4 + 1;
  const rawData = Buffer.alloc(height * rowSize);

  const cx = width / 2;
  const cy = height / 2;
  const maxR = width * 0.46;
  const innerR = width * (isMaskable ? 0.32 : 0.38);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Gradient background colors: deep dark violet/indigo
      const tY = y / height;
      const tX = x / width;

      // Base background color #0E0E17
      let r = Math.round(14 + tY * 12);
      let g = Math.round(14 + tX * 6);
      let b = Math.round(23 + (tX + tY) * 20);
      let a = 255;

      // Outer glow circle/squircle
      if (dist < innerR + 14 && dist > innerR - 6) {
        // Gradient glow: purple (#9333ea) to indigo (#6366f1) to red (#ef4444)
        const angle = (Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI);
        r = Math.round(147 * (1 - angle) + 239 * angle);
        g = Math.round(51 * (1 - angle) + 68 * angle);
        b = Math.round(234 * (1 - angle) + 68 * angle);
      } else if (dist <= innerR - 6) {
        // Center card background #161624
        r = 22;
        g = 22;
        b = 36;

        // Draw a sleek play icon in center
        // Play triangle centered at cx+4, cy
        const triW = innerR * 0.55;
        const triLeft = cx - triW * 0.35;
        const triRight = cx + triW * 0.65;
        const triTop = cy - triW * 0.5;
        const triBottom = cy + triW * 0.5;

        if (x >= triLeft && x <= triRight) {
          const progress = (x - triLeft) / (triRight - triLeft);
          const allowedYSpan = (1 - progress) * (triBottom - triTop) / 2;
          if (Math.abs(y - cy) <= allowedYSpan) {
            // Gradient fill for play button
            r = Math.round(168 + progress * 70); // purple to red/pink
            g = Math.round(85 - progress * 20);
            b = Math.round(247 - progress * 100);
          }
        }
      }

      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const deflated = zlib.deflateSync(rawData, { level: 9 });
  const idat = makeChunk('IDAT', deflated);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Generate PWA icons
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPng(192, 192, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPng(512, 512, false));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPng(512, 512, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPng(180, 180, false));
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), createPng(64, 64, false));

console.log('PWA PNG Icons successfully generated in /public !');
