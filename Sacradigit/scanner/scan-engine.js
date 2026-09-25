/* ============================================
   SacraDigit — Document Scanner Engine
   Pure functions (no DOM), shared by the Digital
   Archives scan screen (document-scanner.js) and
   testable in Node.

   1. enhanceImage()  cleans a photo/scan before OCR:
      deskew → upscale → flatten uneven lighting /
      yellowed paper → stretch contrast → (optional)
      adaptive threshold.
   2. buildRows()     rebuilds the page in reading
      order: every word is placed on a row by its
      vertical position, rows go top to bottom, and
      words inside a row go LEFT TO RIGHT. Big gaps
      inside a row split it into cells ("segments"),
      which is how form boxes stay separate.
   3. extractFields() finds known labels (NAME, DATE
      OF BIRTH, …) for the chosen document type and
      reads the value beside or below each label.
   ============================================ */

/* ------------------------------------------
   1. IMAGE ENHANCEMENT
   Works on { width, height, data } RGBA buffers
   (canvas ImageData in the browser).
------------------------------------------ */

function toGray({ width, height, data }) {
  const g = new Float32Array(width * height);
  for (let i = 0, p = 0; i < g.length; i++, p += 4) {
    g[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  }
  return { w: width, h: height, g };
}

function resizeGray(src, nw, nh) {
  const { w, h, g } = src;
  const out = new Float32Array(nw * nh);
  const sx = w / nw, sy = h / nh;
  for (let y = 0; y < nh; y++) {
    const fy = Math.min(h - 1, Math.max(0, (y + 0.5) * sy - 0.5));
    const y0 = Math.floor(fy), y1 = Math.min(h - 1, y0 + 1), dy = fy - y0;
    for (let x = 0; x < nw; x++) {
      const fx = Math.min(w - 1, Math.max(0, (x + 0.5) * sx - 0.5));
      const x0 = Math.floor(fx), x1 = Math.min(w - 1, x0 + 1), dx = fx - x0;
      const a = g[y0 * w + x0], b = g[y0 * w + x1], c = g[y1 * w + x0], d = g[y1 * w + x1];
      out[y * nw + x] = (a * (1 - dx) + b * dx) * (1 - dy) + (c * (1 - dx) + d * dx) * dy;
    }
  }
  return { w: nw, h: nh, g: out };
}

/** Rotates by `deg` (counter-clockwise positive) around the centre, filling with white. */
function rotateGray(src, deg) {
  if (!deg) return src;
  const { w, h, g } = src;
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const cx = w / 2, cy = h / 2;
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // inverse-map each output pixel back into the source
      const dx = x - cx, dy = y - cy;
      const sx = cos * dx - sin * dy + cx;
      const sy = sin * dx + cos * dy + cy;
      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      if (x0 < 0 || y0 < 0 || x0 >= w - 1 || y0 >= h - 1) { out[y * w + x] = 255; continue; }
      const fx = sx - x0, fy = sy - y0, i = y0 * w + x0;
      out[y * w + x] = (g[i] * (1 - fx) + g[i + 1] * fx) * (1 - fy) + (g[i + w] * (1 - fx) + g[i + w + 1] * fx) * fy;
    }
  }
  return { w, h, g: out };
}

/**
 * Estimates page skew in degrees by finding the rotation whose horizontal
 * projection of dark pixels is "peakiest" (text lines line up into rows).
 */
export function estimateSkew(src, maxDeg = 6) {
  // Work on a ~900px-wide copy for speed.
  const scale = Math.min(1, 900 / src.w);
  const small = scale < 1 ? resizeGray(src, Math.round(src.w * scale), Math.round(src.h * scale)) : src;
  const { w, h, g } = small;
  let sum = 0;
  for (let i = 0; i < g.length; i++) sum += g[i];
  const thresh = (sum / g.length) * 0.72;
  const pts = [];
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) if (g[y * w + x] < thresh) pts.push(x - w / 2, y - h / 2);
  if (pts.length < 200) return 0;

  const score = (deg) => {
    const rad = (deg * Math.PI) / 180, s = Math.sin(rad), c = Math.cos(rad);
    const bins = new Float64Array(h * 2 + 4);
    for (let i = 0; i < pts.length; i += 2) {
      const yy = Math.round(pts[i + 1] * c - pts[i] * s + h);
      if (yy >= 0 && yy < bins.length) bins[yy]++;
    }
    let sc = 0;
    for (let i = 1; i < bins.length; i++) { const d = bins[i] - bins[i - 1]; sc += d * d; }
    return sc;
  };

  let best = 0, bestScore = -1;
  for (let d = -maxDeg; d <= maxDeg + 1e-9; d += 0.5) {
    const s = score(d);
    if (s > bestScore) { bestScore = s; best = d; }
  }
  for (let d = best - 0.5; d <= best + 0.5 + 1e-9; d += 0.1) {
    const s = score(d);
    if (s > bestScore) { bestScore = s; best = d; }
  }
  return Math.round(best * 10) / 10;
}

/**
 * Flattens uneven lighting and paper colour: estimates the paper
 * brightness everywhere (max over coarse blocks, which ignores ink,
 * then smoothed) and divides it out, so the page reads as white paper
 * with dark ink.
 */
