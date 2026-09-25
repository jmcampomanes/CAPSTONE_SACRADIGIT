/* ============================================
   SacraDigit — Document Scanner (browser side)
   Loads a photo/scan or PDF into a canvas, cleans
   it up (scan-engine.js), and runs Tesseract OCR
   in the browser. Nothing is sent to an outside
   OCR service; Tesseract's program and English
   language data are downloaded from the jsDelivr
   CDN the first time a scan runs, then cached by
   the browser.
   ============================================ */

import { enhanceImage, wordsFromTesseract, buildRows, rowsToText, averageConfidence } from './scan-engine.js';

// Long side of a source page before clean-up. Bigger adds time, not accuracy.
const MAX_SOURCE_SIDE = 4200;

/* ------------------------------------------
   Loading files
------------------------------------------ */

function canvasOf(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function drawScaled(source, sw, sh) {
  const k = Math.min(1, MAX_SOURCE_SIDE / Math.max(sw, sh));
  const c = canvasOf(Math.round(sw * k), Math.round(sh * k));
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, c.width, c.height);
  return c;
}

export const isPdf = (file) => file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name));

let pdfjsPromise = null;
function loadPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

/**
 * Opens an image or PDF. Returns { pageCount, renderPage(n) → canvas }
 * (n is 1-based). Photos keep their camera orientation (EXIF).
 */
export async function openDocument(file) {
  if (isPdf(file)) {
    const pdfjs = await loadPdfJs();
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    return {
      pageCount: pdf.numPages,
      async renderPage(n) {
        const page = await pdf.getPage(n);
        const base = page.getViewport({ scale: 1 });
        // ~300 dpi for a letter/A4 page, capped
        const scale = Math.min(MAX_SOURCE_SIDE / Math.max(base.width, base.height), 300 / 72);
        const vp = page.getViewport({ scale });
        const c = canvasOf(Math.round(vp.width), Math.round(vp.height));
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, c.width, c.height);
        await page.render({ canvasContext: ctx, viewport: vp, canvas: c }).promise;
        return c;
      },
    };
  }

  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const c = drawScaled(bitmap, bitmap.width, bitmap.height);
  bitmap.close?.();
  return { pageCount: 1, async renderPage() { return c; } };
}

/** Rotates a canvas by quarter turns (1 = 90° clockwise). */
export function rotateCanvas(src, quarterTurns) {
  const q = ((quarterTurns % 4) + 4) % 4;
  if (!q) return src;
  const swap = q % 2 === 1;
  const c = canvasOf(swap ? src.height : src.width, swap ? src.width : src.height);
  const ctx = c.getContext('2d');
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((q * Math.PI) / 2);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return c;
}


/* ------------------------------------------
   OCR
------------------------------------------ */

let workerPromise = null;
let progressListener = null;

function getWorker() {
  if (!workerPromise) {
    workerPromise = import('tesseract.js').then(({ createWorker }) =>
      createWorker('eng', 1 /* LSTM neural engine */, {
        logger: (m) => progressListener && progressListener(m),
      })
    ).then(async (worker) => {
      await worker.setParameters({
        // Sparse text: find every bit of text on the page wherever it sits.
        // Reading order is rebuilt afterwards (buildRows), so Tesseract's
        // own block ordering doesn't matter — forms come out left to right.
        tessedit_pageseg_mode: '11',
        preserve_interword_spaces: '1',
        user_defined_dpi: '300',
      });
      return worker;
    }).catch((err) => { workerPromise = null; throw err; });
  }
  return workerPromise;
}

/** Starts downloading Tesseract in the background so the first scan starts faster. */
export function warmUpOcr() {
  getWorker().catch(() => {});
}

/**
 * Cleans up and reads one page.
 *   source    — canvas of the page (already rotated the right way up)
 *   threshold — true for faint ink / shadowy phone photos
 *   onProgress({ stage, progress }) — stage: 'enhance' | 'load' | 'ocr'
 * Returns { canvas (the cleaned image the word boxes refer to), words,
 *           rows, text, confidence, skew }.
 */
export async function scanPage(source, { threshold = false, onProgress = () => {} } = {}) {
  onProgress({ stage: 'enhance', progress: 0 });
  // Let the progress UI paint before the (synchronous) clean-up runs.
  await new Promise(r => setTimeout(r, 30));
  const ctx = source.getContext('2d');
  const img = ctx.getImageData(0, 0, source.width, source.height);
  const clean = enhanceImage(img, { targetWidth: 2400, threshold });

  const out = canvasOf(clean.width, clean.height);
  out.getContext('2d').putImageData(new ImageData(clean.data, clean.width, clean.height), 0, 0);

  onProgress({ stage: 'load', progress: 0 });
  progressListener = (m) => {
    if (m.status === 'recognizing text') onProgress({ stage: 'ocr', progress: m.progress || 0 });
    else onProgress({ stage: 'load', progress: m.progress || 0 });
  };
  try {
    const worker = await getWorker();
    const { data } = await worker.recognize(out, {}, { blocks: true });
    const words = wordsFromTesseract(data);
    const rows = buildRows(words);
    return { canvas: out, words, rows, text: rowsToText(rows), confidence: averageConfidence(rows), skew: clean.skew };
  } finally {
    progressListener = null;
  }
}
