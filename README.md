# Php Scanner (work in progress)

Php Scanner is the app of the thesis *A Performance Comparison of Lightweight Object Detection Models for Degraded Philippine Banknote Recognition on Android Smartphones* (Alvarez and Veloso, BSCS, University of San Carlos). It says the value of a Philippine banknote aloud for visually impaired users, and it works offline.

This repository holds the work-in-progress build. Version 0.1 runs in a web browser on a PC. The Android app (Kotlin, CameraX, LiteRT, Android text-to-speech) comes in CS Thesis 2 and will go in `android/`.

## Run it on your PC

1. Use Chrome or Edge. Install Python 3 from python.org if `python --version` does not work in a terminal.
2. Once, after cloning: run `python tools/fetch_models.py`. It downloads the EfficientDet-Lite0 model from Google, which this repository cannot include (see "Licenses and credits"). YOLOv8n is already included.
3. Double-click `start.bat`, or run `python serve.py` in this folder.
4. The app opens at http://127.0.0.1:8080. Keep the black window open. Close it to stop the app.

Do not open `web/index.html` directly as a file. The browser blocks the camera and the model loader on a page that does not come from a server.

## What is real in v0.1

| Part | Status |
|---|---|
| Screens W1, W2, W2b, W3 and S1 to S5, with the spoken lines of SRS Table 15 | Done. Same look as the SRS prototype of 2026-10-04 |
| Speech | Real. The app uses the text-to-speech voice of the browser |
| Camera | Real. The webcam of the PC, or the back camera of a phone |
| Detection | Real. A LiteRT (`.tflite`) model runs on the device with LiteRT.js, on the GPU (WebGPU) or the CPU (WebAssembly) |
| Banknote model | Not yet. Two stand-in models trained on everyday objects (COCO): YOLOv8n and EfficientDet-Lite0 |
| Announcement rules | FR-05 to FR-16 and FR-23: threshold, highest score only, no repeat while the same item stays in view, guidance after 5 seconds, tap to repeat, yellow box |
| Live numbers | Inference time, frame-to-result time (median of the last 30 frames) and frames per second |
| Drawn banknotes | The simulated mode of the SRS prototype, for the full banknote experience |
| Vibration, flashlight | Only on a phone browser that supports them. On a PC the phone frame shows a yellow outline for each vibration |
| Android permission question (W2b) | A drawing of it |

## Demo in two minutes

1. Start the app. Press "Play first launch" and go through W1, W2 and the permission question.
2. Under "In front of the camera", pick ₱500. The phone says "Five hundred pesos." and draws the yellow box. This is the planned experience.
3. Pick "This device's camera and a real model" and allow the camera. Turn off "Ignore people" or hold a cup, a bottle or a phone in front of the webcam. The app says what it sees and draws the box.
4. Show the readout. The model runs on this PC in a few milliseconds, and no frame leaves the device. Change "Runs on" to the CPU, or the model to EfficientDet-Lite0, and the numbers change. The study measures the same numbers on the two test phones.
5. Say clearly that the model is a stand-in. The banknote model needs the team's own photos.

Measured on the development PC (Ryzen 7 5700X3D, RTX 3060, Chrome, 320 × 320 input, 2026-10-07):

| Model | GPU (WebGPU) inference | CPU (WebAssembly) inference |
|---|---|---|
| YOLOv8n, float32, 12.2 MB | about 6 ms | about 69 ms |
| EfficientDet-Lite0, int8, 4.4 MB | about 20 ms | about 58 ms |

These are browser numbers on a desktop PC. They are not phone results and do not go in the thesis.

## Add a trained model

1. Train and export in Google Colab (Linux). The LiteRT export of Ultralytics 8.4 runs only on Linux x86 and macOS, not on Windows:
   `yolo export model=best.pt format=litert imgsz=320`
   That export offers FP32, INT8 (`quantize=8`), `w8a16` and `w8a32`. It does not offer FP16.
2. Copy the `.tflite` file to `web/models/`. Next to it, write a label file with one class name per line, in the class order of the model.
3. Add an entry to `web/models/models.json`. Copy the YOLOv8n entry and change `id`, `name`, `trainedOn`, `file`, `labels`, `sizeMB` and `source`. `web/models/README.md` explains each field.
4. Put the value in each class name: `20`, `500_polymer` and `P1000` all work. The app reads the number and says "Twenty pesos", "Five hundred pesos" or "One thousand pesos". A class name without a value is spoken as written.
5. Run the check (next section).

## Check that it still works

Once: `cd tools` then `npm install`, and `python tools/fetch_models.py` if you have not run it yet. After each change, from the repository root: `node tools/check.mjs`. It starts the server, runs the app in headless Chrome with a fake camera, and checks the models, the camera mode, the drawn-banknote mode and the figure pages. "All checks passed" and exit code 0 mean success.

## Figures for the SRS appendix

Open http://127.0.0.1:8080/#fig7 (or `#fig8`, `#fig9`) and reload the page. These pages draw Figures 7 to 9 of the SRS appendix.

## Project layout

```
start.bat, serve.py   run the app on this PC (local server on 127.0.0.1)
web/                  the app: plain HTML, CSS and JavaScript, no framework, no build step
  index.html          demo bench: the phone screen on the left, the controls on the right
  js/app.js           screens, speech and announcement rules (SRS Tables 13 to 15)
  js/detector.js      LiteRT.js loader, pre-processing and decoders (YOLOv8, EfficientDet, SSD)
  js/camera.js        camera access
  models/             .tflite models, label files, models.json
  vendor/litertjs/    LiteRT.js 2.5.3
  fonts/              Atkinson Hyperlegible
tools/check.mjs       smoke test
android/              the Android app (CS Thesis 2, not started)
```

## Roadmap

- v0.2: a pilot banknote model (YOLOv8n) trained in Colab, for internal tests of the pipeline only. Read the thesis note on public datasets and BSP Circular No. 829 first.
- v0.3: open the build on the two test phones. A phone needs an HTTPS address for the camera, for example GitHub Pages, and an offline cache.
- CS Thesis 2: the Android app in `android/`, with the same screens, labels and announcement rules.

## Privacy

Each camera frame stays in the browser. The app draws it, runs the model on it, and drops it (SRS NFR-09). The app sends nothing to a server and has no analytics.

## Licenses and credits

- App code: GNU Affero General Public License v3.0 (`LICENSE`). The repository includes YOLOv8n weights, which Ultralytics licenses under AGPL-3.0, so the app uses the same license.
- LiteRT.js 2.5.3, Google, Apache License 2.0 (`web/vendor/litertjs/LICENSE-Apache-2.0.txt`).
- Atkinson Hyperlegible, Braille Institute of America, SIL Open Font License 1.1 (`web/fonts/OFL.txt`).
- YOLOv8n weights (`web/models/yolov8n_320_float32.tflite`), Ultralytics, AGPL-3.0, exported from `yolov8n.pt` as described in `web/models/README.md`.
- EfficientDet-Lite0, Google MediaPipe model zoo. Google's model page states no license for the model file (checked 2026-10-07), so this repository does not include it. `tools/fetch_models.py` downloads it from Google and checks its SHA-256.
- `tools/test_image.jpg`: portrait of Grace Hopper, a U.S. Navy photograph (public domain), from the TensorFlow example images.
