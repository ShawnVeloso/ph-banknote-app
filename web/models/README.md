# Models

The app loads the models listed in `models.json`. Each model is a LiteRT (`.tflite`) file in this folder.

`efficientdet_lite0_int8.tflite` is not in the repository, because Google states no license for it. Run `python tools/fetch_models.py` from the repository root once to download it. The script reads the `download` block of each entry in `models.json`.

## Files

| File | What it is | Source | License |
|---|---|---|---|
| `yolov8n_320_float32.tflite` | YOLOv8n trained on COCO (80 classes), 320 × 320 input, float32, 12.2 MB. Input layout [1, 3, 320, 320]; output [1, 84, 2100] | Ultralytics `yolov8n.pt`, exported with Ultralytics 8.4.174 on Linux (WSL Ubuntu 24.04): `yolo export model=yolov8n.pt format=litert imgsz=320`, 2026-10-07 | AGPL-3.0 (Ultralytics) |
| `coco80_labels.txt` | The 80 COCO class names of YOLOv8n, in model order | `YOLO('yolov8n.pt').names` | |
| `efficientdet_lite0_int8.tflite` | EfficientDet-Lite0 trained on COCO, 320 × 320 uint8 input, 4.4 MB. Outputs raw box offsets [1, 19206, 4] and scores [1, 19206, 90] | https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/int8/1/efficientdet_lite0.tflite, 2026-10-07 | No license stated on Google's model page (checked 2026-10-07). Not in this repository: `tools/fetch_models.py` downloads it |
| `coco90_labels.txt` | The 90-slot COCO label map of EfficientDet-Lite0 ("???" marks unused slots) | The `labels.txt` packed inside the model file | |

Both COCO models are stand-ins. Neither knows banknotes.

## Fields of a models.json entry

| Field | Meaning |
|---|---|
| `id` | Unique name, used in the settings |
| `name`, `trainedOn` | Shown in the model list, for example "YOLOv8-Nano (YOLOv8n)" and "COCO stand-in, not banknotes" |
| `file`, `labels` | The model file and its label file (one class per line, or a JSON list or object) |
| `decoder` | How to read the outputs: `yolov8` (Ultralytics export), `efficientdet` (raw anchor outputs, needs `anchors`), or `ssd_postprocessed` (models with the TFLite_Detection_PostProcess operator, such as a MobileNetV2-SSD from the TensorFlow Object Detection API; not tested yet) |
| `anchors` | `efficientdet` only: levels, scales, aspect ratios and anchor scale. EfficientDet-Lite0 uses anchor scale 3 |
| `normalize` | Input range of a float model: `0..1` (YOLOv8) or `-1..1`. A uint8 model takes 0 to 255 |
| `pad` | Gray level of the letterbox bars (114 for YOLOv8) |
| `iou` | Overlap above which non-maximum suppression drops the weaker box of the same class |
| `labelOffset` | First class index that counts (use 1 when class 0 is "background") |
| `sizeMB`, `source`, `note` | Shown in the readout or kept for the record |
| `download` | Optional, for a model that is not in the repository: `url`, `sha256` and `license`. `tools/fetch_models.py` downloads the file and checks the hash |

The app reads the input size, data type and layout (channels first or channels last) from the model file itself.
