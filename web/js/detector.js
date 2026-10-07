/* On-device detection with LiteRT.js (LiteRT for the web).
   Loads a .tflite model listed in models/models.json, runs it on the GPU (WebGPU) or the CPU (WebAssembly),
   and returns detections in coordinates relative to the region of the frame that was passed in.
   Nothing leaves the browser: frames are read from a canvas and dropped after each run (SRS NFR-09). */

import { loadLiteRt, loadAndCompile, Tensor, isWebGPUSupported } from '../vendor/litertjs/litert-core.js';

const MODELS_URL = new URL('../models/', import.meta.url);
const WASM_URL = new URL('../vendor/litertjs/wasm/', import.meta.url);
let runtime = null;

export function gpuAvailable() {
  try { return isWebGPUSupported(); } catch (e) { return false; }
}

function initRuntime() {
  if (!runtime) runtime = loadLiteRt(WASM_URL.href);
  return runtime;
}

export async function loadRegistry() {
  const r = await fetch(new URL('models.json', MODELS_URL));
  if (!r.ok) throw new Error('models/models.json not found');
  return (await r.json()).models;
}

async function loadLabels(file) {
  const r = await fetch(new URL(file, MODELS_URL));
  if (!r.ok) throw new Error('Label file not found: ' + file);
  const text = await r.text();
  if (file.endsWith('.json')) {
    const j = JSON.parse(text);
    return Array.isArray(j) ? j : Object.keys(j).sort((a, b) => a - b).map((k) => j[k]);
  }
  return text.replace(/\r/g, '').replace(/\n+$/, '').split('\n').map((s) => s.trim());
}

/* EfficientDet and RetinaNet-style anchors: levels minLevel..maxLevel, `scales` octave scales and
   the given aspect ratios per location. Returns [yCenter, xCenter, height, width] in input pixels. */
function makeAnchors(size, a) {
  const out = [];
  const feats = [];
  let f = size;
  for (let l = 1; l <= a.maxLevel; l++) { f = Math.ceil(f / 2); if (l >= a.minLevel) feats.push(f); }
  for (const fs of feats) {
    const stride = size / fs;
    for (let yi = 0; yi < fs; yi++) {
      for (let xi = 0; xi < fs; xi++) {
        const cy = stride / 2 + yi * stride, cx = stride / 2 + xi * stride;
        for (let s = 0; s < a.scales; s++) {
          for (const ar of a.aspects) {
            const base = a.anchorScale * stride * Math.pow(2, s / a.scales);
            const ax = Math.sqrt(ar);
            out.push(cy, cx, base / ax, base * ax);
          }
        }
      }
    }
  }
  return new Float32Array(out);
}

function iou(a, b) {
  const ix = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
  const iy = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const inter = ix * iy;
  const union = (a.x1 - a.x0) * (a.y1 - a.y0) + (b.x1 - b.x0) * (b.y1 - b.y0) - inter;
  return union > 0 ? inter / union : 0;
}

/* Greedy non-maximum suppression per class. Boxes are in input pixels. */
function nms(cands, iouMax, keepMax) {
  cands.sort((p, q) => q.score - p.score);
  const keep = [];
  for (const c of cands) {
    if (keep.every((k) => k.cls !== c.cls || iou(k, c) < iouMax)) keep.push(c);
    if (keep.length >= keepMax) break;
  }
  return keep;
}

