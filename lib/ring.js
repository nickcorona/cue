// A progress ring as a PNG, for the Now notification's large icon (Android shows only bitmaps
// there): done of total steps, drawn on the app's dark green. No image library: raw RGBA
// rows through zlib, with edge alpha from the pixel's distance for smooth curves.
import { deflateSync } from 'node:zlib';

const SIZE = 192, R = 66, W = 22;
const BG = [27, 66, 55], TRACK = [47, 111, 94], FILL = [155, 224, 195];

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = buf => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0); out.write(type, 4, 'ascii'); data.copy(out, 8);
  out.writeUInt32BE(crc(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const cover = d => Math.max(0, Math.min(1, 0.5 - d)); // d: signed distance to an edge, in px

export function ringPng(done, total) {
  const frac = total > 0 ? Math.max(0, Math.min(1, done / total)) : 0;
  const c = SIZE / 2, raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
  for (let y = 0; y < SIZE; y++) {
    raw[y * (SIZE * 4 + 1)] = 0;
    for (let x = 0; x < SIZE; x++) {
      const dx = x + 0.5 - c, dy = y + 0.5 - c, dist = Math.hypot(dx, dy);
      let px = BG;
      const onRing = cover(Math.abs(dist - R) - W / 2);
      if (onRing > 0) {
        const ang = (Math.atan2(dx, -dy) / (2 * Math.PI) + 1) % 1; // 0 at 12 o'clock, clockwise
        px = mix(BG, ang < frac ? FILL : TRACK, onRing);
      }
      const o = y * (SIZE * 4 + 1) + 1 + x * 4;
      raw[o] = px[0]; raw[o + 1] = px[1]; raw[o + 2] = px[2]; raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
