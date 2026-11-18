// What a photo needs before it goes on the site. Shared by `npm run check`, which
// reports photos that break these rules, and `npm run photos`, which fixes them.
import { readdir } from "node:fs/promises";
import path from "node:path";

export const ROOT = path.resolve(import.meta.dirname, "..");
export const SRC = path.join(ROOT, "src");
export const IMG = path.join(SRC, "img");

// Long side in pixels, and file size. Phone photos are about 4000px and 3 to 5 MB.
export const MAX_SIDE = 2000;
export const MAX_BYTES = 1024 * 1024;
export const PHOTO_TYPES = [".jpg", ".jpeg", ".png", ".webp"];
export const OTHER_TYPES = [".gif", ".avif", ".svg"];
export const HEIC_TYPES = [".heic", ".heif"];

export const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
export const rel = (file) => path.relative(ROOT, file).split(path.sep).join("/");

// Every file under src/img, skipping hidden ones like .gitkeep and .DS_Store.
export async function allPhotos(dir = IMG) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await allPhotos(full)));
    else out.push(full);
  }
  return out;
}

// Does the photo say where it was taken? Phones write the spot into the EXIF data
// (the GPS section) and sometimes into XMP. A public repo would share it with anyone.
export function hasLocation(meta) {
  if (meta.xmp && /GPSLatitude/i.test(meta.xmp.toString("latin1"))) return true;
  const exif = meta.exif;
  if (!exif || exif.length < 14) return false;
  const o = exif.toString("latin1", 0, 6) === "Exif\0\0" ? 6 : 0;
  const le = exif.toString("latin1", o, o + 2) === "II";
  const u16 = (p) => (le ? exif.readUInt16LE(o + p) : exif.readUInt16BE(o + p));
  const u32 = (p) => (le ? exif.readUInt32LE(o + p) : exif.readUInt32BE(o + p));
  try {
    const ifd0 = u32(4);
    for (let i = 0, n = u16(ifd0); i < n; i++) {
      const entry = ifd0 + 2 + i * 12;
      if (u16(entry) !== 0x8825) continue; // the pointer to the GPS section
      const gps = u32(entry + 8);
      for (let j = 0, m = u16(gps); j < m; j++) {
        const tag = u16(gps + 2 + j * 12);
        if (tag === 0x0002 || tag === 0x0004) return true; // latitude or longitude
      }
    }
  } catch {
    return false; // unreadable EXIF: nothing we can find
  }
  return false;
}

// What's wrong with a photo, if anything, as short plain reasons.
export function photoProblems(meta, bytes) {
  const out = [];
  const side = Math.max(meta.width || 0, meta.height || 0);
  if (side > MAX_SIDE || bytes > MAX_BYTES) out.push(`it's too big (${meta.width} × ${meta.height}, ${mb(bytes)})`);
  if (hasLocation(meta)) out.push("it has hidden data saying where it was taken");
  return out;
}
