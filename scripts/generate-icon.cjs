const fs = require("fs");
const path = require("path");

const pngPath = path.resolve(__dirname, "../desktop/assets/icon.png");
const icoPath = path.resolve(__dirname, "../desktop/assets/icon.ico");

if (!fs.existsSync(pngPath)) {
  console.error("icon.png not found at", pngPath);
  process.exit(1);
}

const pngBuf = fs.readFileSync(pngPath);

// ICO header (6 bytes)
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type = icon (1)
header.writeUInt16LE(1, 4); // 1 image

// Directory entry (16 bytes)
const entry = Buffer.alloc(16);
entry.writeUInt8(0, 0); // width (0 represents 256)
entry.writeUInt8(0, 1); // height (0 represents 256)
entry.writeUInt8(0, 2); // color count
entry.writeUInt8(0, 3); // reserved
entry.writeUInt16LE(1, 4); // color planes
entry.writeUInt16LE(32, 6); // bits per pixel
entry.writeUInt32LE(pngBuf.length, 8); // size of image data
entry.writeUInt32LE(22, 12); // offset (header 6 + entry 16 = 22)

const icoBuf = Buffer.concat([header, entry, pngBuf]);
fs.writeFileSync(icoPath, icoBuf);
console.log("Successfully generated icon.ico (" + icoBuf.length + " bytes)");
