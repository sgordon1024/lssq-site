// Gets new photos ready for the site: `npm run photos`.
// For any photo in src/img that's too big or says where it was taken, it turns the
// photo the right way up, shrinks it to 2000px on the long side and saves it without
// the hidden camera data. On a Mac it also turns iPhone HEIC photos into JPEGs.
// Photos that are already fine are left alone.
import { readFile, writeFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import sharp from "sharp";
import { allPhotos, photoProblems, rel, mb, MAX_SIDE, MAX_BYTES, PHOTO_TYPES, HEIC_TYPES } from "./photo-rules.mjs";

let fixed = 0;
let stuck = 0;

// Re-save at falling quality until it fits, starting high so most photos look untouched.
async function shrink(input, ext) {
  const formats = {
    ".jpg": (s, q) => s.jpeg({ quality: q, mozjpeg: true }),
    ".jpeg": (s, q) => s.jpeg({ quality: q, mozjpeg: true }),
    ".webp": (s, q) => s.webp({ quality: q }),
    ".png": (s) => s.png({ compressionLevel: 9 }),
  };
  let out;
  for (const q of [82, 74, 66, 58]) {
    const pipeline = sharp(input).autoOrient().resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true });
    out = await formats[ext](pipeline, q).toBuffer(); // sharp leaves out EXIF, XMP and GPS unless asked to keep them
    if (out.length <= MAX_BYTES || ext === ".png") break;
  }
  return out;
}

for (let file of await allPhotos()) {
  let ext = path.extname(file).toLowerCase();

  if (HEIC_TYPES.includes(ext)) {
    if (process.platform !== "darwin") {
      console.log(`✗ ${rel(file)} is an iPhone HEIC photo. This computer can't convert it, so save it as a JPEG first.`);
      stuck++;
      continue;
    }
    const jpg = file.slice(0, -ext.length) + ".jpg";
    execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "90", file, "--out", jpg], { stdio: "ignore" });
    await rm(file);
    console.log(`✓ Turned ${rel(file)} into ${path.basename(jpg)}. Use that name wherever the photo is used.`);
    file = jpg;
    ext = ".jpg";
    fixed++;
  }
  if (!PHOTO_TYPES.includes(ext)) continue;

  const input = await readFile(file);
  const meta = await sharp(input).metadata();
  const problems = photoProblems(meta, input.length);
  if (!problems.length) continue;

  const out = await shrink(input, ext);
  await writeFile(file, out);
  const after = await sharp(out).metadata();
  const left = photoProblems(after, out.length);
  if (left.length) {
    console.log(`✗ ${rel(file)}: still too big after shrinking (${mb(out.length)}). Save it as a JPEG instead.`);
    stuck++;
  } else {
    console.log(`✓ ${rel(file)}: ${meta.width} × ${meta.height}, ${mb(input.length)} → ${after.width} × ${after.height}, ${mb(out.length)}, no hidden data.`);
    fixed++;
  }
}

if (!fixed && !stuck) console.log("All photos are ready. Nothing to do.");
else if (!stuck) console.log(`\nDone. ${fixed} photo${fixed === 1 ? "" : "s"} ready. Run npm run check next.`);
process.exitCode = stuck ? 1 : 0;
