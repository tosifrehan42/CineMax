/**
 * Client-side browser OCR service using lazy-loaded Tesseract.js.
 * Processes PNG, JPG, JPEG, and WEBP screenshots locally in the browser
 * without uploading image data to any server.
 */

export interface OcrProgressUpdate {
  status: string;
  progress: number; // 0 to 100
}

export interface OcrExtractionResult {
  rawText: string;
  lines: string[];
  confidence: number;
  error: string | null;
}

const MAX_OCR_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB

// Reliable CDN paths for Tesseract worker, WASM core, and English traineddata
// Works identically across Vite dev (/), GitHub Pages (/CineMax/), and Capacitor Android WebViews
const TESSERACT_WORKER_CDN =
  'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js';
const TESSERACT_CORE_CDN =
  'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.0';
const TESSERACT_LANG_CDN =
  'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int';

/**
 * Preprocesses an image file on an offscreen HTML5 Canvas to improve OCR readability
 * on dark-mode phone screenshots and checklists while capping extreme dimensions.
 */
async function preprocessImageForOcr(file: File): Promise<Blob | File> {
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const maxDim = 2200;
    let width = bitmap.width;
    let height = bitmap.height;

    if (width <= 0 || height <= 0) {
      bitmap.close();
      return file;
    }

    if (width > maxDim || height > maxDim) {
      const scale = maxDim / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    } else if (width < 600 && height < 600) {
      // Upscale small screenshots slightly so glyphs are crisp for Tesseract
      const scale = 1.5;
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return file;
    }

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    // Convert to high-contrast grayscale and invert if background is predominantly dark
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    let luminanceSum = 0;
    const pixelCount = data.length / 4;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      luminanceSum += lum;
      data[i] = lum;
      data[i + 1] = lum;
      data[i + 2] = lum;
    }

    const avgLuminance = pixelCount > 0 ? luminanceSum / pixelCount : 128;
    const isDarkBackground = avgLuminance < 115;

    for (let i = 0; i < data.length; i += 4) {
      let lum = data[i];
      if (isDarkBackground) {
        lum = 255 - lum;
      }
      // Gentle contrast stretch around midpoint
      const stretched = Math.max(0, Math.min(255, Math.round((lum - 128) * 1.35 + 128)));
      data[i] = stretched;
      data[i + 1] = stretched;
      data[i + 2] = stretched;
    }

    ctx.putImageData(imageData, 0, 0);

    const processedBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png')
    );
    return processedBlob || file;
  } catch {
    return file;
  }
}

/**
 * Cleans raw OCR lines to strip UI chrome (battery percentages, status bar clocks,
 * stray 1-character noise) while strictly preserving actual visible title text.
 */
export function cleanExtractedOcrLines(rawText: string): string[] {
  const lines = String(rawText || '').split(/\r?\n/);
  const cleaned: string[] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine
      .replace(/[|¦]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!trimmed || trimmed.length < 2) continue;

    // Skip pure mobile status-bar noise (e.g., "9:41 AM 100%", "5G LTE")
    if (/^\d{1,2}:\d{2}\s*(?:AM|PM)?\s*\d{1,3}%?$/i.test(trimmed)) continue;
    if (/^(?:5G|4G|LTE|Wi-Fi|Carrier|Battery)$/i.test(trimmed)) continue;

    // Require at least two alphanumeric characters
    const alphaNumCount = (trimmed.match(/[A-Za-z0-9]/g) || []).length;
    if (alphaNumCount < 2) continue;

    cleaned.push(trimmed);
  }

  return cleaned;
}

/**
 * Runs client-side English OCR on an uploaded screenshot using lazy-loaded Tesseract.js.
 * Always terminates the OCR worker in a finally block.
 */
export async function extractTextFromImageWithOcr(
  file: File,
  onProgress?: (update: OcrProgressUpdate) => void
): Promise<OcrExtractionResult> {
  if (!file) {
    return {
      rawText: '',
      lines: [],
      confidence: 0,
      error: 'Please select a valid screenshot image (PNG, JPG, JPEG, or WEBP).',
    };
  }

  if (file.size <= 0) {
    return {
      rawText: '',
      lines: [],
      confidence: 0,
      error: `The selected image "${file.name}" is empty (0 bytes).`,
    };
  }

  if (file.size > MAX_OCR_IMAGE_BYTES) {
    return {
      rawText: '',
      lines: [],
      confidence: 0,
      error: `Image file is too large (${(file.size / (1024 * 1024)).toFixed(
        1
      )} MB). Maximum allowed size for PNG/JPG/WEBP screenshots is 8 MB.`,
    };
  }

  let worker: any = null;

  try {
    onProgress?.({ status: 'Loading browser OCR engine...', progress: 5 });

    // Lazy-load Tesseract.js only when user actually imports a screenshot
    const tesseractModule = await import('tesseract.js');
    const createWorker =
      tesseractModule.createWorker || (tesseractModule as any).default?.createWorker;

    if (typeof createWorker !== 'function') {
      throw new Error('Could not initialize the browser OCR engine.');
    }

    onProgress?.({ status: 'Preparing image for OCR...', progress: 12 });
    const preparedInput = await preprocessImageForOcr(file);

    worker = await createWorker('eng', 1, {
      workerPath: TESSERACT_WORKER_CDN,
      corePath: TESSERACT_CORE_CDN,
      langPath: TESSERACT_LANG_CDN,
      logger: (msg: any) => {
        if (!msg || typeof msg.progress !== 'number') return;
        const pct = Math.max(0, Math.min(100, Math.round(msg.progress * 100)));
        if (msg.status === 'recognizing text') {
          const scaled = Math.min(98, 25 + Math.round(pct * 0.73));
          onProgress?.({
            status: `Reading screenshot with local OCR (${pct}%)...`,
            progress: scaled,
          });
        } else if (
          typeof msg.status === 'string' &&
          (msg.status.includes('loading') || msg.status.includes('initializing'))
        ) {
          onProgress?.({
            status: 'Initializing local OCR worker...',
            progress: 20,
          });
        }
      },
    });

    const recognition = await worker.recognize(preparedInput);
    const rawText = String(recognition?.data?.text || '').trim();
    const confidence = Number(recognition?.data?.confidence || 0);
    const lines = cleanExtractedOcrLines(rawText);

    onProgress?.({ status: 'OCR complete', progress: 100 });

    if (lines.length === 0) {
      return {
        rawText: '',
        lines: [],
        confidence,
        error:
          'Could not read any clear movie or TV titles from this screenshot. Please use a clearer screenshot, paste your list as text, or upload a TXT/CSV file.',
      };
    }

    return {
      rawText: lines.join('\n'),
      lines,
      confidence,
      error: null,
    };
  } catch (err: any) {
    return {
      rawText: '',
      lines: [],
      confidence: 0,
      error:
        err?.message && !String(err.message).includes('fetch')
          ? `Screenshot OCR could not process this image (${err.message}). Please paste your list as text or upload a TXT/CSV file.`
          : 'Could not read text from this screenshot. Please try a clearer image, paste your list as text, or upload a TXT/CSV file.',
    };
  } finally {
    if (worker && typeof worker.terminate === 'function') {
      try {
        await worker.terminate();
      } catch {
        // Ignore worker termination cleanup errors
      }
    }
  }
}
