import fs from 'fs';
import zlib from 'zlib';
import path from 'path';

function createPng(width, height) {
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    
    const toCrc = Buffer.concat([typeBuf, data]);
    let crc = -1;
    for (let i = 0; i < toCrc.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ toCrc[i]) & 0xff];
    }
    crc = (crc ^ -1) >>> 0;
    crcBuf.writeUInt32BE(crc, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowLen = 1 + width * 4;
  const rawData = Buffer.alloc(rowLen * height);
  const cx = width / 2;
  const cy = height / 2;
  const r = width * 0.42;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowLen;
    rawData[rowOffset] = 0;
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= r) {
        const t = (x + y) / (width + height);
        rawData[pxOffset] = Math.round(79 * (1 - t) + 16 * t);
        rawData[pxOffset + 1] = Math.round(70 * (1 - t) + 185 * t);
        rawData[pxOffset + 2] = Math.round(229 * (1 - t) + 129 * t);
        rawData[pxOffset + 3] = 255;
      } else {
        rawData[pxOffset] = 11;
        rawData[pxOffset + 1] = 17;
        rawData[pxOffset + 2] = 32;
        rawData[pxOffset + 3] = 255;
      }
    }
  }

  const idat = zlib.deflateSync(rawData);
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    header,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', iend)
  ]);
}

const dir = path.join(process.cwd(), 'public', 'icons');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

fs.writeFileSync(path.join(dir, 'icon-192.png'), createPng(192, 192));
fs.writeFileSync(path.join(dir, 'icon-512.png'), createPng(512, 512));
fs.writeFileSync(path.join(dir, 'apple-touch-icon.png'), createPng(180, 180));
console.log('Generated PWA icons in public/icons/');