function flattenBackground(src) {
  const { w, h, g } = src;
  const block = Math.max(8, Math.round(Math.max(w, h) / 90));
  const bw = Math.ceil(w / block), bh = Math.ceil(h / block);
  const bg = new Float32Array(bw * bh);
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      // 90th-percentile-ish: the brightest values in the block are paper
      const vals = [];
      for (let y = by * block; y < Math.min(h, (by + 1) * block); y += 2) {
        for (let x = bx * block; x < Math.min(w, (bx + 1) * block); x += 2) vals.push(g[y * w + x]);
      }
      vals.sort((a, b) => a - b);
      bg[by * bw + bx] = vals[Math.floor(vals.length * 0.9)] || 255;
    }
  }
  // smooth the block grid (3 passes of a 3x3 box blur)
  let cur = bg;
  for (let pass = 0; pass < 3; pass++) {
    const nxt = new Float32Array(cur.length);
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      let s = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const yy = y + dy, xx = x + dx;
        if (yy >= 0 && yy < bh && xx >= 0 && xx < bw) { s += cur[yy * bw + xx]; n++; }
      }
      nxt[y * bw + x] = s / n;
    }
    cur = nxt;
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const fy = Math.min(bh - 1, Math.max(0, y / block - 0.5));
    const y0 = Math.floor(fy), y1 = Math.min(bh - 1, y0 + 1), dy = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(bw - 1, Math.max(0, x / block - 0.5));
      const x0 = Math.floor(fx), x1 = Math.min(bw - 1, x0 + 1), dx = fx - x0;
      const b = (cur[y0 * bw + x0] * (1 - dx) + cur[y0 * bw + x1] * dx) * (1 - dy) +
                (cur[y1 * bw + x0] * (1 - dx) + cur[y1 * bw + x1] * dx) * dy;
      out[y * w + x] = Math.min(255, (g[y * w + x] / Math.max(b, 1)) * 255);
    }
  }
  return { w, h, g: out };
}

/** Stretches levels so the darkest ink is black and the paper is white. */
function stretchContrast(src) {
  const { g } = src;
  const hist = new Uint32Array(256);
  for (let i = 0; i < g.length; i++) hist[Math.max(0, Math.min(255, g[i] | 0))]++;
  const pick = (p) => { let acc = 0; const target = g.length * p; for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= target) return v; } return 255; };
  const lo = pick(0.005), hi = Math.max(lo + 1, pick(0.6));
  const out = new Float32Array(g.length);
  for (let i = 0; i < g.length; i++) out[i] = Math.max(0, Math.min(255, ((g[i] - lo) / (hi - lo)) * 255));
  return { ...src, g: out };
}

/** Sauvola adaptive threshold — for faint ink or uneven phone photos. */
function sauvola(src, win, k = 0.3, R = 128) {
  const { w, h, g } = src;
  const W = w + 1;
  const I = new Float64Array(W * (h + 1)), I2 = new Float64Array(W * (h + 1));
  for (let y = 0; y < h; y++) {
    let rs = 0, rs2 = 0;
    for (let x = 0; x < w; x++) {
      const v = g[y * w + x];
      rs += v; rs2 += v * v;
      I[(y + 1) * W + x + 1] = I[y * W + x + 1] + rs;
      I2[(y + 1) * W + x + 1] = I2[y * W + x + 1] + rs2;
    }
  }
  const r = Math.floor(win / 2);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const ya = Math.max(0, y - r), yb = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const xa = Math.max(0, x - r), xb = Math.min(w, x + r + 1);
      const n = (yb - ya) * (xb - xa);
      const s = I[yb * W + xb] - I[ya * W + xb] - I[yb * W + xa] + I[ya * W + xa];
      const s2 = I2[yb * W + xb] - I2[ya * W + xb] - I2[yb * W + xa] + I2[ya * W + xa];
      const m = s / n;
      const sd = Math.sqrt(Math.max(0, s2 / n - m * m));
      out[y * w + x] = g[y * w + x] > m * (1 + k * (sd / R - 1)) ? 255 : 0;
    }
  }
  return { w, h, g: out };
}

/**
 * Full clean-up pipeline. Returns { width, height, data (RGBA), skew, scale }.
 *   targetWidth  — upscale/downscale so text is big enough for OCR
 *   threshold    — true = Sauvola black/white (faint ink, phone photos)
 *   deskew       — true = straighten a slightly tilted page
 */
export function enhanceImage(imageData, { targetWidth = 2400, threshold = false, deskew = true } = {}) {
  let img = toGray(imageData);
  const skew = deskew ? estimateSkew(img) : 0;
  if (skew) img = rotateGray(img, skew);

  const scale = Math.max(0.5, Math.min(4, targetWidth / img.w));
  if (Math.abs(scale - 1) > 0.05) img = resizeGray(img, Math.round(img.w * scale), Math.round(img.h * scale));

  img = stretchContrast(flattenBackground(img));
  if (threshold) img = sauvola(img, Math.max(25, Math.round(img.w / 60)) | 1);

  const data = new Uint8ClampedArray(img.w * img.h * 4);
  for (let i = 0, p = 0; i < img.g.length; i++, p += 4) {
    const v = img.g[i];
    data[p] = data[p + 1] = data[p + 2] = v;
    data[p + 3] = 255;
  }
  return { width: img.w, height: img.h, data, skew, scale };
}


/* ------------------------------------------
   2. READING ORDER — rows, left to right
------------------------------------------ */

