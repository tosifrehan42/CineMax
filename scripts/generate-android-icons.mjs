import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// Precompute CRC32 table for valid PNG chunk encoding
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makePngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodeRgbaToPng(width, height, rgbaBuffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 6; // RGBA color type
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const rawData = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    rawData[rowStart] = 0; // Filter type 0 (None)
    rgbaBuffer.copy(rawData, rowStart + 1, y * stride, (y + 1) * stride);
  }

  const compressed = zlib.deflateSync(rawData, { level: 9 });
  return Buffer.concat([
    signature,
    makePngChunk('IHDR', ihdr),
    makePngChunk('IDAT', compressed),
    makePngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function clamp(v, min = 0, max = 1) {
  return Math.max(min, Math.min(max, v));
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// Signed distance to a rounded box centered at origin with half-extents (bx, by) and corner radius r
function sdRoundedBox(px, py, bx, by, r) {
  const qx = Math.abs(px) - bx + r;
  const qy = Math.abs(py) - by + r;
  const outDist = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inDist = Math.min(Math.max(qx, qy), 0);
  return outDist + inDist - r;
}

// Distance from point (px, py) to line segment (ax, ay) -> (bx, by)
function distToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const lenSq = vx * vx + vy * vy;
  const t = lenSq > 0 ? clamp((wx * vx + wy * vy) / lenSq, 0, 1) : 0;
  const projX = ax + t * vx;
  const projY = ay + t * vy;
  return Math.hypot(px - projX, py - projY);
}

/**
 * Signed distance to the bold geometric "CM" monogram + cinema frame rules.
 * Coordinates (x, y) are in [-1, 1] where the central [-0.58, 0.58] region
 * corresponds to the Android Adaptive Icon safe zone.
 */
function sdMonogram(x, y, scale = 1.0) {
  const sx = x / scale;
  const sy = y / scale;

  const strokeHalf = 0.068;
  const yTop = -0.26;
  const yBot = 0.26;

  // 1. Letter "C" centered at (-0.31, 0.0)
  const cx = -0.29;
  const cy = 0.0;
  const cRadius = 0.205;
  const dxC = sx - cx;
  const dyC = sy - cy;
  const rC = Math.hypot(dxC, dyC);
  const angleC = Math.atan2(dyC, dxC); // [-pi, pi], 0 is right (+x)
  const openAngle = 0.68; // ~39 degrees mouth opening on right
  let dC;
  if (Math.abs(angleC) > openAngle) {
    dC = Math.abs(rC - cRadius) - strokeHalf;
  } else {
    // Distance to upper and lower arc terminals
    const tipTopX = cx + cRadius * Math.cos(openAngle);
    const tipTopY = cy - cRadius * Math.sin(openAngle);
    const tipBotX = cx + cRadius * Math.cos(openAngle);
    const tipBotY = cy + cRadius * Math.sin(openAngle);
    dC = Math.min(
      Math.hypot(sx - tipTopX, sy - tipTopY),
      Math.hypot(sx - tipBotX, sy - tipBotY)
    ) - strokeHalf;
  }

  // 2. Letter "M" spanning x in [0.02, 0.49], y in [yTop, yBot]
  const mLeftX = 0.02;
  const mRightX = 0.48;
  const mMidX = 0.25;
  const mMidY = 0.10;
  const mTopY = yTop + 0.015;
  const mBotY = yBot - 0.015;

  const dM1 = distToSegment(sx, sy, mLeftX, mBotY, mLeftX, mTopY) - strokeHalf * 0.92;
  const dM2 = distToSegment(sx, sy, mLeftX, mTopY, mMidX, mMidY) - strokeHalf * 0.86;
  const dM3 = distToSegment(sx, sy, mMidX, mMidY, mRightX, mTopY) - strokeHalf * 0.86;
  const dM4 = distToSegment(sx, sy, mRightX, mTopY, mRightX, mBotY) - strokeHalf * 0.92;
  const dM = Math.min(dM1, dM2, dM3, dM4);

  // 3. Top & Bottom Cinema Frame Accent Bars
  const barHalfWidth = 0.46;
  const barHalfHeight = 0.016;
  const topBarD = sdRoundedBox(sx, sy + 0.40, barHalfWidth, barHalfHeight, 0.008);
  const botBarD = sdRoundedBox(sx, sy - 0.40, barHalfWidth, barHalfHeight, 0.008);

  return Math.min(dC, dM, topBarD, botBarD) * scale;
}

// Blend foreground premultiplied/straight RGBA over background RGBA
function blendOver(bgR, bgG, bgB, bgA, fgR, fgG, fgB, fgA) {
  const a = clamp(fgA, 0, 1);
  const invA = 1 - a;
  const outA = a + bgA * invA;
  if (outA <= 1e-6) return [0, 0, 0, 0];
  const outR = (fgR * a + bgR * bgA * invA) / outA;
  const outG = (fgG * a + bgG * bgA * invA) / outA;
  const outB = (fgB * a + bgB * bgA * invA) / outA;
  return [outR, outG, outB, outA];
}

/**
 * Renders a CineMax launcher icon of size (size x size).
 * mode:
 *  - 'square': Rounded squircle icon with obsidian background, spotlight glow, gold border & CM monogram
 *  - 'round': Circular icon with obsidian background, spotlight glow, gold ring & CM monogram
 *  - 'foreground': Transparent 108dp adaptive icon foreground with spotlight glow & CM monogram in safe zone
 */
function renderIconPng(size, mode) {
  const buf = Buffer.alloc(size * size * 4);
  const pxScale = 2.0 / size; // pixel size in [-1, 1] space
  const aaWidth = pxScale * 1.15;

  // Monogram scale: larger on legacy square/round icons, safe-zone sized (0.72) on 108dp adaptive foreground
  const monogramScale = mode === 'foreground' ? 0.72 : 0.92;

  for (let py = 0; py < size; py++) {
    const ny = ((py + 0.5) / size) * 2 - 1; // [-1, 1]
    for (let px = 0; px < size; px++) {
      const nx = ((px + 0.5) / size) * 2 - 1; // [-1, 1]

      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      // 1. Background + Frame (for 'square' and 'round' modes)
      let maskAlpha = 1.0;
      let frameRingAlpha = 0.0;

      if (mode === 'square') {
        const dBox = sdRoundedBox(nx, ny, 0.92, 0.92, 0.40);
        maskAlpha = 1.0 - smoothstep(-aaWidth, aaWidth, dBox);
        const dInnerRing = Math.abs(dBox + 0.045) - 0.016;
        frameRingAlpha = (1.0 - smoothstep(-aaWidth, aaWidth, dInnerRing)) * maskAlpha;
      } else if (mode === 'round') {
        const dCircle = Math.hypot(nx, ny) - 0.93;
        maskAlpha = 1.0 - smoothstep(-aaWidth, aaWidth, dCircle);
        const dInnerRing = Math.abs(dCircle + 0.045) - 0.016;
        frameRingAlpha = (1.0 - smoothstep(-aaWidth, aaWidth, dInnerRing)) * maskAlpha;
      }

      if (mode !== 'foreground' && maskAlpha > 0) {
        // Deep obsidian cinema base (#0A0D12 -> RGB 10, 13, 18) with subtle vertical vignette
        const vig = clamp(1.0 - Math.hypot(nx * 0.7, (ny - 0.1) * 0.7) * 0.35, 0.7, 1.05);
        r = 10 * vig;
        g = 13 * vig;
        b = 19 * vig;
        a = maskAlpha;
      }

      // 2. Subtle Cinema Spotlight Glow (overhead cone + warm center radial halo)
      const spotRadius = mode === 'foreground' ? 0.56 : 0.74;
      const distSpotlight = Math.hypot(nx * 0.95, (ny + 0.16) * 0.85);
      const radialGlow = Math.pow(clamp(1.0 - distSpotlight / spotRadius, 0, 1), 2.1);
      // Overhead projector cone effect
      const coneSpread = Math.max(0.18, (ny + 0.95) * 0.55);
      const coneFactor =
        ny > -0.95
          ? Math.exp(-(nx * nx) / (2 * coneSpread * coneSpread)) *
            clamp(1.0 - (ny + 0.95) * 0.52, 0, 1)
          : 0;

      const glowIntensity = clamp(radialGlow * 0.25 + coneFactor * 0.16, 0, 0.34);
      const effectiveGlowAlpha =
        mode === 'foreground' ? glowIntensity * 0.85 : glowIntensity * maskAlpha;

      if (effectiveGlowAlpha > 0.002) {
        [r, g, b, a] = blendOver(r, g, b, a, 245, 165, 24, effectiveGlowAlpha);
      }

      // 3. Subtle Metallic Gold Frame Ring (on square/round icons)
      if (frameRingAlpha > 0.002) {
        const ringGrad = clamp((ny + 0.9) / 1.8, 0, 1);
        const ringR = 251 * (1 - ringGrad) + 180 * ringGrad;
        const ringG = 191 * (1 - ringGrad) + 83 * ringGrad;
        const ringB = 36 * (1 - ringGrad) + 9 * ringGrad;
        [r, g, b, a] = blendOver(r, g, b, a, ringR, ringG, ringB, frameRingAlpha * 0.55);
      }

      // 4. Soft Drop Shadow beneath the "CM" Monogram
      const dShadow = sdMonogram(nx - 0.012, ny - 0.032, monogramScale);
      const shadowAlpha =
        (1.0 - smoothstep(-aaWidth * 3.2, aaWidth * 3.2, dShadow)) * 0.62 * maskAlpha;
      if (shadowAlpha > 0.002) {
        [r, g, b, a] = blendOver(r, g, b, a, 2, 3, 6, shadowAlpha);
      }

      // 5. Bold Golden "CM" Monogram + Cinema Accent Bars
      const dMono = sdMonogram(nx, ny, monogramScale);
      const monoAlpha = (1.0 - smoothstep(-aaWidth, aaWidth, dMono)) * maskAlpha;
      if (monoAlpha > 0.001) {
        // Rich cinema gold vertical gradient with subtle inner bevel highlight
        const gradT = clamp((ny / monogramScale + 0.42) / 0.84, 0, 1);
        // Top: #FDE68A (253, 230, 138), Mid: #F59E0B (245, 158, 11), Bottom: #B45309 (180, 83, 9)
        let goldR;
        let goldG;
        let goldB;
        if (gradT < 0.5) {
          const k = gradT * 2;
          goldR = 253 * (1 - k) + 245 * k;
          goldG = 230 * (1 - k) + 158 * k;
          goldB = 138 * (1 - k) + 11 * k;
        } else {
          const k = (gradT - 0.5) * 2;
          goldR = 245 * (1 - k) + 194 * k;
          goldG = 158 * (1 - k) + 94 * k;
          goldB = 11 * (1 - k) + 12 * k;
        }

        // Subtle inner edge specular sheen
        const bevel = clamp(1.0 - Math.abs(dMono + 0.018 * monogramScale) / (0.025 * monogramScale), 0, 1);
        goldR = clamp(goldR + bevel * 18, 0, 255);
        goldG = clamp(goldG + bevel * 16, 0, 255);
        goldB = clamp(goldB + bevel * 12, 0, 255);

        [r, g, b, a] = blendOver(r, g, b, a, goldR, goldG, goldB, monoAlpha);
      }

      const idx = (py * size + px) * 4;
      buf[idx] = Math.round(clamp(r, 0, 255));
      buf[idx + 1] = Math.round(clamp(g, 0, 255));
      buf[idx + 2] = Math.round(clamp(b, 0, 255));
      buf[idx + 3] = Math.round(clamp(a * 255, 0, 255));
    }
  }

  return encodeRgbaToPng(size, size, buf);
}

const DENSITIES = [
  { folder: 'mipmap-mdpi', launcherSize: 48, foregroundSize: 108 },
  { folder: 'mipmap-hdpi', launcherSize: 72, foregroundSize: 162 },
  { folder: 'mipmap-xhdpi', launcherSize: 96, foregroundSize: 216 },
  { folder: 'mipmap-xxhdpi', launcherSize: 144, foregroundSize: 324 },
  { folder: 'mipmap-xxxhdpi', launcherSize: 192, foregroundSize: 432 },
];

const resRoot = path.resolve(process.cwd(), 'android/app/src/main/res');

for (const { folder, launcherSize, foregroundSize } of DENSITIES) {
  const dirPath = path.join(resRoot, folder);
  fs.mkdirSync(dirPath, { recursive: true });

  const squarePng = renderIconPng(launcherSize, 'square');
  fs.writeFileSync(path.join(dirPath, 'ic_launcher.png'), squarePng);

  const roundPng = renderIconPng(launcherSize, 'round');
  fs.writeFileSync(path.join(dirPath, 'ic_launcher_round.png'), roundPng);

  const fgPng = renderIconPng(foregroundSize, 'foreground');
  fs.writeFileSync(path.join(dirPath, 'ic_launcher_foreground.png'), fgPng);

  console.log(
    `Generated ${folder}: ic_launcher.png (${launcherSize}x${launcherSize}), ic_launcher_round.png (${launcherSize}x${launcherSize}), ic_launcher_foreground.png (${foregroundSize}x${foregroundSize})`
  );
}

// Ensure ic_launcher_background.xml uses CineMax deep obsidian (#0A0D12)
const valuesDir = path.join(resRoot, 'values');
fs.mkdirSync(valuesDir, { recursive: true });
fs.writeFileSync(
  path.join(valuesDir, 'ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0A0D12</color>\n</resources>\n`,
  'utf8'
);
console.log('Updated values/ic_launcher_background.xml to #0A0D12');
