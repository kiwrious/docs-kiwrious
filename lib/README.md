# Kiwrious SDK runtime assets

These files are runtime dependencies copied verbatim from the Kiwrious SDK source. They are required **only** if your application supports the **heart rate v2** sensor — all other sensors decode purely in JavaScript.

| File | Purpose | Required for |
|---|---|---|
| `prog.bin` | Compiled ARM Thumb firmware (heart-rate detection algorithm) | Heart rate v2 |
| `libunicorn_out.wasm` | Unicorn ARM emulator, compiled to WebAssembly | Heart rate v2 |
| `libunicorn_out.js` | Emscripten-generated JS glue for the WASM module | Heart rate v2 |
| `unicorn-wrapper.js` | High-level emulator API (register/memory access) | Heart rate v2 |
| `unicorn-constants.js` | ARM register, mode, and flag constants | Heart rate v2 |
| `libelf-integers.js` | Integer helpers for ELF/binary parsing | Heart rate v2 |
| `heartrate.js` | `HeartRateDetector` class that orchestrates the emulator | Heart rate v2 |

## Hosting

Place these alongside your built SDK file:

```
your-site/
├── kiwrious-webserial.esm.js
└── js/
    ├── heartrate.js
    ├── libelf-integers.js
    ├── libunicorn_out.js
    ├── libunicorn_out.wasm
    ├── prog.bin
    ├── unicorn-constants.js
    └── unicorn-wrapper.js
```

`heartrate.js` calls `fetch('js/prog.bin')` at runtime, so the path is fixed unless you rebuild the SDK.

## Provenance

- **`prog.bin`** — copied from `kiwrious-webserial-library/public/prog.bin` (the legacy library is the canonical source).
- **All other files** — copied from `kiwrious-web-serial-sdk/src/lib/`.

## Size

| | Size |
|---|---|
| `libunicorn_out.wasm` | 770 KB |
| `prog.bin` | 196 KB |
| `libunicorn_out.js` | 76 KB |
| `unicorn-constants.js` | 63 KB |
| `unicorn-wrapper.js` | 22 KB |
| `libelf-integers.js` | 5.8 KB |
| `heartrate.js` | 2 KB |
| **Total** | **~1.1 MB** |

This payload is only loaded when a v2 heart rate sensor is plugged in.
