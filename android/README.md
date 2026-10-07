# Android app (CS Thesis 2, not started)

The Android version of Php Scanner goes here. The plan in the thesis (Section 4.8 and the SRS appendix):

- Kotlin in Android Studio, Android 9 (API level 28) or later (NFR-11).
- CameraX `ImageAnalysis` with the default strategy `STRATEGY_KEEP_ONLY_LATEST`, so a slow phone drops frames instead of queuing them.
- The selected model in LiteRT format (NFR-12), the same `.tflite` file that the web build loads.
- Android `TextToSpeech` with an offline voice, and no INTERNET permission (NFR-10).
- The screens, spoken lines and announcement rules of SRS Tables 13 to 15, as in `../web/js/app.js`.

Before starting, install the official Google Android skills for AI assistants in this repository: `npx skills add android/skills@camerax`, `@r8-analyzer`, `@android-profiler`, `@edge-to-edge`, `@android-permissions-security`.