const median = (arr) => {
  if (!arr.length) return 0;
  const s = arr.slice().sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

// Pure punctuation / box-line debris ("|", "__", "—", "[=") isn't text.
const isDebris = (t) => !/[A-Za-z0-9ÑñÁÉÍÓÚáéíóú]/.test(t);

/**
 * Flattens a Tesseract result (data.blocks) into plain word objects.
 * Each: { text, conf, x0, y0, x1, y1 } in the OCR'd image's pixels.
 */
export function wordsFromTesseract(data) {
  const out = [];
  for (const b of data.blocks || []) for (const p of b.paragraphs || []) for (const l of p.lines || []) for (const w of l.words || []) {
    const text = (w.text || '').trim();
    if (!text) continue;
    out.push({ text, conf: Math.round(w.confidence), x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 });
  }
  return out;
}

/**
 * Groups words into rows (top → bottom) and orders each row LEFT → RIGHT.
 * Returns [{ y0, y1, words, segments: [{ x0, x1, text, words, conf }] }].
 */
export function buildRows(words) {
  const ws = words
    .filter(w => !isDebris(w.text))
    .filter(w => !(w.conf < 20 && w.text.length <= 2))
    .map(w => ({ ...w, cy: (w.y0 + w.y1) / 2, h: Math.max(1, w.y1 - w.y0) }));
  if (!ws.length) return [];

  const medH = median(ws.map(w => w.h));
  // Drop giant boxes (stamps, logos, signatures read as one "word") that
  // would otherwise glue several text rows together.
  const usable = ws.filter(w => w.h <= medH * 3.2 || w.conf >= 70);
  usable.sort((a, b) => a.cy - b.cy);

  const rows = [];
  for (const w of usable) {
    let best = null, bestRatio = 0;
    // Only the last few rows can overlap vertically, since words are sorted by y.
    for (let i = rows.length - 1; i >= Math.max(0, rows.length - 6); i--) {
      const r = rows[i];
      const ov = Math.min(r.y1, w.y1) - Math.max(r.y0, w.y0);
      const ratio = ov / Math.min(r.h, w.h);
      if (ratio > bestRatio) { bestRatio = ratio; best = r; }
    }
    if (best && bestRatio >= 0.45 && Math.abs(best.cy - w.cy) < Math.max(best.h, w.h) * 0.7) {
      best.words.push(w);
      const n = best.words.length;
      best.cy = best.cy + (w.cy - best.cy) / n;
      best.h = best.h + (w.h - best.h) / n;
      best.y0 = best.cy - best.h / 2;
      best.y1 = best.cy + best.h / 2;
    } else {
      rows.push({ words: [w], cy: w.cy, h: w.h, y0: w.y0, y1: w.y1 });
    }
  }

  rows.sort((a, b) => a.cy - b.cy);
  for (const r of rows) {
    r.words.sort((a, b) => a.x0 - b.x0);
    const charW = median(r.words.map(w => (w.x1 - w.x0) / Math.max(1, w.text.length))) || medH * 0.5;
    const gapLimit = Math.max(medH * 1.6, charW * 3.2);
    r.segments = [];
    let seg = null;
    for (const w of r.words) {
      if (seg && w.x0 - seg.x1 <= gapLimit) {
        seg.words.push(w);
        seg.x1 = Math.max(seg.x1, w.x1);
      } else {
        seg = { x0: w.x0, x1: w.x1, words: [w] };
        r.segments.push(seg);
      }
    }
    for (const s of r.segments) {
      s.text = s.words.map(w => w.text).join(' ');
      s.conf = Math.round(s.words.reduce((a, w) => a + w.conf, 0) / s.words.length);
    }
    r.y0 = Math.min(...r.words.map(w => w.y0));
    r.y1 = Math.max(...r.words.map(w => w.y1));
  }
  return rows;
}

/** Plain text in reading order; cells on the same row are separated by " | ". */
export function rowsToText(rows) {
  return rows.map(r => r.segments.map(s => s.text).join(' | ')).join('\n');
}

export function averageConfidence(rows) {
  const all = rows.flatMap(r => r.words);
  return all.length ? Math.round(all.reduce((a, w) => a + w.conf, 0) / all.length) : 0;
}


/* ------------------------------------------
   3. VALUE PARSERS
------------------------------------------ */

const MONTHS = {
  JAN: 1, JANUARY: 1, ENERO: 1,
  FEB: 2, FEBRUARY: 2, FEBRERO: 2, PEBRERO: 2,
  MAR: 3, MARCH: 3, MARZO: 3, MARSO: 3,
  APR: 4, APRIL: 4, ABRIL: 4,
  MAY: 5, MAYO: 5,
  JUN: 6, JUNE: 6, JUNIO: 6, HUNYO: 6,
  JUL: 7, JULY: 7, JULIO: 7, HULYO: 7,
  AUG: 8, AUGUST: 8, AGOSTO: 8,
  SEP: 9, SEPT: 9, SEPTEMBER: 9, SEPTIEMBRE: 9, SETYEMBRE: 9,
  OCT: 10, OCTOBER: 10, OCTUBRE: 10, OKTUBRE: 10,
  NOV: 11, NOVEMBER: 11, NOVIEMBRE: 11, NOBYEMBRE: 11,
  DEC: 12, DECEMBER: 12, DICIEMBRE: 12, DISYEMBRE: 12,
};

const MONTH_WORD = new RegExp(`^(?:${Object.keys(MONTHS).join('|')})$`);

const pad2 = (n) => String(n).padStart(2, '0');
const fullYear = (y) => (y < 100 ? (y > 30 ? 1900 + y : 2000 + y) : y);
const validDate = (y, m, d) => y >= 1800 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31;

/** Finds a date in free text → 'YYYY-MM-DD', or '' if none. */
export function parseDate(text) {
  if (!text) return '';
  const t = text.toUpperCase().replace(/(\d)(ST|ND|RD|TH)\b/g, '$1').replace(/\bDAY OF\b/g, ' ').replace(/[,.]/g, ' ').replace(/\s+/g, ' ');
  const monthRe = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');
  let m;
  // May 22 2000
  if ((m = t.match(new RegExp(`\\b(${monthRe})\\s+(\\d{1,2})\\s+(\\d{2,4})\\b`)))) {
    const y = fullYear(+m[3]), mo = MONTHS[m[1]], d = +m[2];
    if (validDate(y, mo, d)) return `${y}-${pad2(mo)}-${pad2(d)}`;
  }
  // 22 May 2000
  if ((m = t.match(new RegExp(`\\b(\\d{1,2})\\s+(${monthRe})\\s+(\\d{2,4})\\b`)))) {
    const y = fullYear(+m[3]), mo = MONTHS[m[2]], d = +m[1];
    if (validDate(y, mo, d)) return `${y}-${pad2(mo)}-${pad2(d)}`;
  }
  // 2000-05-22
  if ((m = t.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/))) {
    const y = +m[1], mo = +m[2], d = +m[3];
    if (validDate(y, mo, d)) return `${y}-${pad2(mo)}-${pad2(d)}`;
  }
  // 5/22/2000 or 6/16/99 — Philippine documents use month/day/year
  if ((m = t.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/))) {
    let mo = +m[1], d = +m[2];
    const y = fullYear(+m[3]);
    if (mo > 12 && d <= 12) [mo, d] = [d, mo];
    if (validDate(y, mo, d)) return `${y}-${pad2(mo)}-${pad2(d)}`;
  }
  return '';
}

