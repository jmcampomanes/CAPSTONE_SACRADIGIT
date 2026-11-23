/* ============================================
   PP-OCR (PaddleOCR's text reader) in plain JavaScript.

   Runs the official PaddlePaddle ONNX models
   (PP-OCRv6 small: detection ~9 MB + recognition ~20 MB, Apache-2.0)
   with onnxruntime-web (browser, GPU via WebGPU or CPU via WASM)
   or onnxruntime-node (tests). No DOM, no canvas: the caller hands in
   RGBA pixels, so the exact same code runs in both places.

     const ocr = createPPOCR({ ort, detSession, recSession, dict });
     const { lines, text, ms } = await ocr.run({ data, width, height });

   lines: [{ text, conf (0-100), x0, y0, x1, y1 }]  in the input image's pixels.
   `text` is in reading order, cells on one row separated by " | ".
   ============================================ */

export const DEFAULTS = {
  detLongSide: 960,    // the page is scaled so its long side is about this before detection (1280/1600 = slower, for tiny print)
  detThresh: 0.3,      // pixel counts as text above this probability
  boxThresh: 0.6,      // a text region needs this average probability
  unclip: 1.5,         // how far a detected region is grown to cover whole letters
  minBox: 3,           // ignore regions thinner than this (in detection pixels)
  recHeight: 48,
  recBatch: 8,
  recMaxWidth: 3200,
};

const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

/* ---------- image helpers (RGBA in, BGR planes out, like PaddleOCR) ---------- */

/** Bilinear sample of the source region [sx0,sx1)×[sy0,sy1) resized to dw×dh, into CHW BGR floats. */
function resizeToCHW(img, sx0, sy0, sx1, sy1, dw, dh, out, outOffset, planeStride, rowStride, norm) {
  const { data, width: W, height: H } = img;
  const kx = (sx1 - sx0) / dw, ky = (sy1 - sy0) / dh;
  for (let y = 0; y < dh; y++) {
    let fy = sy0 + (y + 0.5) * ky - 0.5;
    fy = fy < 0 ? 0 : fy > H - 1 ? H - 1 : fy;
    const y0 = Math.floor(fy), y1 = Math.min(H - 1, y0 + 1), wy = fy - y0;
    for (let x = 0; x < dw; x++) {
      let fx = sx0 + (x + 0.5) * kx - 0.5;
      fx = fx < 0 ? 0 : fx > W - 1 ? W - 1 : fx;
      const x0 = Math.floor(fx), x1 = Math.min(W - 1, x0 + 1), wx = fx - x0;
      const i00 = (y0 * W + x0) * 4, i01 = (y0 * W + x1) * 4, i10 = (y1 * W + x0) * 4, i11 = (y1 * W + x1) * 4;
      const o = outOffset + y * rowStride + x;
      for (let c = 0; c < 3; c++) {
        const ch = 2 - c; // RGBA → BGR
        const v = (data[i00 + ch] * (1 - wx) + data[i01 + ch] * wx) * (1 - wy) + (data[i10 + ch] * (1 - wx) + data[i11 + ch] * wx) * wy;
        out[o + c * planeStride] = norm(v / 255, c);
      }
    }
  }
}

/* ---------- 1. Detection ---------- */

function detectionInput(img, longSide) {
  const { width: w, height: h } = img;
  const s = longSide / Math.max(w, h);
  const nw = Math.max(32, Math.round((w * s) / 32) * 32);
  const nh = Math.max(32, Math.round((h * s) / 32) * 32);
  const plane = nw * nh;
  const chw = new Float32Array(3 * plane);
  resizeToCHW(img, 0, 0, w, h, nw, nh, chw, 0, plane, nw, (v, c) => (v - MEAN[c]) / STD[c]);
  return { chw, nw, nh, sx: nw / w, sy: nh / h };
}

/** Probability map → text boxes (connected regions, grown a little, mapped back to image pixels). */
function detectionBoxes(prob, nw, nh, sx, sy, w, h, o) {
  const label = new Int32Array(nw * nh); // 0 = unvisited/background
  const stack = new Int32Array(nw * nh);
  const boxes = [];
  let next = 0;
  for (let start = 0; start < nw * nh; start++) {
    if (prob[start] <= o.detThresh || label[start]) continue;
    next++;
    let sp = 0; stack[sp++] = start; label[start] = next;
    let minX = nw, maxX = 0, minY = nh, maxY = 0, count = 0, sum = 0;
    while (sp) {
      const p = stack[--sp];
      const y = (p / nw) | 0, x = p - y * nw;
      count++; sum += prob[p];
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy; if (yy < 0 || yy >= nh) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx; if (xx < 0 || xx >= nw) continue;
          const q = yy * nw + xx;
          if (!label[q] && prob[q] > o.detThresh) { label[q] = next; stack[sp++] = q; }
        }
      }
    }
    const bw = maxX - minX + 1, bh = maxY - minY + 1;
    if (Math.min(bw, bh) < o.minBox || sum / count < o.boxThresh) continue;
    const d = (bw * bh * o.unclip) / (2 * (bw + bh));
    boxes.push({
      x0: Math.max(0, (minX - d) / sx), y0: Math.max(0, (minY - d) / sy),
      x1: Math.min(w, (maxX + 1 + d) / sx), y1: Math.min(h, (maxY + 1 + d) / sy),
    });
  }
  return boxes;
}