/* Decoders. Each returns candidate boxes {cls, score, x0, y0, x1, y1} in input pixels (W x H). */
const DECODERS = {
  /* Ultralytics YOLOv8 export: one output [1, 4 + classes, N] (or [1, N, 4 + classes]),
     with box centre, width and height, then one sigmoid score per class. No objectness score. */
  yolov8(outs, ctx) {
    const o = outs[0];
    const [, d1, d2] = o.shape;
    const chFirst = d1 < d2;
    const n = chFirst ? d2 : d1, ch = chFirst ? d1 : d2, nc = ch - 4;
    const at = chFirst ? (i, c) => o.data[c * n + i] : (i, c) => o.data[i * ch + c];
    let maxCoord = 0;
    for (let i = 0; i < Math.min(n, 64); i++) maxCoord = Math.max(maxCoord, at(i, 2), at(i, 3));
    const sx = maxCoord <= 2 ? ctx.W : 1, sy = maxCoord <= 2 ? ctx.H : 1; /* normalised or pixel boxes */
    const cands = [];
    for (let i = 0; i < n; i++) {
      let best = 0, cls = -1;
      for (let c = 0; c < nc; c++) { const v = at(i, 4 + c); if (v > best) { best = v; cls = c; } }
      if (best < ctx.minScore) continue;
      const cx = at(i, 0) * sx, cy = at(i, 1) * sy, w = at(i, 2) * sx, h = at(i, 3) * sy;
      cands.push({ cls, score: best, x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 });
    }
    return cands;
  },

  /* EfficientDet-Lite (MediaPipe model zoo): box offsets [1, A, 4] (ty, tx, th, tw) and
     sigmoid scores [1, A, classes] for A anchors, decoded with the anchors in the model entry. */
  efficientdet(outs, ctx) {
    const boxes = outs.find((t) => t.shape[t.shape.length - 1] === 4);
    const scores = outs.find((t) => t !== boxes);
    const A = ctx.anchors, na = A.length / 4;
    const nc = scores.data.length / na;
    const off = ctx.spec.labelOffset || 0;
    const cands = [];
    for (let i = 0; i < na; i++) {
      let best = 0, cls = -1;
      const base = i * nc;
      for (let c = off; c < nc; c++) { const v = scores.data[base + c]; if (v > best) { best = v; cls = c; } }
      if (best < ctx.minScore) continue;
      const ty = boxes.data[i * 4], tx = boxes.data[i * 4 + 1], th = boxes.data[i * 4 + 2], tw = boxes.data[i * 4 + 3];
      const ya = A[i * 4], xa = A[i * 4 + 1], ha = A[i * 4 + 2], wa = A[i * 4 + 3];
      const yc = ty * ha + ya, xc = tx * wa + xa, h = Math.exp(th) * ha, w = Math.exp(tw) * wa;
      cands.push({ cls, score: best, x0: xc - w / 2, y0: yc - h / 2, x1: xc + w / 2, y1: yc + h / 2 });
    }
    return cands;
  },

  /* Models exported with the TFLite_Detection_PostProcess operator (TensorFlow Object Detection API,
     for example MobileNetV2-SSD): boxes [1, N, 4] as (ymin, xmin, ymax, xmax) in 0..1, classes [1, N],
     scores [1, N], count [1]. Not tested yet: no such model is in this repository. */
  ssd_postprocessed(outs, ctx) {
    const boxes = outs.find((t) => t.shape.length === 3 && t.shape[2] === 4);
    const rest = outs.filter((t) => t !== boxes);
    const count = rest.find((t) => t.data.length === 1);
    const pair = rest.filter((t) => t !== count);
    const classes = pair.find((t) => t.data.every((v) => Number.isInteger(v))) || pair[0];
    const scores = pair.find((t) => t !== classes);
    const n = count ? Math.round(count.data[0]) : scores.data.length;
    const cands = [];
    for (let i = 0; i < n; i++) {
      const s = scores.data[i];
      if (s < ctx.minScore) continue;
      cands.push({
        cls: Math.round(classes.data[i]) + (ctx.spec.labelOffset || 0), score: s,
        y0: boxes.data[i * 4] * ctx.H, x0: boxes.data[i * 4 + 1] * ctx.W, y1: boxes.data[i * 4 + 2] * ctx.H, x1: boxes.data[i * 4 + 3] * ctx.W
      });
    }
    return cands;
  }
};

/**
 * Loads one model entry of models.json on 'webgpu' or 'wasm'.
 * detect(source, sx, sy, sw, sh) letterboxes that region of the source (a video or image) into the
 * model input, runs the model, and returns { dets, ms } where each detection has label, score and a
 * box (x0, y0, x1, y1) in 0..1 relative to the region.
 */
