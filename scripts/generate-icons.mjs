import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
mkdirSync(outDir, { recursive: true });

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++)
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function encodePng(size, pixelFn) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelFn(x, y);
      raw[o++] = r;
      raw[o++] = g;
      raw[o++] = b;
      raw[o++] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function roundedSquare(x, y, size, radius, safe = 0) {
  const min = safe;
  const max = size - safe;
  const cx =
    x < min + radius ? min + radius : x > max - radius ? max - radius : x;
  const cy =
    y < min + radius ? min + radius : y > max - radius ? max - radius : y;
  const dx = x - cx;
  const dy = y - cy;
  return (
    dx * dx + dy * dy <= radius * radius &&
    x >= min &&
    x <= max &&
    y >= min &&
    y <= max
  );
}

function checkmarkInside(x, y, size) {
  const f = size / 64;
  const px = (v) => v * f + (size - 64 * f) / 2;
  const py = (v) => v * f + (size - 64 * f) / 2;
  const inStroke = (xSt, ySt, xEn, yEn, w) => {
    const dx = px(xEn) - px(xSt);
    const dy = py(yEn) - py(ySt);
    const len2 = dx * dx + dy * dy;
    let t = ((x - px(xSt)) * dx + (y - py(ySt)) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = px(xSt) + t * dx;
    const cy = py(ySt) + t * dy;
    return (x - cx) ** 2 + (y - cy) ** 2 <= w * w;
  };
  return inStroke(17, 33, 29, 45, f * 5.5) || inStroke(29, 45, 47, 20, f * 5.5);
}

function makeIcon(size) {
  return encodePng(size, (x, y) => {
    if (
      !roundedSquare(
        x,
        y,
        size,
        Math.round(size * 0.22),
        Math.round(size * 0.04),
      )
    ) {
      return [0, 0, 0, 0];
    }
    const t = (x + y) / (2 * (size - 1));
    const r = Math.round(31 + (31 - 31) * t);
    const g = Math.round(55 + (39 - 55) * t);
    const b = Math.round(128 + (72 - 128) * t);
    if (checkmarkInside(x, y, size)) return [255, 255, 255, 255];
    return [r, g, b, 255];
  });
}

writeFileSync(join(outDir, "icon-192.png"), makeIcon(192));
writeFileSync(join(outDir, "icon-512.png"), makeIcon(512));
console.log("icons written to", outDir);