/* ---------- 2. Recognition ---------- */

function recognitionBatch(img, boxes, idx, o) {
  const H = o.recHeight;
  const widths = idx.map((i) => {
    const b = boxes[i];
    return Math.min(o.recMaxWidth, Math.max(16, Math.ceil((H * (b.x1 - b.x0)) / Math.max(1, b.y1 - b.y0))));
  });
  const W = Math.max(...widths, 48);
  const plane = H * W;
  const chw = new Float32Array(idx.length * 3 * plane); // zeros = padding
  idx.forEach((i, k) => {
    const b = boxes[i];
    resizeToCHW(img, b.x0, b.y0, b.x1, b.y1, widths[k], H, chw, k * 3 * plane, plane, W, (v) => (v - 0.5) / 0.5);
  });
  return { chw, n: idx.length, W };
}

function ctcDecode(logits, n, T, C, chars) {
  const res = [];
  for (let k = 0; k < n; k++) {
    let text = '', sumConf = 0, kept = 0, prev = 0;
    for (let t = 0; t < T; t++) {
      const base = (k * T + t) * C;
      let best = 0, bv = logits[base];
      for (let c = 1; c < C; c++) { const v = logits[base + c]; if (v > bv) { bv = v; best = c; } }
      if (best !== 0 && best !== prev && best < chars.length) { text += chars[best]; sumConf += bv; kept++; }
      prev = best;
    }
    res.push({ text, conf: kept ? sumConf / kept : 0 });
  }
  return res;
}

/* ---------- 3. Reading order ---------- */

export function linesToText(lines) {
  const items = lines.filter((l) => l.text.trim());
  if (!items.length) return '';
  const hs = items.map((l) => l.y1 - l.y0).sort((a, b) => a - b);
  const med = hs[hs.length >> 1] || 10;
  const cy = (l) => (l.y0 + l.y1) / 2;
  const rows = [];
  for (const l of [...items].sort((a, b) => cy(a) - cy(b))) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(cy(l) - last.reduce((a, x) => a + cy(x), 0) / last.length) < med * 0.6) last.push(l);
    else rows.push([l]);
  }
  return rows.map((r) => r.sort((a, b) => a.x0 - b.x0).map((l) => l.text).join(' | ')).join('\n');
}

/* ---------- public ---------- */

export function createPPOCR({ ort, detSession, recSession, dict, options = {} }) {
  const o = { ...DEFAULTS, ...options };
  const chars = ['blank', ...dict, ' '];
  const detIn = detSession.inputNames[0], detOut = detSession.outputNames[0];
  const recIn = recSession.inputNames[0], recOut = recSession.outputNames[0];

  return {
    /** img: { data (RGBA), width, height }. onProgress(stage, 0..1) is optional. */
    async run(img, onProgress = () => {}) {
      const ms = {};
      let t = performance.now();
      onProgress('detect', 0);
      const { chw, nw, nh, sx, sy } = detectionInput(img, o.detLongSide);
      const detRes = await detSession.run({ [detIn]: new ort.Tensor('float32', chw, [1, 3, nh, nw]) });
      const prob = detRes[detOut].data;
      const boxes = detectionBoxes(prob, nw, nh, sx, sy, img.width, img.height, o);
      ms.detect = Math.round(performance.now() - t);

      t = performance.now();
      const order = boxes.map((_, i) => i).sort((a, b) =>
        (boxes[a].x1 - boxes[a].x0) / (boxes[a].y1 - boxes[a].y0) - (boxes[b].x1 - boxes[b].x0) / (boxes[b].y1 - boxes[b].y0));
      const lines = [];
      for (let s = 0; s < order.length; s += o.recBatch) {
        onProgress('read', s / Math.max(1, order.length));
        const idx = order.slice(s, s + o.recBatch);
        const { chw: x, n, W } = recognitionBatch(img, boxes, idx, o);
        const out = await recSession.run({ [recIn]: new ort.Tensor('float32', x, [n, 3, o.recHeight, W]) });
        const r = out[recOut];
        const [, T, C] = r.dims;
        const dec = ctcDecode(r.data, n, T, C, chars);
        idx.forEach((bi, k) => {
          if (dec[k].text.trim()) lines.push({ text: dec[k].text, conf: Math.round(dec[k].conf * 100), ...boxes[bi] });
        });
      }
      ms.read = Math.round(performance.now() - t);
      onProgress('read', 1);
      return { lines, text: linesToText(lines), boxes: boxes.length, ms };
    },
  };
}