export async function createDetector(spec, accelerator) {
  if (!DECODERS[spec.decoder]) throw new Error('Unknown decoder "' + spec.decoder + '" in models.json');
  await initRuntime();
  const labels = await loadLabels(spec.labels);
  const t0 = performance.now();
  const model = await loadAndCompile(new URL(spec.file, MODELS_URL).href, { accelerator });
  const loadMs = performance.now() - t0;
  const inp = model.getInputDetails()[0];
  const shape = Array.from(inp.shape);
  /* TensorFlow exports take [1, H, W, 3] (channels last). Ultralytics LiteRT exports keep the
     PyTorch layout [1, 3, H, W] (channels first). */
  const chFirst = shape[1] === 3 && shape[3] !== 3;
  const H = chFirst ? shape[2] : shape[1], W = chFirst ? shape[3] : shape[2];
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(W, H) : Object.assign(document.createElement('canvas'), { width: W, height: H });
  const g = canvas.getContext('2d', { willReadFrequently: true });
  const isU8 = inp.dtype === 'uint8';
  const buf = isU8 ? new Uint8Array(W * H * 3) : new Float32Array(W * H * 3);
  const norm = spec.normalize || (spec.decoder === 'yolov8' ? '0..1' : '-1..1');
  const pad = 'rgb(' + (spec.pad != null ? spec.pad : 114) + ',' + (spec.pad != null ? spec.pad : 114) + ',' + (spec.pad != null ? spec.pad : 114) + ')';
  const ctx = { spec, W, H, minScore: 0.25, anchors: spec.decoder === 'efficientdet' ? makeAnchors(W, spec.anchors) : null };

  return {
    spec, accelerator, labels, loadMs,
    input: { width: W, height: H, dtype: inp.dtype, layout: chFirst ? 'channels first' : 'channels last' },
    fullyAccelerated: model.isFullyAccelerated,

    async detect(source, sx, sy, sw, sh, minScore) {
      const tStart = performance.now();
      ctx.minScore = minScore != null ? minScore : 0.25;
      const scale = Math.min(W / sw, H / sh);
      const dw = sw * scale, dh = sh * scale, ox = (W - dw) / 2, oy = (H - dh) / 2;
      g.fillStyle = pad;
      g.fillRect(0, 0, W, H);
      g.drawImage(source, sx, sy, sw, sh, ox, oy, dw, dh);
      const px = g.getImageData(0, 0, W, H).data;
      const n = W * H;
      const k = isU8 ? 1 : norm === '0..1' ? 1 / 255 : 1 / 127.5;
      const b0 = isU8 || norm === '0..1' ? 0 : -1;
      /* Red of pixel i is at i * step; green and blue follow at gOff and bOff */
      const gOff = chFirst ? n : 1, bOff = chFirst ? 2 * n : 2, step = chFirst ? 1 : 3;
      for (let i = 0, j = 0; i < n; i++, j += 4) {
        const at = i * step;
        buf[at] = px[j] * k + b0;
        buf[at + gOff] = px[j + 1] * k + b0;
        buf[at + bOff] = px[j + 2] * k + b0;
      }
      let input = new Tensor(buf, chFirst ? [1, 3, H, W] : [1, H, W, 3]);
      if (accelerator === 'webgpu') input = await input.moveTo('webgpu');
      const tRun = performance.now();
      const results = await model.run(input);
      const outs = [];
      for (const r of results) {
        const host = await r.moveTo('wasm');
        outs.push({ shape: Array.from(host.type.layout.dimensions), data: host.toTypedArray().slice() });
        host.delete();
      }
      input.delete();
      const tDecode = performance.now();
      const kept = nms(DECODERS[spec.decoder](outs, ctx), spec.iou || 0.5, 10);
      const dets = kept.map((d) => ({
        cls: d.cls, label: labels[d.cls] != null ? labels[d.cls] : 'class ' + d.cls, score: d.score,
        x0: (d.x0 - ox) / dw, y0: (d.y0 - oy) / dh, x1: (d.x1 - ox) / dw, y1: (d.y1 - oy) / dh
      }));
      const tEnd = performance.now();
      return { dets, ms: { prepare: tRun - tStart, inference: tDecode - tRun, decode: tEnd - tDecode, total: tEnd - tStart } };
    },

    dispose() { try { model.delete(); } catch (e) { /* already gone */ } }
  };
}
