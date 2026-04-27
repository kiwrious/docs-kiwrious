# Kiwrious SDK — AI/LLM documentation index

This directory is structured for AI agents and LLM ingestion. The canonical markdown lives in [`../content/`](../content/) — these files are not copies but pointers, plus a single-file consolidation for one-shot context loading.

## How to ingest

**Single shot (small context):** read [`AI-CONTEXT.md`](AI-CONTEXT.md) — every section concatenated into one file, ~30 KB.

**Selective (larger context):** read individual files from [`../content/`](../content/) using the table below.

## Topic map

| Topic | File | Use when |
|---|---|---|
| **Overview** | [`../content/home.md`](../content/home.md) | First contact with the SDK |
| **Installation** | [`../content/installation.md`](../content/installation.md) | Setting up a new project |
| **Quickstart** | [`../content/quickstart.md`](../content/quickstart.md) | Need a working example fast |
| **USB connection** | [`../content/protocol/usb-connection.md`](../content/protocol/usb-connection.md) | Vendor IDs, baud rate, port lifecycle |
| **Frame format** | [`../content/protocol/frame-format.md`](../content/protocol/frame-format.md) | 26-byte protocol layout, byte offsets |
| **Sensor type IDs** | [`../content/protocol/sensor-types.md`](../content/protocol/sensor-types.md) | Type byte → decoder mapping |
| **Firmware versions** | [`../content/protocol/firmware-versions.md`](../content/protocol/firmware-versions.md) | LATEST_SENSOR_VERSION map, outdated detection |
| **SerialService API** | [`../content/api/serial-service.md`](../content/api/serial-service.md) | Methods, lifecycle, singleton pattern |
| **Callbacks** | [`../content/api/callbacks.md`](../content/api/callbacks.md) | onSerialData, onSerialConnection, onFirmwareUpdateAvailable |
| **Data interfaces** | [`../content/api/interfaces.md`](../content/api/interfaces.md) | SensorReadResult, SensorDecodedValue shapes |
| **Status enums** | [`../content/api/enums.md`](../content/api/enums.md) | SENSOR_TYPE, VOC_RESULT_STATUS, HEART_RATE_RESULT_STATUS, CONDUCTIVITY_RESULT_STATUS |
| **UV sensor** | [`../content/sensors/uv.md`](../content/sensors/uv.md) | Lux + UV index (float32 LE) |
| **Humidity sensor** | [`../content/sensors/humidity.md`](../content/sensors/humidity.md) | Temp °C + RH %, int16 ÷ 100 |
| **Temperature sensor** | [`../content/sensors/temperature.md`](../content/sensors/temperature.md) | v1 simple, v2 quadratic calibration |
| **Conductivity sensor** | [`../content/sensors/conductivity.md`](../content/sensors/conductivity.md) | µS/cm via 1/(d0·d1)·10⁶ |
| **VOC sensor** | [`../content/sensors/voc.md`](../content/sensors/voc.md) | 20-second client-side warm-up |
| **Heart rate** | [`../content/sensors/heart-rate.md`](../content/sensors/heart-rate.md) | v1 DSP, v2 ARM emulator |
| **DSP pipeline** | [`../content/advanced/dsp-pipeline.md`](../content/advanced/dsp-pipeline.md) | Biquad cascade + FFT (heart rate v1) |
| **ARM emulator** | [`../content/advanced/heart-rate-emulation.md`](../content/advanced/heart-rate-emulation.md) | Unicorn-on-WASM memory map (heart rate v2) |
| **Disconnect / resume** | [`../content/advanced/disconnect-resume.md`](../content/advanced/disconnect-resume.md) | Port retention, USB unplug |
| **Discrepancies** | [`../content/advanced/discrepancies.md`](../content/advanced/discrepancies.md) | Cross-project bugs and divergence |
| **Vue example** | [`../content/examples/vue.md`](../content/examples/vue.md) | Vue 2 / 3 integration pattern |
| **Scratch example** | [`../content/examples/scratch.md`](../content/examples/scratch.md) | Block-based programming UI |
| **Recording** | [`../content/examples/recording.md`](../content/examples/recording.md) | CSV export, sample-rate control |

## Quick facts (cheat sheet)

| | |
|---|---|
| Vendor IDs | `0x04d8` (Microchip), `0x0d28` (ARM mbed PID `0x0204`) |
| Baud rate | **230400** |
| Frame size | 26 bytes (little-endian) |
| Type byte | offset `2` |
| Payload | offsets `6`–`21` (16 bytes) |
| Sequence | offsets `22`–`23` |
| Footer | offsets `24`–`25` |
| Sensor types | `1=UV`, `2=TEMPERATURE`, `4=CONDUCTIVITY`, `5=HEART_RATE`, `6=VOC`, `7=HUMIDITY`, `9=TEMPERATURE2`, `10=HEART_RATE2`, `11=UV2` |
| Heart rate v1 | 200 Hz sample rate, 2048-sample FFT, range 300K–900K |
| Heart rate v2 | 10 frames × 16 bytes, ARM Thumb at `0x0800c|1`, output at `0x3F0000` |
| VOC warm-up | 20 seconds (client-side simulated, 5%/s) |
| Conductivity formula | `(1 / (d0 × d1)) × 10⁶` µS/cm |
| Temperature v2 IR | `(a · X² / 100,000) + (b · X) + c` |

## Critical context

- **The SDK is a singleton.** `import serialService from 'kiwrious-webserial'` always returns the same instance.
- **Callbacks are property assignments**, not `addEventListener` style.
- **The port reference is intentionally retained** after disconnect to enable `resumeReading()` without re-prompting.
- **`onSerialConnection(true)` fires after the first frame is decoded**, not when `port.open()` succeeds.
- **VOC warm-up is purely cosmetic** — the firmware does not signal ready; the SDK runs a 20s timer.
- **Heart rate v2 requires ~1 MB of runtime assets** loaded only when the v2 sensor is plugged in.
- **Web Serial requires a secure context** — HTTPS or `localhost`.

## Discrepancies (one-line summary)

| # | Where | Issue |
|---|---|---|
| 1 | scratch-gui | **115200 baud** instead of canonical **230400** |
| 2 | scratch-gui | Microchip filter PID-restricted to `0xec19` |
| 3 | scratch-gui | Exposes `CO2eq` from bytes 8–9 (SDK ignores) |
| 4 | scratch-gui | `_isConducatanceIncreasing` typo + duplicate assignment |
| 5 | scratch-gui | Expired Origin Trial token (cosmetic) |
| 6 | scratch-gui | No heart rate support |
| 7 | new SDK | Duplicate `HEART_RATE2` case in factory |
| 8 | all | `port.open({ baudrate, baudRate })` both spellings |
| 9 | Vue app | Pins `kiwrious-webserial@1.0.20`, library at `1.0.21` |
| 10 | UV / Temp v2 | Decoders return strings (`.toFixed`) |
| 11 | Vue app | Conductivity status overlay for chart UX |
| 12 | all | VOC warm-up is client-side simulated |

Full citations and recommended actions in [`../DISCREPANCIES.md`](../DISCREPANCIES.md) and [`../content/advanced/discrepancies.md`](../content/advanced/discrepancies.md).

## File organisation

```
ai-docs/
├── README.md               ← This file (entry point)
└── AI-CONTEXT.md           ← Single-file consolidation of all docs
    (canonical content lives in ../content/*.md)
```