const NAME_PARTICLES = new Set(['DE', 'DEL', 'DELA', 'DELOS', 'DELAS', 'LA', 'LAS', 'LOS', 'SAN', 'SANTA', 'STA', 'STO', 'SANTO', 'VON', 'VAN', 'DI', 'DA', 'MC']);
const NAME_SUFFIXES = new Set(['JR', 'SR', 'II', 'III', 'IV', 'V']);

const titleCase = (s) => s.toLowerCase().replace(/(^|[\s\-'’])([a-zñ])/g, (_, p, c) => p + c.toUpperCase());

/** "JUAN MIGUEL DELA CRUZ JR." → { firstName, middleName, lastName, extension }. */
export function splitName(text) {
  const empty = { firstName: '', middleName: '', lastName: '', extension: '' };
  if (!text) return empty;
  let raw = text.replace(/[^A-Za-zÑñÁÉÍÓÚáéíóú.,'\-\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!raw) return empty;
  const fix = (s) => (s === s.toUpperCase() ? titleCase(s) : s);

  // "DELA CRUZ, JUAN M."
  if (raw.includes(',')) {
    const [last, rest] = raw.split(',', 2).map(s => s.trim());
    const parts = splitName(rest || '');
    return { ...parts, lastName: fix(last), firstName: parts.firstName || '', middleName: [parts.middleName, parts.lastName].filter(Boolean).join(' ') };
  }

  const tokens = raw.split(' ');
  let extension = '';
  if (tokens.length > 1 && NAME_SUFFIXES.has(tokens[tokens.length - 1].toUpperCase().replace(/\./g, ''))) {
    extension = tokens.pop().replace(/\.?$/, '.').replace(/^(II|III|IV|V)\.$/i, (m) => m.slice(0, -1).toUpperCase());
  }
  // Glue particles to the next word: "DELA CRUZ" → one surname unit.
  const units = [];
  for (let i = 0; i < tokens.length; i++) {
    const up = tokens[i].toUpperCase().replace(/\./g, '');
    if (NAME_PARTICLES.has(up) && i < tokens.length - 1) {
      let unit = tokens[i];
      while (i < tokens.length - 1 && NAME_PARTICLES.has(tokens[i + 1].toUpperCase().replace(/\./g, '')) && i < tokens.length - 2) unit += ' ' + tokens[++i];
      units.push(unit + ' ' + tokens[++i]);
    } else {
      units.push(tokens[i]);
    }
  }
  let first = '', middle = '', last = '';
  if (units.length === 1) first = units[0];
  else if (units.length === 2) [first, last] = units;
  else { last = units.pop(); middle = units.pop(); first = units.join(' '); }
  return { firstName: fix(first), middleName: fix(middle), lastName: fix(last), extension: fix(extension) };
}


/* ------------------------------------------
   4. DOCUMENT TYPES + FIELD EXTRACTION
   Each field: label (RegExp tested on the
   upper-cased cell text), kind ('name' | 'date'
   | 'text'), and optionally:
     occurrence — use the Nth match (1-based)
     after      — only search below the row where
                  that other field's label was found
     skipRows   — …and skip this many rows after it
     target     — which archive-record field it fills
------------------------------------------ */

// "NAME" but not "MAIDEN NAME", "NAME IN PRINT", "NAME OF …"
const PLAIN_NAME = /(?<!MAIDEN\s{0,4})\bNAME\b(?!\s*IN\s*PRINT)(?!\s+OF\b)/;

export const DOC_TYPES = {
  birth: {
    label: 'Birth Certificate (PSA)',
    archiveAs: 'baptism',
    fields: [
      // PSA Form 102: the typed value sits in the box under each printed label.
      { key: 'childName', label: 'Name of Child', kind: 'name', match: PLAIN_NAME, below: true, target: 'fullName' },
      { key: 'birthDate', label: 'Date of Birth', kind: 'date', match: /DATE\s+OF\s+BIRTH/, below: true, target: 'dateOfEvent' },
      { key: 'birthPlace', label: 'Place of Birth', kind: 'text', match: /PLACE\s+OF\b(?!\s+MARRIAGE)/, below: true, ignore: /^BIRTH$/ },
      { key: 'motherName', label: "Mother's Maiden Name", kind: 'name', match: /\bMA[I1L]?[DO]EN\b/, below: true },
      { key: 'fatherName', label: "Father's Name", kind: 'name', match: PLAIN_NAME, after: 'motherName', skipRows: 1, below: true },
      { key: 'parentsMarriage', label: 'Date & Place of Parents’ Marriage', kind: 'text', match: /PLACE\s+OF\s+MARRIAGE|MARRIAGE\s+OF\s+PAR/, below: true },
      { key: 'registryNo', label: 'Registry No.', kind: 'text', match: /REGISTRY\s+NO/ },
    ],
  },
  baptism: {
    label: 'Baptismal Certificate',
    archiveAs: 'baptism',
    fields: [
      { key: 'name', label: 'Name of Baptized', kind: 'name', match: /CERTIFY\s+THAT|\bNAME\b(?!\s+OF)/, target: 'fullName' },
      { key: 'parents', label: 'Parents', kind: 'text', match: /CHILD\s+OF|\bPARENTS\b/ },
      { key: 'fatherName', label: "Father's Name", kind: 'name', match: /\bFATHER\b/ },
      { key: 'motherName', label: "Mother's Name", kind: 'name', match: /\bMOTHER\b/ },
      { key: 'birthDate', label: 'Date of Birth', kind: 'date', match: /\bBORN\s+ON\b|DATE\s+OF\s+BIRTH/ },
      { key: 'birthPlace', label: 'Place of Birth', kind: 'text', match: /\bBORN\s+(?:ON\s+.*?\s)?(?:AT|IN)\b|PLACE\s+OF\s+BIRTH/ },
      { key: 'baptismDate', label: 'Date of Baptism', kind: 'date', match: /BAPTI[ZS]ED\s+ON|DATE\s+OF\s+BAPTISM/, target: 'dateOfEvent' },
      { key: 'sponsors', label: 'Sponsors / Godparents', kind: 'text', match: /\bSPONSORS?\b|GODPARENTS?|PADRINOS?/ },
      { key: 'minister', label: 'Officiating Minister', kind: 'text', match: /\bMINISTER\b|OFFICIATING|\bBY\s+(?:THE\s+)?REV|\bREV\.?\s|\bBY\s+FR\b/, target: 'officiant' },
      { key: 'bookPageLine', label: 'Book / Page / Line', kind: 'row', match: /\bBOOK\b|\bLIBRO\b/ },
    ],
  },
  confirmation: {
    label: 'Confirmation Certificate',
    archiveAs: 'confirmation',
    fields: [
      { key: 'name', label: 'Name of Confirmed', kind: 'name', match: /CERTIFY\s+THAT|\bNAME\b(?!\s+OF)/, target: 'fullName' },
      { key: 'parents', label: 'Parents', kind: 'text', match: /CHILD\s+OF|\bPARENTS\b/ },
      { key: 'confirmationDate', label: 'Date of Confirmation', kind: 'date', match: /CONFIRMED\s+ON|DATE\s+OF\s+CONFIRMATION/, target: 'dateOfEvent' },
      { key: 'place', label: 'Place', kind: 'text', match: /\bAT\s+THE\b|PLACE\s+OF\s+CONFIRMATION|\bCHURCH\s+OF\b/ },
      { key: 'sponsor', label: 'Sponsor', kind: 'text', match: /\bSPONSORS?\b|PADRINO|MADRINA/ },
      { key: 'minister', label: 'Minister / Bishop', kind: 'text', match: /\bBISHOP\b|MOST\s+REV|\bMINISTER\b|OFFICIATING/, target: 'officiant' },
      { key: 'bookPageLine', label: 'Book / Page / Line', kind: 'row', match: /\bBOOK\b|\bLIBRO\b/ },
    ],
  },
  marriage: {
    label: 'Marriage Certificate',
    archiveAs: 'marriage',
    fields: [
      { key: 'husbandName', label: 'Husband / Groom', kind: 'name', match: /\bHUSBAND\b|\bGROOM\b/, target: 'fullName' },
      { key: 'wifeName', label: 'Wife / Bride', kind: 'name', match: /\bWIFE\b|\bBRIDE\b/, target: 'fullName' },
      { key: 'marriageDate', label: 'Date of Marriage', kind: 'date', match: /DATE\s+OF\s+MARRIAGE|MARRIED\s+ON/, target: 'dateOfEvent' },
      { key: 'marriagePlace', label: 'Place of Marriage', kind: 'text', match: /PLACE\s+OF\s+MARRIAGE/ },
      { key: 'officiant', label: 'Solemnizing Officer', kind: 'text', match: /SOLEMNIZING\s+OFFICER|OFFICIATING|\bBY\s+(?:THE\s+)?REV/, target: 'officiant' },
      { key: 'witnesses', label: 'Witnesses', kind: 'text', match: /\bWITNESS(?:ES)?\b/ },
      { key: 'registryNo', label: 'Registry No.', kind: 'text', match: /REGISTRY\s+NO/ },
    ],
  },
  death: {
    label: 'Death / Burial Record',
    archiveAs: 'death',
    fields: [
      { key: 'deceasedName', label: 'Name of Deceased', kind: 'name', match: /DECEASED|PLAIN_NAME_PLACEHOLDER/, target: 'fullName' },
      { key: 'sex', label: 'Sex', kind: 'text', match: /\bSEX\b/ },
      { key: 'age', label: 'Age', kind: 'text', match: /\bAGE\b/ },
      { key: 'deathDate', label: 'Date of Death', kind: 'date', match: /DATE\s+OF\s+DEATH|\bDIED\s+ON\b/, target: 'dateOfEvent' },
      { key: 'deathPlace', label: 'Place of Death', kind: 'text', match: /PLACE\s+OF\s+DEATH|\bDIED\s+(?:AT|IN)\b/ },
      { key: 'cause', label: 'Cause of Death', kind: 'text', match: /\bCAUSES?\s+OF\s+DEATH|IMMEDIATE\s+CAUSE/ },
      { key: 'burialDate', label: 'Date of Burial', kind: 'date', match: /DATE\s+OF\s+BURIAL|\bBURIED\s+ON\b/ },
      { key: 'burialPlace', label: 'Place of Burial / Cemetery', kind: 'text', match: /PLACE\s+OF\s+BURIAL|CEMETERY/ },
      { key: 'officiant', label: 'Officiating Minister', kind: 'text', match: /OFFICIATING|\bBY\s+(?:THE\s+)?REV|\bMINISTER\b/, target: 'officiant' },
    ],
  },
  other: {
    label: 'Other Document',
    archiveAs: '',
    fields: [],
  },
};
// Death: "NAME" alone also counts as the deceased's name label.
DOC_TYPES.death.fields[0].match = new RegExp(`DECEASED|${PLAIN_NAME.source}`);

// Other printed labels common on civil-registry and parish forms. They
// aren't extracted, but a value search stops when it reaches one, so it
// never reads the next box's label as this box's value.
const STOP_LABELS = [
  /CITIZENSHIP/, /RELIGION/, /OCCUPATION/, /RESIDENCE/, /\bSEX\b/, /TYPE\s+OF\s+BIRTH/, /BIRTH\s+ORDER/,
  /WEIGHT/, /ATTENDANT/, /INFORMANT/, /PREPARED\s+BY/, /RECEIVED\s+AT/, /REMARKS/, /ANNOTATION/,
  /SIGNATURE/, /CERTIFICATION/, /CIVIL\s+STATUS/, /NATIONALITY/, /\bADDRESS\b/,
];

// Words printed on forms as hints under/next to blanks — never part of a value.
// (NAM/NAMF/NARNE: common OCR misreads of the printed "NAME".)
const HINT_WORD = /^\(?(?:FIRST|MIDDLE|LAST|GIVEN|SURNAME|MAIDEN|NAME|NAM|NAMF|NARNE|DAY|MONTH|YEAR|MO|YR)\)?[.,:;]?$/i;

const normalize = (s) => s.toUpperCase().replace(/[^A-Z0-9ÑÁÉÍÓÚ.]/g, ' ');
const letters = (s) => (s.match(/[A-Za-zÑñÁÉÍÓÚáéíóú]/g) || []).length;
const meaningful = (t) => (t.match(/[A-Za-z0-9ÑñÁÉÍÓÚáéíóú]/g) || []).length >= 2;

/**
 * Drops printed instructions from a run of words: anything in (parentheses)
 * — including a parenthetical that started on the row above, so the row
 * begins mid-hint ("House No., Street, Barangay)") — plus hint words like
 * (First)/(Middle)/(Last) and the field's own label words.
 */
function cleanWords(words, field) {
  const out = [];
  const firstOpen = words.findIndex(w => w.text.includes('('));
  const firstClose = words.findIndex(w => w.text.includes(')'));
  let skipUntil = firstClose >= 0 && (firstOpen < 0 || firstClose < firstOpen) ? firstClose : -1;
  let depth = 0;
  words.forEach((w, i) => {
    if (i <= skipUntil) return;
    const t = w.text;
    if (t.includes('(')) { depth = t.includes(')') ? 0 : 1; return; }
    if (depth) { if (t.includes(')')) depth = 0; return; }
    if (t.includes(')')) return;
    if (HINT_WORD.test(t) || isDebris(t)) return;
    if (field && field.ignore && field.ignore.test(t.toUpperCase())) return;
    out.push(w);
  });
  // "the sponsors being Pedro Cruz…" → drop connecting words before the value
  if (field && field.kind === 'text') while (out.length > 1 && LEADING_FILLER.test(out[0].text)) out.shift();
  return out;
}

const LEADING_FILLER = /^(?:BEING|ARE|IS|WAS|WERE|THE|WHO|WHICH|:|-)$/i;

const joinWords = (words) =>
  words.map(w => w.text).join(' ').replace(/^[\s:;.,\-–—|_]+|[\s:;,\-–—|_]+$/g, '').replace(/\s+/g, ' ').trim();

/** Is this text a plausible value for the field's kind? */
function plausible(kind, text) {
  if (!meaningful(text)) return false;
  if (kind === 'date') return !!parseDate(text) || /\d/.test(text);
  if (kind === 'name') return letters(text) >= 3 && letters(text) / text.replace(/\s/g, '').length > 0.7 && !/[:\d]/.test(text);
  return true;
}

function labelHit(text, allLabels) {
  const n = normalize(text);
  return allLabels.some(re => re.test(n));
}

// Levenshtein distance, for matching OCR-mangled hints like "(Migdie)" → MIDDLE.
function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return dp[a.length][b.length];
}

/**
 * x-centres of the "(First) (Middle) (Last)" hints printed on or just below
 * the label row, tolerating OCR typos. Missing columns are inferred from
 * the spacing of the ones that were found.
 */
function findHintColumns(rows, ri, xL, xR) {
  const found = [];
  for (let r = ri; r <= Math.min(rows.length - 1, ri + 1); r++) {
    for (const w of rows[r].words) {
      const cx = (w.x0 + w.x1) / 2;
      if (cx < xL || cx >= xR || !/[()]/.test(w.text)) continue;
      found.push({ cx, t: w.text.toUpperCase().replace(/[^A-Z]/g, '') });
    }
  }
  if (!found.length) return null;
  found.sort((a, b) => a.cx - b.cx);
  const cols = {};
  for (const f of found) {
    let best = null, bestD = 3;
    for (const k of ['FIRST', 'MIDDLE', 'LAST']) {
      const d = editDistance(f.t, k);
      if (d < bestD || (d === bestD && best === null && f.t[0] === k[0])) { bestD = d; best = k; }
    }
    if (best && cols[best] === undefined) cols[best] = f.cx;
  }
  // Three hints but not all recognised → they're First/Middle/Last in order.
  if (Object.keys(cols).length < 3 && found.length === 3) {
    cols.FIRST = found[0].cx; cols.MIDDLE = found[1].cx; cols.LAST = found[2].cx;
  }
  const { FIRST: f, MIDDLE: m, LAST: l } = cols;
  if (f === undefined && m !== undefined && l !== undefined) cols.FIRST = m - (l - m);
  if (l === undefined && f !== undefined && m !== undefined) cols.LAST = m + (m - f);
  if (m === undefined && f !== undefined && l !== undefined) cols.MIDDLE = (f + l) / 2;
  return Object.keys(cols).length >= 3 ? cols : null;
}

function nameFromColumns(words, cols) {
  const parts = { FIRST: [], MIDDLE: [], LAST: [] };
  const keys = Object.keys(cols);
  for (const w of words) {
    const cx = (w.x0 + w.x1) / 2;
    let best = keys[0];
    for (const k of keys) if (Math.abs(cols[k] - cx) < Math.abs(cols[best] - cx)) best = k;
    parts[best].push(w);
  }
  const fix = (arr) => { const s = joinWords(arr); return s === s.toUpperCase() ? titleCase(s) : s; };
  const n = { firstName: fix(parts.FIRST), middleName: fix(parts.MIDDLE), lastName: fix(parts.LAST), extension: '' };
  const filled = [n.firstName, n.middleName, n.lastName].filter(Boolean).length;
  return filled >= 2 ? n : splitName(joinWords(words));
}

/** Joins words that sit in different cells of a row with ", " ("Arimbay, Legazpi City, Albay"). */
function textBySegments(row, words) {
  const set = new Set(words);
  return row.segments
    .map(s => joinWords(s.words.filter(w => set.has(w))))
    .filter(Boolean)
    .reduce((acc, t) => (acc ? (acc.endsWith(',') ? `${acc} ${t}` : `${acc}, ${t}`) : t), '');
}

/**
 * Reads each field's value for the chosen document type.
 * Returns { [key]: { value, text, conf, words } } — value is a string
 * ('YYYY-MM-DD' for dates when parseable), or a { firstName, middleName,
 * lastName, extension } object for names.
 *
 * For each label it tries, in order:
 *   a) the rest of the same cell ("Province: Albay")
 *   b) the next cell on the same row ("Registry No. | 99-2030")
 *   c) the rows just below, inside the label's column (PSA-style boxes,
 *      where the typed value sits under the printed label)
 * Fields marked `below` skip (a) and (b); so does any label whose row
 * carries (First)/(Middle)/(Last)-style hints, since those forms always
 * put the value underneath.
 */
export function extractFields(rows, docTypeKey) {
  const spec = DOC_TYPES[docTypeKey];
  const result = {};
  if (!spec || !rows.length) return result;
  const allLabels = [...spec.fields.map(f => f.match), ...STOP_LABELS];
  const labelRow = {};
  const pageW = Math.max(...rows.flatMap(r => r.words.map(w => w.x1)));

  for (const field of spec.fields) {
    let startRow = 0;
    if (field.after) {
      if (labelRow[field.after] === undefined) continue; // anchor not found → can't place this one safely
      startRow = labelRow[field.after] + 1 + (field.skipRows || 0);
    }

    // 1. find the label (Nth occurrence)
    let hit = null, seen = 0;
    outer:
    for (let ri = startRow; ri < rows.length; ri++) {
      const segs = rows[ri].segments;
      for (let si = 0; si < segs.length; si++) {
        const re = new RegExp(field.match.source, 'g');
        const n = normalize(segs[si].text);
        let m;
        while ((m = re.exec(n))) {
          if (!m[0].length) { re.lastIndex++; continue; }
          if (++seen === (field.occurrence || 1)) { hit = { ri, si, end: m.index + m[0].length }; break outer; }
        }
      }
    }
    if (!hit) continue;
    labelRow[field.key] = hit.ri;

    const row = rows[hit.ri];
    const seg = row.segments[hit.si];

    // words of the label cell that come after the label text
    const restWords = [];
    let pos = 0;
    for (const w of seg.words) {
      const start = seg.text.indexOf(w.text, pos);
      pos = start + w.text.length;
      if (start >= hit.end) restWords.push(w);
    }
    const laterSegs = row.segments.slice(hit.si + 1);
    const rowHasHints = restWords.some(w => /[()]/.test(w.text)) ||
      (laterSegs[0] && /[()]/.test(laterSegs[0].text));
    const inlineAllowed = !field.below && !rowHasHints;

    let valueWords = [];
    let valueText = '';

    // 'row' fields keep the whole line from the label on ("Book No. 12, Page 45, Line 7")
    if (field.kind === 'row') {
      const words = row.segments.slice(hit.si).flatMap(sg => sg.words);
      const t = textBySegments(row, words);
      if (meaningful(t)) { valueWords = words; valueText = t; }
    }

    // a) same cell, up to the next label
    if (!valueWords.length && inlineAllowed) {
      let words = restWords;
      const cut = words.findIndex(w => allLabels.some(re => re !== field.match && re.test(normalize(w.text))));
      if (cut >= 0) words = words.slice(0, cut);
      words = cleanWords(words, field);
      if (plausible(field.kind, joinWords(words))) { valueWords = words; valueText = joinWords(words); }
    }

    // b) the next meaningful cell on the same row, if it's close by
    if (!valueWords.length && inlineAllowed) {
      let prevX1 = seg.x1;
      for (const s of laterSegs) {
        if (s.x0 - prevX1 > pageW * 0.45) break;
        if (labelHit(s.text, allLabels)) break;
        const words = cleanWords(s.words, field);
        const t = joinWords(words);
        if (!meaningful(t)) { prevX1 = s.x1; continue; }
        if (plausible(field.kind, t)) { valueWords = words; valueText = t; }
        break;
      }
    }

    // c) rows below, within the label's column
    let hintCols = null;
    let stackedValue = null;
    if (!valueWords.length) {
      // the column ends where the next real cell (or another label) starts on the label row
      const nextCell = laterSegs.find(s => labelHit(s.text, allLabels) || meaningful(joinWords(cleanWords(s.words, field))));
      const xL = seg.x0 - (seg.x1 - seg.x0) * 0.15;
      const xR = nextCell ? nextCell.x0 : Infinity;
      hintCols = field.kind === 'name' ? findHintColumns(rows, hit.ri, xL, xR) : null;
      // Collect every plausible row in the box, then keep the clearest one
      // (a smudge read at 12% shouldn't beat a clean name one row lower).
      const candidates = [];
      for (let ri = hit.ri + 1; ri <= Math.min(rows.length - 1, hit.ri + 3); ri++) {
        const r = rows[ri];
        // A typed line that starts inside the column counts in full, even if
        // it runs past the column edge (long places, addresses).
        const inCol = r.segments.flatMap(sg =>
          sg.x0 >= xL && sg.x0 < xR ? sg.words : sg.words.filter(w => { const cx = (w.x0 + w.x1) / 2; return cx >= xL && cx < xR; }));
        if (!inCol.length) continue;
        // another label in this column → we've walked into the next box
        // (hint words such as the "NAME" printed under "MAIDEN" don't count)
        if (labelHit(joinWords(inCol.filter(w => !HINT_WORD.test(w.text))), allLabels)) break;
        let words = cleanWords(inCol, field);
        // only printed hints here → keep looking
        if (!words.length) continue;
        // names laid out one part per row: "(First) JUAN / (Middle) PEREZ / (Last) DELA CRUZ"
        if (field.kind === 'name' && !hintCols && inCol.some(w => /^\(?(?:FIRST|GIVEN)\)?/i.test(w.text))) {
          const stacked = stackedName(rows, ri, xL, xR, field);
          if (stacked) { valueWords = stacked.words; valueText = stacked.text; stackedValue = stacked.name; break; }
        }
        if (field.kind === 'date') words = words.filter(w => /\d|,/.test(w.text) || MONTH_WORD.test(w.text.toUpperCase().replace(/[^A-Z]/g, '')));
        const t = field.kind === 'text' ? textBySegments(r, words) : joinWords(words);
        if (!plausible(field.kind, t)) continue;
        const conf = words.reduce((a, w) => a + w.conf, 0) / words.length;
        candidates.push({ words, t, score: conf - 8 * candidates.length });
        if (conf >= 70) break; // clear enough — no need to look further down
      }
      if (!valueWords.length && candidates.length) {
        const best = candidates.reduce((a, b) => (b.score > a.score ? b : a));
        valueWords = best.words; valueText = best.t;
      }
    }

    if (!valueWords.length || !valueText) continue;
    const conf = Math.round(valueWords.reduce((a, w) => a + w.conf, 0) / valueWords.length);
    let value = valueText;
    if (field.kind === 'date') value = parseDate(valueText) || valueText;
    if (field.kind === 'name') value = stackedValue || (hintCols ? nameFromColumns(valueWords, hintCols) : splitName(valueText));
    result[field.key] = { value, text: valueText, conf, words: valueWords };
  }
  return result;
}

/** Reads a name printed one part per row, each row led by its (First)/(Middle)/(Last) hint. */
function stackedName(rows, ri, xL, xR, field) {
  const name = { firstName: '', middleName: '', lastName: '', extension: '' };
  const keyFor = { FIRST: 'firstName', GIVEN: 'firstName', MIDDLE: 'middleName', LAST: 'lastName', SURNAME: 'lastName' };
  const words = [];
  for (let r = ri; r <= Math.min(rows.length - 1, ri + 2); r++) {
    const inCol = rows[r].words.filter(w => { const cx = (w.x0 + w.x1) / 2; return cx >= xL && cx < xR; });
    const hint = inCol.map(w => w.text.toUpperCase().replace(/[^A-Z]/g, '')).find(t => keyFor[t]);
    if (!hint) break;
    const part = cleanWords(inCol, field);
    const t = joinWords(part);
    if (t) name[keyFor[hint]] = t === t.toUpperCase() ? titleCase(t) : t;
    words.push(...part);
  }
  if (!name.firstName && !name.lastName) return null;
  return { name, words, text: [name.firstName, name.middleName, name.lastName].filter(Boolean).join(' ') };
}
