# Changelog

## Unreleased

- License: GNU AGPL-3.0 (`LICENSE`), the license of the bundled YOLOv8n weights.
- EfficientDet-Lite0 is no longer in the repository, because Google states no license for it. `tools/fetch_models.py` downloads it from Google and checks its SHA-256; the app and `tools/check.mjs` say so when it is missing.

## 0.1.0 (2026-10-07)

First work-in-progress build, made from the clickable SRS prototype of 2026-10-04 (thesis workspace, `_AI_CONTEXT/prototype/app_prototype.html`).

- Split the single prototype file into `index.html`, CSS, JavaScript modules and font files. The screens, the spoken lines and the figure pages `#fig7` to `#fig9` did not change.
- New camera source: the webcam of the PC or the back camera of a phone, with a real LiteRT model that runs in the browser through LiteRT.js 2.5.3 (WebGPU or WebAssembly).
- Two COCO stand-in models: YOLOv8n (320 px, float32) and EfficientDet-Lite0 (int8). `web/models/models.json` lists them; a trained banknote model is added the same way.
- One announcement loop for the drawn and the real source (FR-05 to FR-16, FR-23). An item must win two frames in a row before the app announces it.
- Live readout: model, input, runs on, inference time, frame-to-result time, frames per second and the top detections.
- Each camera frame is detected at most once; when the model is slower than the camera, the app takes the newest frame.
- `start.bat` and `serve.py` run the app on 127.0.0.1. App icons and a web manifest.
- Smoke test `tools/check.mjs` (headless Chrome, fake camera).
