# Kiwrious SDK — Consolidated Reference (AI Context)

This file concatenates every documentation page into one document for one-shot LLM context loading. The canonical, navigable site lives in `index.html` (sidebar-driven SPA); this file mirrors all of `content/*.md` for ingestion.

Section anchors below match each page's H1.

---


<!-- ===== from: content/home.md ===== -->

<div class="hero">
  <h1 class="hero__title">Kiwrious SDK</h1>
  <p class="hero__lead">Connect to Kiwrious USB sensors directly from the browser using the Web Serial API. Decode 26-byte sensor frames into typed readings — UV, climate, temperature, conductivity, air quality, heart rate.</p>
  <div class="hero__pills">
    <span class="pill">v2.0.0</span>
    <span class="pill">ESM</span>
    <span class="pill">Web Serial</span>
    <span class="pill">TypeScript</span>
  </div>
</div>

## Quick start

```html
<script type="module">
  import serialService from './kiwrious-webserial.esm.js';

  serialService.onSerialData = (reading) => {
    console.log(reading.sensorType, reading.decodedValues);
  };

  serialService.onSerialConnection = (connected) => {
    console.log(connected ? 'connected' : 'disconnected');
  };

  document.querySelector('#connect').addEventListener('click', () => {
    serialService.connectAndReadAsync();
  });
</script>
```

## Where to start

<div class="card-grid-marker"></div>

- [Installation](installation.md) — Add the SDK to a vanilla, Vue, React, or static project
- [Quickstart](quickstart.md) — Connect, read, disconnect — under five minutes
- [Frame format](protocol/frame-format.md) — The 26-byte little-endian protocol
- [SerialService API](api/serial-service.md) — Methods, callbacks, and lifecycle
- [Sensors overview](sensors/uv.md) — Per-sensor decoding, units, quirks
- [Cross-project discrepancies](advanced/discrepancies.md) — Known inconsistencies between consumers

## What the SDK does

The Kiwrious SDK is a thin layer on top of `navigator.serial` that:

- Filters USB devices by Kiwrious vendor IDs (`0x04d8` Microchip and `0x0d28` ARM mbed)
- Opens the serial port at 230400 baud
- Reads fixed-size 26-byte frames into a buffered stream
- Detects the connected sensor type from byte 2 of the first frame
- Selects the correct decoder via a factory pattern
- Streams decoded readings to a callback you provide
- Detects firmware version mismatches and surfaces an update flag

> {info}
> The SDK is browser-only — it relies on `navigator.serial`, which requires Chrome, Edge, or Opera over HTTPS (or `localhost`).

## Sensor families

| Sensor | Type IDs | Outputs |
|---|---|---|
| UV / Light | 1, 11 | Lux, UV index |
| Climate | 7 | Temperature (°C), Humidity (%RH) |
| Temperature (IR) | 2, 9 | Ambient °C, IR/Surface °C |
| Conductivity | 4 | µS/cm |
| Air Quality (VOC) | 6 | VOC raw + warm-up status |
| Heart Rate | 5, 10 | BPM (+ trust, SNR for v2) |

See [sensors/](sensors/uv.md) for per-sensor data formats and quirks.

## SDK architecture

```
┌──────────────────────────────────────────────────────────────┐
│                       SerialService                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │   Connect   │→ │ SerialReader │→ │ SerialDecoder      │  │
│  │ (Web Serial)│  │ (26-byte     │  │ Factory + per-     │  │
│  │             │  │  frames)     │  │ sensor decoders    │  │
│  └─────────────┘  └──────────────┘  └────────────────────┘  │
│         │                                       │            │
│         ▼                                       ▼            │
│   onSerialConnection                       onSerialData      │
└──────────────────────────────────────────────────────────────┘
```

---


<!-- ===== from: content/installation.md ===== -->

# Installation

The Kiwrious SDK ships as an **ES module** with no required runtime dependencies. Browser-only — it requires `navigator.serial`.

## Browser support

Web Serial is supported on:

- Chrome 89+
- Edge 89+
- Opera 75+

Firefox and Safari do not currently support Web Serial. The site must be served over HTTPS or from `localhost`.

## Install via CDN

Drop the bundled ESM build into any HTML page:

```html
<script type="module">
  import serialService from 'https://your-cdn/kiwrious-webserial.esm.js';
  // ...
</script>
```

If your sensor stack includes the **heart rate v2** sensor, you also need to host the ARM emulator assets next to your page so they can be loaded at runtime:

```
your-site/
├─ index.html
└─ js/
   ├─ libunicorn_out.js
   ├─ libunicorn_out.wasm
   ├─ unicorn-wrapper.js
   ├─ unicorn-constants.js
   ├─ libelf-integers.js
   ├─ heartrate.js
   └─ prog.bin              ← ARM Thumb firmware blob (heart rate v2 algorithm)
```

These are bundled in the SDK's `dist/js/` directory after running `npm run build`.

> {info}
> Heart rate v2 only — the other six sensor types do **not** require the emulator runtime.

## Install from a local copy

```bash
# 1. Get the SDK source
git clone <kiwrious-web-serial-sdk repo>
cd kiwrious-web-serial-sdk

# 2. Build it
npm install
npm run build

# 3. Copy dist/ into your project
cp dist/kiwrious-webserial.esm.js /path/to/your/site/
cp -r dist/js /path/to/your/site/
```

The `dist/` output contains:

| File | Purpose |
|---|---|
| `kiwrious-webserial.esm.js` | Development build (~48 KB, source maps) |
| `kiwrious-webserial.esm.min.js` | Production build (~23 KB, minified) |
| `js/libunicorn_out.{js,wasm}` | Unicorn ARM emulator (heart rate v2) |
| `js/heartrate.js` | Emulator orchestrator |
| `js/prog.bin` | ARM Thumb firmware (heart rate algorithm) |

## Use with Vue 2 / 3

```ts
// src/services/sensor.ts
import serialService from 'kiwrious-webserial/lib/service/SerialService';
import type { SensorReadResult } from 'kiwrious-webserial/lib/data/SensorReadResult';

serialService.onSerialData = (data: SensorReadResult) => {
  // dispatch to a Vuex/Pinia store
};

export default serialService;
```

> {info}
> The legacy `kiwrious-webserial` (v1.x) ships as CommonJS — import paths target `lib/` rather than ESM. The new SDK (v2.x) ships as ESM and exposes `default` from `index.ts`.

## Use with React

```tsx
// src/hooks/useKiwrious.ts
import { useEffect, useState } from 'react';
import serialService from 'kiwrious-webserial';

export function useKiwrious() {
  const [reading, setReading] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    serialService.onSerialData = setReading;
    serialService.onSerialConnection = setConnected;
    return () => {
      serialService.onSerialData = undefined;
      serialService.onSerialConnection = undefined;
    };
  }, []);

  return { reading, connected, connect: () => serialService.connectAndReadAsync() };
}
```

## TypeScript

Type definitions are emitted to `dist/index.d.ts`. Public types include:

- `SensorReadResult`
- `SensorDecodedValue`
- `SENSOR_TYPE` (string enum)
- `VOC_RESULT_STATUS`, `HEART_RATE_RESULT_STATUS`, `CONDUCTIVITY_RESULT_STATUS`

See [api/interfaces](api/interfaces.md) for the full data model.

---


<!-- ===== from: content/quickstart.md ===== -->

# Quickstart

Connect to a Kiwrious sensor, read live data, and disconnect — under five minutes.

## 1. Bare-bones HTML

Save this as `index.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Kiwrious quickstart</title>
</head>
<body>
  <button id="connect">Connect sensor</button>
  <button id="disconnect">Disconnect</button>
  <pre id="output">Waiting for sensor…</pre>

  <script type="module">
    import serialService from './kiwrious-webserial.esm.js';

    const out = document.getElementById('output');

    serialService.onSerialConnection = (connected) => {
      out.textContent = connected ? 'Connected. Reading…' : 'Disconnected.';
    };

    serialService.onSerialData = (reading) => {
      out.textContent = JSON.stringify(reading, null, 2);
    };

    document.getElementById('connect').onclick = () => {
      serialService.connectAndReadAsync();
    };
    document.getElementById('disconnect').onclick = () => {
      serialService.disconnectAsync();
    };
  </script>
</body>
</html>
```

## 2. Serve over HTTPS or localhost

Web Serial requires a secure context. Use any static server:

```bash
npx http-server . -p 8080
# or
python3 -m http.server 8080
```

Open `http://localhost:8080`.

## 3. Plug in a Kiwrious sensor and click Connect

The browser shows a port picker filtered by Kiwrious vendor IDs (`0x04d8`, `0x0d28`). Select your device.

You should see live decoded readings:

```json
{
  "sensorType": "HUMIDITY",
  "decodedValues": [
    { "type": "number", "label": "Temp", "value": 23.45 },
    { "type": "number", "label": "Hum",  "value": 41.20 }
  ]
}
```

## 4. Handle each sensor type

The `decodedValues` array shape depends on `sensorType`. The minimal switch:

```js
serialService.onSerialData = (reading) => {
  const v = reading.decodedValues;
  switch (reading.sensorType) {
    case 'UV':
    case 'UV2':
      console.log('Lux:', v[0].value, 'UV index:', v[1].value);
      break;
    case 'HUMIDITY':
      console.log('Temp:', v[0].value, 'Humidity:', v[1].value);
      break;
    case 'TEMPERATURE':
    case 'TEMPERATURE2':
      console.log('Ambient:', v[0].value, 'IR:', v[1].value);
      break;
    case 'CONDUCTIVITY':
      // v[0].value is { status: 'MIN' | 'READY' | 'MAX', value: number | 'MAX' }
      console.log('Conductivity:', v[0].value);
      break;
    case 'VOC':
      // v[0].value is { status, value, dataReadyPercentage }
      console.log('VOC:', v[0].value);
      break;
    case 'HEART_RATE':
    case 'HEART_RATE2':
      // v[0].value is { status, value, trustlevel?, snr? }
      console.log('Heart rate:', v[0].value);
      break;
  }
};
```

> {warn}
> The first 20 seconds of a VOC sensor reading is a warm-up period. `value` is **not** a valid ppb measurement until `status === 'READY'`. See [sensors/voc](sensors/voc.md).

## 5. Detect firmware updates

```js
serialService.onFirmwareUpdateAvailable = (outdated) => {
  if (outdated) {
    alert('Sensor firmware is out of date. Visit the firmware updater.');
  }
};
```

This fires once per connection, after the first frame is decoded.

## Next steps

- [Frame format](protocol/frame-format.md) — what a 26-byte frame actually contains
- [Sensors](sensors/uv.md) — per-sensor units, byte offsets, and decoder math
- [Disconnect & resume](advanced/disconnect-resume.md) — handling unplugs and reconnections

---


<!-- ===== from: content/protocol/usb-connection.md ===== -->

# USB connection

How the SDK opens a Kiwrious device using `navigator.serial`.

## Vendor ID filters

The SDK calls `navigator.serial.requestPort()` with two filters:

```ts
{
  filters: [
    { usbVendorId: 0x04d8, vendorId: 0x04d8 },          // Microchip Technology
    { usbVendorId: 0x0d28, usbProductId: 0x0204 }       // ARM mbed (CMSIS-DAP)
  ]
}
```

| Vendor ID | Manufacturer | Notes |
|---|---|---|
| `0x04d8` | Microchip Technology | Primary Kiwrious devices (PIC18F-class MCUs). All product IDs accepted. |
| `0x0d28` | ARM Holdings (mbed) | Cortex-M0 platform; only PID `0x0204` accepted. |

> {info}
> Both `usbVendorId` and the legacy `vendorId` keys are passed for the Microchip filter — historical browser API differences. Either is honoured by current Chromium.

## Port settings

After the user selects a port, the SDK opens it with:

```ts
await port.open({ baudrate: 230400, baudRate: 230400 });
```

| Parameter | Value | Notes |
|---|---|---|
| Baud rate | 230400 | Both spellings (`baudrate` / `baudRate`) are passed for cross-browser safety |
| Data bits | 8 | Web Serial default — not set explicitly |
| Stop bits | 1 | Web Serial default |
| Parity | none | Web Serial default |
| Flow control | none | Web Serial default |

> {warn}
> The Scratch GUI fork uses **115200 baud** with a different filter. That is not the canonical configuration — see [discrepancies](../advanced/discrepancies.md).

## Connection lifecycle

```
┌─ User clicks "Connect" ──────────────────────────────┐
│                                                      │
│  ① navigator.serial.requestPort(filters)             │
│      └─→ OS port-picker dialog                       │
│                                                      │
│  ② port.open({ baudRate: 230400 })                   │
│                                                      │
│  ③ port.readable.getReader()                         │
│                                                      │
│  ④ Read first 26-byte frame                          │
│      → Detect sensor type from byte 2                │
│      → Pick decoder via SerialDecoderFactory         │
│      → Compare firmware version vs. LATEST_*         │
│                                                      │
│  ⑤ onSerialConnection(true)                          │
│      onFirmwareUpdateAvailable(outdated?)            │
│                                                      │
│  ⑥ Loop: read → decode → onSerialData(...)           │
│                                                      │
└──────────────────────────────────────────────────────┘
```

## Reconnection

The SDK retains the `SerialPort` reference even after disconnect, so a previously-paired device can be resumed without re-prompting the user:

```ts
if (serialService.canResumeReading) {
  await serialService.resumeReading();   // Skip the port-picker
} else {
  await serialService.connectAndReadAsync();   // Show the picker
}
```

See [disconnect & resume](../advanced/disconnect-resume.md).

## OS-level events

The SDK installs `navigator.serial.onconnect` and `onserial.ondisconnect` handlers:

- `onconnect` — currently logged but no further action (manual reconnection required)
- `ondisconnect` — calls `disconnectAsync()` automatically and clears the internal `_port` reference

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| "Port is already readable" | A previous reader was not released. Call `disconnectAsync()` first. |
| Port picker shows no devices | Wrong USB VID/PID, missing driver on Windows, USB hub power issue, or sensor not powered. |
| `requestPort()` rejects | User cancelled the dialog. |
| `onSerialData` never fires | Sensor is producing fragmented packets — buffered internally, but check that bytes 0–1 are the expected header. |

## Source references

- `SerialService.connectAndReadAsync()` — open + read entry point
- `SerialService.startStage1RequestPortAsync()` — `navigator.serial.requestPort()`
- `SerialService.startStage2ConnectPortAsync()` — `port.open()` and reader setup
- `SerialService.startReading()` — read loop

---


<!-- ===== from: content/protocol/frame-format.md ===== -->

# 26-byte frame format

Every Kiwrious sensor — regardless of type — emits fixed-size **26-byte frames** over USB serial. All multi-byte values are **little-endian**.

## Frame layout

```
 byte  │  0   1   2   3   4   5   6   7   8   9  10  11  12  13  14  15  16  17  18  19  20  21  22  23  24  25
       ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤
 field │  HDR  │ T │ — reserved — │              sensor data (16 bytes)              │  SEQ  │  FTR  │
```

| Offset | Size | Field | Type | Description |
|---|---|---|---|---|
| 0 | 2 | Header | `uint16` LE | Frame start marker (e.g., `0x0a 0x0a`) |
| 2 | 1 | Sensor type | `uint8` | Identifier byte — see [sensor types](sensor-types.md) |
| 3 | 3 | Reserved | — | Padding / reserved |
| 6 | 16 | Sensor data | varies | Per-sensor payload — see each sensor's page |
| 22 | 2 | Sequence | `uint16` LE | Monotonic sequence number for sample ordering |
| 24 | 2 | Footer | `uint16` LE | Frame end marker |

> {info}
> The header and footer are not validated by the SDK's `SerialReader` — the buffer is sliced strictly by 26-byte boundaries. Validation occurs only by virtue of decoded values being sensible. Some consumer implementations (notably the Scratch GUI fork) do validate `0x0a 0x0a` / `0x0b 0x0b`.

## Reading bytes

The `SerialRawValue` class wraps a `Uint8Array` and exposes typed getters. All methods use little-endian byte order.

```ts
class SerialRawValue {
  // Single byte
  getByteByIndex(i: number): number;
  getHexDigitByIndex(i: number): string;          // 2-char zero-padded hex

  // 16-bit
  getTwoBytesByIndex(i: number): number;          // uint16 LE
  getTwoBytesUnsignedByIndex(i: number): number;  // uint16 LE (alias)
  getTwoBytesSignedByIndex(i: number): number;    // int16 LE

  // 32-bit
  getFourBytesByIndex(i: number): number;         // uint32 LE
  getFourBytesFloatByIndex(i: number): number;    // IEEE 754 float32 LE

  // Slice
  sliceBytes(start: number, len: number): Uint8Array;

  // Detected type
  get sensorType(): SENSOR_TYPE;
  get decoderType(): string;
  get isFirmwareOutdated(): boolean;
}
```

## Sensor data interpretations

The 16 payload bytes (offsets 6–21) are interpreted differently per sensor type.

| Sensor | 6-7 | 8-9 | 10-13 | 14-17 | 18-21 |
|---|---|---|---|---|---|
| **UV** | float32 Lux | float32 UV index | — | — | — |
| **Humidity** | int16 Temp ÷100 | int16 Humidity ÷100 | — | — | — |
| **Temperature v1** | int16 IR ÷100 | int16 Ambient ÷100 | — | — | — |
| **Temperature v2** | int16 Ambient ÷100 | uint16 raw X | float32 a | float32 b | float32 c |
| **Conductivity** | uint16 d0 | uint16 d1 | — | — | — |
| **VOC** | uint16 raw | — | — | — | — |
| **Heart rate v1** | uint32 sample 0 | uint32 sample 1 | uint32 sample 2 | uint32 sample 3 | — |
| **Heart rate v2** | (10 frames concatenated) | | | | |

> {warn}
> **Bytes 6–7 are at offset 6, NOT offset 4.** The 3 reserved bytes (3–5) come *after* the type byte. Several reverse-engineering attempts have made this mistake.

## Frame buffering

USB serial reads do not always return exactly 26 bytes per `read()` call. The SDK's `SerialReader` accumulates bytes in an internal `Uint8Array`:

1. Read from `port.readable` reader.
2. Append result to internal buffer.
3. While buffer length ≥ 26: extract one 26-byte frame, return it, retain the tail.
4. If buffer length < 26: read again.

This is implemented with **tail recursion** rather than a loop — pathological fragmentation could in theory blow the stack, but in practice firmware emits whole frames.

```ts
private async readOnce(): Promise<SerialRawValue> {
  if (this._array.length >= EXPECTED_LENGTH) {
    const frame = this._array.subarray(0, EXPECTED_LENGTH);
    this._array = this._array.subarray(EXPECTED_LENGTH);
    return new SerialRawValue(frame);
  }
  const { value } = await this._reader.read();
  this._array = concat(this._array, value);
  return await this.readOnce();
}
```

## Multi-frame readers

Most sensors decode one frame at a time. **Heart rate v2** is the exception: it requires 10 consecutive frames (160 bytes of payload) to feed into the ARM emulator algorithm. This is implemented by `TenValuesReader` rather than `SingleValueReader`. See [heart rate](../sensors/heart-rate.md).

## Sequence number

Bytes 22–23 contain a monotonic sequence number that wraps at 65535. The SDK does not currently expose this to consumers, but it can be useful for detecting dropped frames if you read raw values directly.

---


<!-- ===== from: content/protocol/sensor-types.md ===== -->

# Sensor type IDs

Byte 2 of every frame identifies the connected sensor.

## Type byte → sensor mapping

| Byte 2 | `SENSOR_TYPE` | Decoder name | Notes |
|---|---|---|---|
| `1` | `UV` | `UV` | UV / light v1 |
| `2` | `TEMPERATURE` | `TEMPERATURE` | IR thermometer v1 |
| `4` | `CONDUCTIVITY` | `CONDUCTIVITY` | Single hardware version |
| `5` | `HEART_RATE` | `HEART_RATE` | Pulse, FFT-based v1 |
| `6` | `VOC` | `VOC` | Air quality |
| `7` | `HUMIDITY` | `HUMIDITY` | Climate (T + RH) |
| `9` | `TEMPERATURE` | `TEMPERATURE2` | IR thermometer v2 (calibrated) |
| `10` | `HEART_RATE` | `HEART_RATE2` | Pulse, ARM-emulator-based v2 |
| `11` | `UV` | `UV2` | UV / light v2 |
| any other | `UNKNOWN` | — | Frame is rejected |

**Note** the asymmetry: the user-facing `SENSOR_TYPE` collapses v1/v2 into the same name (e.g., both `2` and `9` become `TEMPERATURE`), while the internal `decoderType` preserves the version (`TEMPERATURE` vs `TEMPERATURE2`). This is what powers firmware-version detection.

## SENSOR_TYPE enum

```ts
export enum SENSOR_TYPE {
  UNKNOWN = 'UNKNOWN',
  UV = 'UV',
  HUMIDITY = 'HUMIDITY',
  VOC = 'VOC',
  CONDUCTIVITY = 'CONDUCTIVITY',
  HEART_RATE = 'HEART_RATE',
  TEMPERATURE = 'TEMPERATURE',
}
```

The legacy `kiwrious-webserial` library exposes additional members `UV2`, `TEMPERATURE2`, `HEART_RATE2` — these are byte-3-byte equivalents but the canonical SDK collapses them.

## SENSOR_VALUE labels

Each `SensorDecodedValue` has a `label` field. The set of labels the SDK emits:

| Label | Sensor | Unit |
|---|---|---|
| `Lux` | UV / UV2 | lx |
| `Uv` | UV / UV2 | UV index |
| `Temp` | Humidity | °C |
| `Hum` | Humidity | %RH |
| `InfraredTemp` | Temperature, Temperature2 | °C |
| `AmbientTemp` | Temperature, Temperature2 | °C |
| `Con` | Conductivity | µS/cm (or `'MAX'`) |
| `Voc` | VOC | ppb (or warm-up state) |
| `HeartRate` | Heart rate v1, v2 | BPM |

## Decoder selection

```ts
class SerialDecoderFactory {
  createDecoder(decoderType: string): SerialDecoder | null {
    switch (decoderType) {
      case 'UV': case 'UV2':           return new SerialUVDecoder();
      case 'HUMIDITY':                 return new SerialHumidityDecoder();
      case 'TEMPERATURE':              return new SerialTemperatureDecoder();
      case 'TEMPERATURE2':             return new SerialTemperature2Decoder();
      case 'CONDUCTIVITY':             return new SerialConductivityDecoder();
      case 'VOC':                      return new SerialVOCDecoder();
      case 'HEART_RATE':               return new SerialHeartRateDecoder();
      case 'HEART_RATE2':              return new SerialHeartRate2Decoder();
      default:                         return null;
    }
  }

  createValueReader(decoderType: string): ValueReader {
    return decoderType === 'HEART_RATE2'
      ? new TenValuesReader()
      : new SingleValueReader();
  }
}
```

> {bug}
> The new SDK's `SerialDecoderFactory.ts` lists `HEART_RATE2` twice in `createDecoder` (around lines 39 and 60). The branch is unreachable but defensively returns the same decoder, so behaviour is correct — flagged as a code-cleanup item. See [discrepancies](../advanced/discrepancies.md).

---


<!-- ===== from: content/protocol/firmware-versions.md ===== -->

# Firmware versions

The SDK detects out-of-date sensor firmware automatically and surfaces a callback.

## How version is detected

When a frame arrives, byte 2 maps to a `decoderType` string. The SDK extracts a trailing digit (regex `/\d$/`) and treats that as the firmware version. No trailing digit means version 1 (the original firmware).

| Decoder type | Detected version |
|---|---|
| `UV` | `undefined` (treated as v1) |
| `UV2` | `2` |
| `TEMPERATURE` | `undefined` |
| `TEMPERATURE2` | `2` |
| `HEART_RATE` | `undefined` |
| `HEART_RATE2` | `2` |
| `HUMIDITY` | `undefined` |
| `VOC` | `undefined` |
| `CONDUCTIVITY` | `undefined` |

## LATEST_SENSOR_VERSION map

```ts
const LATEST_SENSOR_VERSION = new Map<string, number | undefined>([
  ['UV', 2],
  ['HUMIDITY',     undefined],   // no v2 exists
  ['VOC',          undefined],   // no v2 exists
  ['CONDUCTIVITY', undefined],   // no v2 exists
  ['HEART_RATE', 2],
  ['TEMPERATURE', 2],
]);
```

The `isFirmwareOutdated` getter on `SerialRawValue`:

```ts
get isFirmwareOutdated(): boolean {
  const regex = /\d$/gm;
  const currentSensorVersion = this.decoderType.match(regex)?.toString();
  return currentSensorVersion != LATEST_SENSOR_VERSION.get(this.sensorType);
}
```

This expression compares **strings** (`undefined !== 2` evaluates `true` in loose equality, so the `!=` is intentional but fragile — consumers should not depend on its exact semantics).

## Update flow

After the first frame is decoded, the SDK fires:

```ts
serialService.onFirmwareUpdateAvailable = (outdated: boolean) => {
  if (outdated) {
    // Show a banner, link to the firmware updater
  }
};
```

This callback fires **once per connection**, not per frame.

## What "outdated" means in practice

If a customer plugs in a v1 IR temperature sensor (type byte = `2`), the SDK detects `decoderType = 'TEMPERATURE'`, version `undefined`, latest version `2` → **outdated**. The sensor still works (the v1 decoder runs without issue) but the user should update for improved accuracy.

> {info}
> Older versions of the SDK do not include calibration coefficients in the frame payload — that's a v2 feature. So a v1 IR temperature sensor reports raw `IR ÷ 100` while v2 reports a quadratic-calibrated value. See [sensors/temperature](../sensors/temperature.md).

## Sensors with no version 2

`HUMIDITY`, `VOC`, and `CONDUCTIVITY` only have a single hardware revision today. `LATEST_SENSOR_VERSION.get('HUMIDITY')` is `undefined`, and the detected version is also `undefined`, so `isFirmwareOutdated` is `false`.

---


<!-- ===== from: content/api/serial-service.md ===== -->

# SerialService

The singleton entry point. The SDK's default export is a single shared `SerialService` instance.

```ts
import serialService from 'kiwrious-webserial';
```

## Methods

### `connectAndReadAsync()`

Prompts the user to select a Kiwrious device and starts the read loop.

```ts
async connectAndReadAsync(): Promise<void>
```

- Calls `navigator.serial.requestPort({ filters: [...] })` — shows the OS port-picker.
- Opens the selected port at 230400 baud.
- Reads the first 26-byte frame to detect sensor type.
- Selects the appropriate decoder via `SerialDecoderFactory`.
- Loops: read → decode → invoke `onSerialData`.
- Fires `onSerialConnection(true)` after the first successful read.

```js
document.querySelector('#connect').onclick = () => {
  serialService.connectAndReadAsync();
};
```

### `resumeReading()`

Resume reading from a previously-opened port without re-prompting the user.

```ts
async resumeReading(): Promise<void>
```

If `_port` is still retained internally (the SDK does **not** null it on disconnect), this skips the port-picker and re-opens the same port. Otherwise it falls back to `connectAndReadAsync()`.

```js
if (serialService.canResumeReading) {
  await serialService.resumeReading();
} else {
  await serialService.connectAndReadAsync();
}
```

### `disconnectAsync()`

Stop the read loop, release the reader, close the port.

```ts
async disconnectAsync(): Promise<void>
```

Steps:
1. Sets `_isReading = false` so the read loop exits naturally on the next iteration.
2. Cancels any in-flight `reader.read()`.
3. Releases the reader's lock.
4. Calls `port.close()`.
5. Fires `onSerialConnection(false)`.
6. **Retains** the `_port` reference (intentionally — for `resumeReading`).

> {info}
> The disconnect is wrapped in `setTimeout(..., 0)` to yield to the event loop and let the read loop finish gracefully before closing.

### `triggerStopReading()`

Sets `_isReading = false` without closing the port. Rarely needed — `disconnectAsync` covers most cases.

```ts
triggerStopReading(): void
```

## Properties

### `isReading: boolean`

`true` while the read loop is active.

### `canResumeReading: boolean`

`true` if a `_port` reference is still held internally (i.e., the user previously paired a device and disconnect was clean).

## Internal pipeline

```
connectAndReadAsync()
   ├─ startStage1RequestPortAsync()    ← navigator.serial.requestPort()
   └─ startStage2ConnectPortAsync(port)
        ├─ port.open({ baudRate: 230400 })
        ├─ port.readable.getReader()
        └─ startReading(reader)
             ├─ Read first 26-byte frame
             ├─ SerialDecoderFactory.createDecoder(decoderType)
             ├─ SerialDecoderFactory.createValueReader(decoderType)
             ├─ onSerialConnection(true)
             ├─ onFirmwareUpdateAvailable(rawValue.isFirmwareOutdated)
             └─ while (_isReading) {
                  const raw = await valueReader.readValue(reader);
                  const decoded = await decoder.decode(raw);
                  if (decoded) onSerialData(decoded);
                }
```

## Singleton pattern

`SerialService` is exported as a default-instance singleton:

```ts
// SerialService.ts (simplified)
const serialService = new SerialService();
export default serialService;
```

The same instance is shared across all imports — there is no class constructor to call yourself. This means callbacks set in one module are visible to all others; design accordingly.

## Typical lifecycle

```js
// Set callbacks once, at module load
serialService.onSerialData = (reading) => store.dispatch('reading', reading);
serialService.onSerialConnection = (c) => store.dispatch('connection', c);
serialService.onFirmwareUpdateAvailable = (out) => store.dispatch('firmware', out);

// User clicks Connect
await serialService.connectAndReadAsync();

// ... reads come in via onSerialData ...

// User clicks Disconnect
await serialService.disconnectAsync();

// Later: reconnect without prompt
if (serialService.canResumeReading) {
  await serialService.resumeReading();
}
```

See [callbacks](callbacks.md) for the full set of events and their payloads.

---


<!-- ===== from: content/api/callbacks.md ===== -->

# Event callbacks

`SerialService` exposes three optional callbacks. All are simple property assignments (no `addEventListener`-style API).

## `onSerialData`

Fires once per decoded sensor reading. The most frequent callback — typically 50–900 Hz depending on sensor.

```ts
onSerialData?: (data: SensorReadResult) => void;
```

```ts
interface SensorReadResult {
  sensorType: SENSOR_TYPE;            // 'UV' | 'HUMIDITY' | 'TEMPERATURE' | ...
  decodedValues: SensorDecodedValue[];
}

interface SensorDecodedValue {
  type: 'number' | 'object';
  label: string;                      // 'Temp' | 'Hum' | 'Lux' | ...
  value: number | string | object;    // shape depends on label
}
```

```js
serialService.onSerialData = (reading) => {
  console.log(reading.sensorType, reading.decodedValues);
};
```

See [interfaces](interfaces.md) for full payload shapes per sensor.

## `onSerialConnection`

Fires when the connection state changes.

```ts
onSerialConnection?: (connected: boolean) => void;
```

- `true` — fired after the first successful frame read (i.e., the connection is fully alive)
- `false` — fired after a graceful or abrupt disconnect

```js
serialService.onSerialConnection = (connected) => {
  setUiState(connected ? 'reading' : 'idle');
};
```

> {info}
> `connected: true` means **reading**, not just port-opened. Until the first frame decodes, the user might still see a stalled state.

## `onFirmwareUpdateAvailable`

Fires once per connection, after the first frame is decoded, if the firmware is older than `LATEST_SENSOR_VERSION`.

```ts
onFirmwareUpdateAvailable?: (outdated: boolean) => void;
```

```js
serialService.onFirmwareUpdateAvailable = (outdated) => {
  if (outdated) showFirmwareUpdateBanner();
};
```

See [firmware versions](../protocol/firmware-versions.md).

## Setting and clearing

Because callbacks are plain properties, you can clear them by assigning `undefined`:

```js
serialService.onSerialData = undefined;
serialService.onSerialConnection = undefined;
serialService.onFirmwareUpdateAvailable = undefined;
```

In React effect cleanup or Vue `beforeUnmount`, this prevents stale callbacks holding references to unmounted components.

## Throttling

The SDK does not throttle. A heart-rate sensor can deliver up to ~900 Hz of frames in theory; in practice 50–100 Hz is common. If your UI cannot render that fast, throttle in your callback:

```js
let lastUpdate = 0;
serialService.onSerialData = (reading) => {
  const now = performance.now();
  if (now - lastUpdate < 100) return;   // 10 Hz throttle
  lastUpdate = now;
  renderUi(reading);
};
```

`kiwrious-measure-vue` uses a separate `setInterval`-driven chart updator so reading rate and UI refresh rate are decoupled.

---


<!-- ===== from: content/api/interfaces.md ===== -->

# Data interfaces

The shape of every payload your `onSerialData` callback receives.

## `SensorReadResult`

The top-level payload.

```ts
interface SensorReadResult {
  sensorType: SENSOR_TYPE;            // string enum
  decodedValues: SensorDecodedValue[];
}
```

## `SensorDecodedValue`

Each entry in `decodedValues`.

```ts
interface SensorDecodedValue {
  type: 'number' | 'object';
  label: string;                       // see SENSOR_VALUE table
  value: number | string | ConductivityResult | VocResult | HeartRateResult;
}
```

The `type` field is a hint, not a strict guarantee — `'object'` indicates a status-bearing value that requires unpacking (conductivity, VOC, heart rate).

## Per-sensor `decodedValues` shapes

### UV (`sensorType: 'UV'`)

```ts
[
  { type: 'number', label: 'Lux', value: '2345' },     // string, fixed(0)
  { type: 'number', label: 'Uv',  value: '4.7' },      // string, fixed(1)
]
```

> {warn}
> UV values are returned as **strings** (from `.toFixed()`) by some decoders. Coerce with `Number(v.value)` if you need arithmetic.

### Humidity (`sensorType: 'HUMIDITY'`)

```ts
[
  { type: 'number', label: 'Temp', value: 23.45 },     // °C
  { type: 'number', label: 'Hum',  value: 41.20 },     // %RH
]
```

### Temperature v1 (`sensorType: 'TEMPERATURE'`, decoder `TEMPERATURE`)

```ts
[
  { type: 'number', label: 'AmbientTemp',  value: 22.10 },   // °C  -- index 0
  { type: 'number', label: 'InfraredTemp', value: 36.50 },   // °C  -- index 1
]
```

> {warn}
> Index ordering: `kiwrious-measure-vue` reads `sensor_values[0]` as Ambient and `sensor_values[1]` as Infrared for both `TEMPERATURE` and `TEMPERATURE2`. The legacy library `SerialTemperatureDecoder` returns labels `InfraredTemp` first, then `AmbientTemp`. Always check the `label`, not the index.

### Temperature v2 (`sensorType: 'TEMPERATURE'`, decoder `TEMPERATURE2`)

Same shape as v1, but the IR value is computed via a quadratic calibration polynomial — see [sensors/temperature](../sensors/temperature.md).

### Conductivity (`sensorType: 'CONDUCTIVITY'`)

```ts
[
  {
    type: 'object',
    label: 'Con',
    value: {
      status: 'MIN' | 'READY' | 'MAX',
      value: number | 'MAX',          // µS/cm; `'MAX'` (string) when over-range
    }
  }
]
```

### VOC (`sensorType: 'VOC'`)

```ts
[
  {
    type: 'object',
    label: 'Voc',
    value: {
      status: 'PROCESSING' | 'READY',
      value: number,                  // raw uint16 during warm-up; ppb when READY
      dataReadyPercentage: number,    // 0..100, rises 5%/sec
    }
  }
]
```

### Heart rate v1 (`sensorType: 'HEART_RATE'`, decoder `HEART_RATE`)

```ts
[
  {
    type: 'object',
    label: 'HeartRate',
    value: {
      status: 'PROCESSING' | 'READY' | 'TOO_LOW' | 'TOO_HIGH',
      value: number | null,           // BPM when READY
    }
  }
]
```

### Heart rate v2 (`sensorType: 'HEART_RATE'`, decoder `HEART_RATE2`)

```ts
[
  {
    type: 'object',
    label: 'HeartRate',
    value: {
      status: 'PROCESSING' | 'READY' | 'TOO_LOW',
      value: number,                  // BPM
      trustlevel: number,             // 0..100 confidence
      snr: number,                    // signal-to-noise ratio
    }
  }
]
```

## Status enums

```ts
export enum CONDUCTIVITY_RESULT_STATUS {
  MIN = 'MIN',         // open circuit (data0 >= 65535)
  READY = 'READY',
  MAX = 'MAX',         // over-range (>200,000 µS/cm)
}

export enum VOC_RESULT_STATUS {
  PROCESSING = 'PROCESSING',   // 20-second warm-up
  READY = 'READY',
}

export enum HEART_RATE_RESULT_STATUS {
  PROCESSING = 'PROCESSING',   // accumulating samples / detecting touch
  READY = 'READY',
  TOO_LOW = 'TOO_LOW',         // finger not on sensor
  TOO_HIGH = 'TOO_HIGH',       // saturation (v1 only)
}
```

See [enums](enums.md) for the complete list and import paths.

---


<!-- ===== from: content/api/enums.md ===== -->

# Status enums

The SDK exports these string enums for status comparison.

## `SENSOR_TYPE`

```ts
export enum SENSOR_TYPE {
  UNKNOWN      = 'UNKNOWN',
  UV           = 'UV',
  HUMIDITY     = 'HUMIDITY',
  VOC          = 'VOC',
  CONDUCTIVITY = 'CONDUCTIVITY',
  HEART_RATE   = 'HEART_RATE',
  TEMPERATURE  = 'TEMPERATURE',
}
```

Import:
```ts
import { SENSOR_TYPE } from 'kiwrious-webserial/lib/service/SerialRawValue';
```

## `SENSOR_VALUE`

The set of `label` strings on `SensorDecodedValue`.

```ts
export const SENSOR_VALUE = {
  UNKNOWN: 'UNKNOWN',
  UV_INDEX: 'Uv',
  LUX: 'Lux',
  HUMIDITY: 'Hum',
  TEMPERATURE: 'Temp',
  VOC: 'Voc',
  CONDUCTIVITY: 'Con',
  HEART_RATE: 'HeartRate',
  INFRARED_TEMPERATURE: 'InfraredTemp',
  AMBIENT_TEMPERATURE: 'AmbientTemp',
};
```

## `CONDUCTIVITY_RESULT_STATUS`

```ts
export enum CONDUCTIVITY_RESULT_STATUS {
  MIN = 'MIN',
  READY = 'READY',
  MAX = 'MAX',
}
```

Import:
```ts
import { CONDUCTIVITY_RESULT_STATUS } from 'kiwrious-webserial/lib/service/SerialConductivityDecoder';
```

## `VOC_RESULT_STATUS`

```ts
export enum VOC_RESULT_STATUS {
  PROCESSING = 'PROCESSING',
  READY = 'READY',
}
```

Import:
```ts
import { VOC_RESULT_STATUS } from 'kiwrious-webserial/lib/service/SerialVOCDecoder';
```

## `HEART_RATE_RESULT_STATUS`

```ts
export enum HEART_RATE_RESULT_STATUS {
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  TOO_LOW = 'TOO_LOW',
  TOO_HIGH = 'TOO_HIGH',
}
```

Import:
```ts
import { HEART_RATE_RESULT_STATUS } from 'kiwrious-webserial/lib/service/HeartRateProcessor';
```

> {info}
> Heart rate v2 only emits `PROCESSING`, `READY`, and `TOO_LOW`. The `TOO_HIGH` status is v1-only (raw amplitude saturation).

## Comparing safely

Always compare against the enum members rather than string literals. Status strings are stable today but treat them as opaque tokens:

```ts
import { VOC_RESULT_STATUS } from 'kiwrious-webserial/lib/service/SerialVOCDecoder';

if (decodedValue.value.status === VOC_RESULT_STATUS.READY) {
  // safe to read .value as ppb
}
```

---


<!-- ===== from: content/sensors/uv.md ===== -->

# UV / Light sensor

Measures ambient illuminance (Lux) and UV index. Two firmware versions exist (`UV` v1 and `UV2` v2) — both decode identically.

## Quick reference

| Field | Value |
|---|---|
| Type byte | `1` (v1), `11` (v2) |
| `sensorType` | `'UV'` |
| Decoder type | `UV` / `UV2` |
| Latest version | 2 |
| Outputs | Lux, UV index |
| Warm-up | none |

## Frame layout

| Offset | Size | Type | Field | Notes |
|---|---|---|---|---|
| 6 | 4 | float32 LE | Lux | Ambient illuminance, no scaling |
| 10 | 4 | float32 LE | UV index | UV intensity, no scaling |

## Decoder

```ts
class SerialUVDecoder {
  async decode(rawValue: SerialRawValue): Promise<SensorReadResult> {
    return {
      sensorType: SENSOR_TYPE.UV,
      decodedValues: [
        { type: 'number', label: 'Lux', value: rawValue.getFourBytesFloatByIndex(6).toFixed(0) },
        { type: 'number', label: 'Uv',  value: rawValue.getFourBytesFloatByIndex(10).toFixed(1) },
      ],
    };
  }
}
```

## Reading

```js
serialService.onSerialData = (reading) => {
  if (reading.sensorType !== 'UV') return;
  const lux = Number(reading.decodedValues[0].value);
  const uv  = Number(reading.decodedValues[1].value);
  console.log(`Lux: ${lux}  UV index: ${uv}`);
};
```

## Units and ranges

| Output | Unit | Typical range | Notes |
|---|---|---|---|
| Lux | lx | 0 — 100,000+ | Indoor: 100–500 lx, sunlight: 30,000–100,000 lx |
| UV index | dimensionless | 0 — 11+ | Standard WHO UV index scale |

> {warn}
> The decoder returns **strings** (`.toFixed(0)` and `.toFixed(1)`). Coerce to numbers before doing math: `Number(value)`.

## Notes

- No calibration math — values are raw float32 from the firmware.
- No warm-up period.
- Both v1 and v2 use the same parsing; they differ in firmware features (the type byte changes from 1 to 11).
- The Vue consumer maps `sensor_values[0]` to Lux and `sensor_values[1]` to UV index — this matches the decoder ordering.

## Source files

- `src/decoder/SerialUVDecoder.ts` (new SDK)
- `kiwrious/service/SerialUVDecoder.ts` (legacy library)

---


<!-- ===== from: content/sensors/humidity.md ===== -->

# Humidity / Climate sensor

Measures ambient temperature and relative humidity. Single hardware revision.

## Quick reference

| Field | Value |
|---|---|
| Type byte | `7` |
| `sensorType` | `'HUMIDITY'` |
| Decoder type | `HUMIDITY` |
| Latest version | (no v2) |
| Outputs | Temperature (°C), Humidity (%RH) |
| Warm-up | none |

## Frame layout

| Offset | Size | Type | Field | Scaling |
|---|---|---|---|---|
| 6 | 2 | int16 LE | Temperature | ÷ 100 → °C |
| 8 | 2 | int16 LE | Humidity | ÷ 100 → %RH |

## Decoder

```ts
class SerialHumidityDecoder {
  async decode(rawValue: SerialRawValue): Promise<SensorReadResult> {
    const temp = rawValue.getTwoBytesSignedByIndex(6) / 100;
    const hum  = rawValue.getTwoBytesSignedByIndex(8) / 100;
    return {
      sensorType: SENSOR_TYPE.HUMIDITY,
      decodedValues: [
        { type: 'number', label: 'Temp', value: temp },
        { type: 'number', label: 'Hum',  value: hum  },
      ],
    };
  }
}
```

## Reading

```js
serialService.onSerialData = (reading) => {
  if (reading.sensorType !== 'HUMIDITY') return;
  const tempC = reading.decodedValues[0].value;
  const rhPct = reading.decodedValues[1].value;
  console.log(`${tempC.toFixed(1)} °C, ${rhPct.toFixed(1)} %RH`);
};
```

## Units and ranges

| Output | Unit | Typical range |
|---|---|---|
| Temperature | °C | -40 to +85 |
| Humidity | %RH | 0 to 100 |

The raw int16 is signed, allowing for sub-zero temperature readings. Divide-by-100 gives 0.01 °C resolution and 0.01 %RH resolution.

## Notes

- Both fields are **signed** int16 — humidity could in theory go negative due to calibration offsets, but the firmware clips it.
- No warm-up — readings stabilise within the first few frames.
- The Vue consumer at `kiwrious-measure-vue` reads `sensor_values[1]` for humidity and `sensor_values[0]` for temperature, which matches the decoder ordering.
- The `kiwrious-measure-vue` app uses humidity as an "animation intensity" trigger — a UI affordance, not a sensor concern.

## Source files

- `src/decoder/SerialHumidityDecoder.ts` (new SDK)
- `kiwrious/service/SerialHumidityDecoder.ts` (legacy library)

---


<!-- ===== from: content/sensors/temperature.md ===== -->

# Temperature (IR) sensor

Non-contact infrared thermometer. Two firmware versions exist; **v2 includes per-frame quadratic calibration**.

## Quick reference

| Field | v1 | v2 |
|---|---|---|
| Type byte | `2` | `9` |
| `sensorType` | `'TEMPERATURE'` | `'TEMPERATURE'` |
| Decoder type | `TEMPERATURE` | `TEMPERATURE2` |
| Latest version | 2 | 2 |
| Outputs | Ambient °C, IR °C | Ambient °C, IR °C (calibrated) |
| Warm-up | none | none |

## v1 frame layout

| Offset | Size | Type | Field | Scaling |
|---|---|---|---|---|
| 6 | 2 | int16 LE | IR temperature | ÷ 100 → °C |
| 8 | 2 | int16 LE | Ambient temperature | ÷ 100 → °C |

```ts
async decode(rawValue: SerialRawValue) {
  const ir      = rawValue.getTwoBytesSignedByIndex(6) / 100;
  const ambient = rawValue.getTwoBytesSignedByIndex(8) / 100;
  return {
    sensorType: SENSOR_TYPE.TEMPERATURE,
    decodedValues: [
      { type: 'number', label: 'AmbientTemp',  value: ambient },
      { type: 'number', label: 'InfraredTemp', value: ir },
    ],
  };
}
```

## v2 frame layout (calibrated)

| Offset | Size | Type | Field | Scaling |
|---|---|---|---|---|
| 6 | 2 | int16 LE | Ambient temperature | ÷ 100 → °C |
| 8 | 2 | uint16 LE | Raw ADC value `X` | — |
| 10 | 4 | float32 LE | Coefficient `a` | — |
| 14 | 4 | float32 LE | Coefficient `b` | — |
| 18 | 4 | float32 LE | Coefficient `c` | — |

The IR value is computed via a **quadratic polynomial** with coefficients shipped in every frame:

```
IR_temp_°C = (a · X² / 100,000) + (b · X) + c
```

```ts
async decode(rawValue: SerialRawValue) {
  const ambient = rawValue.getTwoBytesSignedByIndex(6) / 100;
  const X = rawValue.getTwoBytesUnsignedByIndex(8);
  const a = rawValue.getFourBytesFloatByIndex(10);
  const b = rawValue.getFourBytesFloatByIndex(14);
  const c = rawValue.getFourBytesFloatByIndex(18);

  const ir = (a * X * X / 1e5 + b * X + c).toFixed(0);   // returned as string

  return {
    sensorType: SENSOR_TYPE.TEMPERATURE,
    decodedValues: [
      { type: 'number', label: 'AmbientTemp',  value: ambient },
      { type: 'number', label: 'InfraredTemp', value: ir },
    ],
  };
}
```

> {warn}
> v2 IR temperature is rounded to integer (`.toFixed(0)`) — sub-degree precision is discarded. v1 returns the raw int16 ÷ 100 as a fractional number.

## Why per-frame coefficients?

The v2 firmware stores its calibration constants in the device. Shipping `a`, `b`, `c` in every packet means:

- The host SDK doesn't need a calibration database
- Firmware updates can change coefficients without an SDK change
- Per-device calibration can be applied at the factory and persist across firmware flashes

If you observe `a ≈ 1e-5`, `b ≈ 1e-2`, `c ≈ 25–40`, the values are typical and the math is working.

## Reading

```js
serialService.onSerialData = (reading) => {
  if (reading.sensorType !== 'TEMPERATURE') return;
  const ambient = Number(reading.decodedValues[0].value);
  const ir      = Number(reading.decodedValues[1].value);
  console.log(`Object: ${ir} °C   Ambient: ${ambient} °C`);
};
```

> {info}
> Both v1 and v2 surface as `sensorType: 'TEMPERATURE'`. To distinguish, look at the device's reported decoder type via firmware-update detection, or compare the frame byte 2 directly.

## Notes

- The Vue consumer routes both v1 and v2 to the same component (`SensorValue.ts`) — the user-facing UI is identical.
- The Scratch GUI fork only implements the v2 calibration formula (and uses the same math from byte 8 with coefficients at 10/14/18). It does **not** support v1's simpler `int16 ÷ 100` IR reading.

## Source files

- `src/decoder/SerialTemperatureDecoder.ts` — v1
- `src/decoder/SerialTemperature2Decoder.ts` — v2

---


<!-- ===== from: content/sensors/conductivity.md ===== -->

# Conductivity sensor

Measures electrical conductivity in liquids — useful for water quality, salinity, ion concentration. Single hardware revision.

## Quick reference

| Field | Value |
|---|---|
| Type byte | `4` |
| `sensorType` | `'CONDUCTIVITY'` |
| Decoder type | `CONDUCTIVITY` |
| Latest version | (no v2) |
| Output | µS/cm or status |
| Warm-up | none |

## Frame layout

| Offset | Size | Type | Field |
|---|---|---|---|
| 6 | 2 | uint16 LE | `data0` (electrode reading 1) |
| 8 | 2 | uint16 LE | `data1` (electrode reading 2) |

## Calculation

```ts
const MAX_CONDUCTANCE_VALUE = 200000;   // µS/cm cap
const MIN_CONDUCTANCE_VALUE = 65535;    // open-circuit threshold

async decode(rawValue: SerialRawValue) {
  const data0 = rawValue.getTwoBytesByIndex(6);
  const data1 = rawValue.getTwoBytesByIndex(8);

  if (data0 >= MIN_CONDUCTANCE_VALUE) {
    return result({ status: 'MIN', value: 0 });
  }

  const conductivity = Number(((1 / (data0 * data1)) * 1e6).toFixed(1));

  if (conductivity > MAX_CONDUCTANCE_VALUE) {
    return result({ status: 'MAX', value: 'MAX' });
  }

  return result({ status: 'READY', value: conductivity });
}
```

The core formula:

```
conductivity (µS/cm) = 1,000,000 / (data0 × data1)
```

This is a **dual-electrode** measurement — multiplying the two readings appears to give a resistance product, and the inverse times 10⁶ scales to microsiemens per centimetre.

## Status codes

| Status | Meaning | `value` field |
|---|---|---|
| `MIN` | Open circuit — electrodes not in contact with a conductive medium | `0` |
| `READY` | Valid measurement | `number` (µS/cm) |
| `MAX` | Over-range (>200,000 µS/cm) — short circuit or extreme contamination | `'MAX'` (string!) |

> {warn}
> When `status === 'MAX'`, the `value` is the **string `'MAX'`**, not a number. Branch on status before doing math.

## Reading

```js
serialService.onSerialData = (reading) => {
  if (reading.sensorType !== 'CONDUCTIVITY') return;
  const result = reading.decodedValues[0].value;

  switch (result.status) {
    case 'READY':
      console.log(`Conductivity: ${result.value} µS/cm`);
      break;
    case 'MIN':
      console.log('Electrodes out of solution');
      break;
    case 'MAX':
      console.log('Reading saturated');
      break;
  }
};
```

## Typical ranges

| Sample | Conductivity |
|---|---|
| Distilled water | 0.5–3 µS/cm |
| Drinking water | 50–500 µS/cm |
| Sea water | ~50,000 µS/cm |
| Industrial brine | >100,000 µS/cm |

## Notes

- The `kiwrious-measure-vue` consumer maps `MIN → 0` and `MAX → 200000` for chart visualisation purposes — that's a UI choice, not the SDK contract.
- The Scratch GUI fork exposes both **resistance** (raw `data0 × data1`) and **conductance** (1/R × 10⁶) as separate blocks. The SDK only exposes conductivity. The two are mathematically related; either is recoverable.

> {bug}
> The Scratch GUI has a copy-paste typo: `_isConducatanceIncreasing` is set twice (with one of the assignments meant for the decreasing flag). See [discrepancies](../advanced/discrepancies.md).

## Source files

- `src/decoder/SerialConductivityDecoder.ts` (new SDK)
- `kiwrious/service/SerialConductivityDecoder.ts` (legacy library)

---


<!-- ===== from: content/sensors/voc.md ===== -->

# Air quality (VOC) sensor

Measures volatile organic compounds in air. Requires a **20-second warm-up** after connection.

## Quick reference

| Field | Value |
|---|---|
| Type byte | `6` |
| `sensorType` | `'VOC'` |
| Decoder type | `VOC` |
| Latest version | (no v2) |
| Output | VOC raw / ppb + status |
| Warm-up | **20 seconds** |

## Frame layout

| Offset | Size | Type | Field |
|---|---|---|---|
| 6 | 2 | uint16 LE | VOC raw value |

The Scratch GUI also decodes a CO2-equivalent value at offset 8–9, but the SDK exposes only the offset-6 value.

## Warm-up logic

```ts
const MAX_MS_WAIT_FOR_DATA_READY = 20_000;  // 20 seconds
const INTERVAL_MS = 1000;                    // polled every second
const MAX_PERCENTAGE = 100;
const incrementPercentage = INTERVAL_MS * MAX_PERCENTAGE / MAX_MS_WAIT_FOR_DATA_READY; // 5%/s

// On every decode:
if (rawValue > 0) {
  clearInterval(warmupTimer);
  status = 'READY';
} else if (elapsed_ms >= MAX_MS_WAIT_FOR_DATA_READY) {
  status = 'READY';
} else {
  status = 'PROCESSING';
  dataReadyPercentage = (elapsed_ms / 20000) * 100;
}
```

This is a **client-side simulation** — the firmware itself does not signal "warm-up complete". The decoder assumes:

1. The first non-zero VOC reading means the sensor is fully ready.
2. If 20 seconds pass without one, declare READY anyway and return the raw value.

> {info}
> The percentage is for **UI feedback only**. It rises linearly at 5% per second regardless of actual sensor state.

## Reading

```js
import { VOC_RESULT_STATUS } from 'kiwrious-webserial/lib/service/SerialVOCDecoder';

serialService.onSerialData = (reading) => {
  if (reading.sensorType !== 'VOC') return;
  const v = reading.decodedValues[0].value;

  if (v.status === VOC_RESULT_STATUS.PROCESSING) {
    showWarmingUp(v.dataReadyPercentage);
  } else {
    showVoc(v.value);   // ppb (or close to it)
  }
};
```

## Status object

```ts
{
  status: 'PROCESSING' | 'READY',
  value: number,                  // raw uint16 during warm-up; ppb when READY
  dataReadyPercentage: number,    // 0..100 (rises 5% per second)
}
```

> {warn}
> During `PROCESSING`, `value` is the raw uint16 from the sensor — **not** a meaningful ppb concentration. Always branch on `status` before displaying as ppb.

## Typical ranges

VOC concentration in **ppb** (parts per billion):

| Air quality | VOC range |
|---|---|
| Excellent indoor air | < 50 ppb |
| Good | 50–150 ppb |
| Moderate | 150–500 ppb |
| Poor | 500–1500 ppb |
| Unhealthy | > 1500 ppb |

The exact unit (ppb vs raw count) depends on firmware. The SDK passes through the uint16 unmodified.

## Notes

- The Scratch GUI fork exposes both `tVOC (ppb)` (bytes 6–7) and `CO2eq (ppm)` (bytes 8–9). The SDK and the legacy library only expose the first value.
- The Vue consumer surfaces a "VOC sensor warming up" message when status is `PROCESSING`.

## Source files

- `src/decoder/SerialVOCDecoder.ts` (new SDK)
- `kiwrious/service/SerialVOCDecoder.ts` (legacy library)

---


<!-- ===== from: content/sensors/heart-rate.md ===== -->

# Heart rate sensor

The most complex sensor in the family. Two firmware versions use **completely different algorithms**:

- **v1** — DSP pipeline in JavaScript: cascaded Biquad filters → FFT → peak detection
- **v2** — ARM Thumb firmware emulated via Unicorn (WASM)

## Quick reference

| Field | v1 | v2 |
|---|---|---|
| Type byte | `5` | `10` |
| `sensorType` | `'HEART_RATE'` | `'HEART_RATE'` |
| Decoder type | `HEART_RATE` | `HEART_RATE2` |
| Reader | `SingleValueReader` (1 frame) | `TenValuesReader` (10 frames) |
| Algorithm | Bandpass + FFT + averaging | Proprietary, ARM-emulated |
| Outputs | BPM | BPM, trust level, SNR |

---

## Heart rate v1 (DSP pipeline)

### Frame layout

| Offset | Size | Type | Field |
|---|---|---|---|
| 6 | 4 | uint32 LE | sample 0 |
| 10 | 4 | uint32 LE | sample 1 |
| 14 | 4 | uint32 LE | sample 2 |
| 18 | 4 | uint32 LE | sample 3 |

Each frame contains four PPG samples. The decoder feeds them to `HeartRateProcessor.processMultiInput()`.

### Pipeline

```
                     ┌──────────────────────┐
   uint32 samples ── │  Range check         │
                     │  300,000 ≤ x ≤ 900,000│
                     └──────────┬───────────┘
                                ▼
                     ┌──────────────────────┐
                     │  Mean centering      │
                     └──────────┬───────────┘
                                ▼
                     ┌──────────────────────┐
                     │  8-stage cascaded    │
                     │  Biquad bandpass     │
                     │  (~0.5–3 Hz / 30–180 BPM) │
                     └──────────┬───────────┘
                                ▼
                     ┌──────────────────────┐
                     │  2048-sample FFT     │
                     │  @ 200 Hz sample rate│
                     └──────────┬───────────┘
                                ▼
                     ┌──────────────────────┐
                     │  Peak frequency × 60 │
                     │  → BPM               │
                     └──────────┬───────────┘
                                ▼
                     ┌──────────────────────┐
                     │  Rolling mean of 100 │
                     │  → output BPM        │
                     └──────────────────────┘
```

### Constants

```ts
const SAMPLE_RATE       = 200;       // Hz
const INPUT_ARRAY_SIZE  = 2048;      // ~10.24 s at 200 Hz
const RESULT_ARRAY_SIZE = 100;       // averaging window
const MIN_INPUT_VALUE   = 300_000;   // ~3.0 normalised PPG amplitude
const MAX_INPUT_VALUE   = 900_000;   // ~9.0 normalised PPG amplitude
```

Inputs outside `[300000, 900000]` produce `TOO_LOW` or `TOO_HIGH` status — the FFT requires the finger to be cleanly on the sensor.

### Output

```ts
{
  status: 'PROCESSING' | 'READY' | 'TOO_LOW' | 'TOO_HIGH',
  value: number | null,    // BPM when READY
}
```

`PROCESSING` means accumulating samples — the first reading takes ~10 seconds (2048 samples at 200 Hz) plus 100 additional FFT outputs to fill the rolling-mean window.

> {info}
> The Biquad filter delay-line is initialised to `[1, 1, 1]` rather than zeros — non-standard but stable; the transient settles within milliseconds.

---

## Heart rate v2 (ARM emulator)

### Frame layout

The reader accumulates **10 consecutive 26-byte frames** before invoking the decoder. Each frame contributes 16 bytes of PPG data (offsets 6–21), giving 160 bytes total.

### Touch detection

A min-value threshold check on the **first** frame's bytes 6–9 (uint32) gates the algorithm:

```ts
LOW_THRESHOLD  = 1e5;   // 100,000  — below this = no touch
HIGH_THRESHOLD = 2e6;   // 2,000,000 — must exceed this to trigger
// Hysteresis: once triggered, must drop below LOW to reset
```

If the value is below the threshold, the decoder returns `status: 'TOO_LOW'` without invoking the emulator.

### Emulator pipeline

The 160-byte input feeds an ARM Thumb-mode binary (`prog.bin`) running in the Unicorn CPU emulator (compiled to WebAssembly).

```
┌─────────────────────────────────────────────────────────────┐
│  Unicorn ARM emulator (libunicorn_out.wasm)                 │
│                                                             │
│   Memory layout:                                            │
│     0x008000  ← prog.bin (firmware code)                    │
│     0x00800c  ← main entry point (Thumb mode, OR with 1)    │
│     0x008014  ← exit/return address                         │
│     0x200000  ← stack pointer                               │
│     0x380000  ← input buffer (160 bytes)                    │
│     0x3F0000  ← output buffer (16 bytes)                    │
│     0x400000  ← total RAM                                   │
│                                                             │
│   1. Write 160-byte input to 0x380000                       │
│   2. Set SP = 0x200000, PC = 0x0800c | 1 (Thumb)            │
│   3. uc_emu_start(...) until 0x8014                         │
│   4. Read 16 bytes from 0x3F0000                            │
└─────────────────────────────────────────────────────────────┘
```

### Output buffer layout

| Offset | Size | Type | Field |
|---|---|---|---|
| 0 | 4 | uint32 LE | status code |
| 4 | 4 | uint32 LE | heart rate (BPM) |
| 8 | 4 | uint32 LE | trust level |
| 12 | 4 | uint32 LE | SNR |

### Status code mapping

| Raw code | `status` |
|---|---|
| `0` | `PROCESSING` |
| `4` | `TOO_LOW` |
| `48` | `READY` |

### Hysteresis

The decoder applies a post-filter to prevent UI flicker: if the previous status was `READY` and the new one is `PROCESSING`, force `READY`.

```ts
if (previousStatus === 'READY' && currentStatus === 'PROCESSING') {
  result.status = 'READY';   // hold steady
}
```

### Output

```ts
{
  status: 'PROCESSING' | 'READY' | 'TOO_LOW',
  value: number,         // BPM
  trustlevel: number,    // 0..100
  snr: number,           // signal-to-noise
}
```

### Why an emulator?

The proprietary heart-rate detection algorithm is shipped as compiled ARM Thumb. Re-implementing it in JavaScript would require reverse-engineering. The Unicorn-on-WASM approach lets the SDK execute the firmware verbatim, with full fidelity to whatever the hardware would compute.

The trade-off is bundle size:

| Asset | Size |
|---|---|
| `libunicorn_out.wasm` | ~770 KB |
| `libunicorn_out.js` | ~76 KB |
| `unicorn-wrapper.js` | ~22 KB |
| `unicorn-constants.js` | ~63 KB |
| `prog.bin` | varies (typ. 100–200 KB) |
| **Total** | **~1 MB** |

This payload is only loaded if the user actually plugs in a v2 heart rate sensor.

---

## Reading (both versions)

```js
import { HEART_RATE_RESULT_STATUS } from 'kiwrious-webserial/lib/service/HeartRateProcessor';

serialService.onSerialData = (reading) => {
  if (reading.sensorType !== 'HEART_RATE') return;
  const v = reading.decodedValues[0].value;

  switch (v.status) {
    case HEART_RATE_RESULT_STATUS.READY:
      console.log(`${v.value} BPM`);
      if ('trustlevel' in v) console.log(`Trust ${v.trustlevel}%, SNR ${v.snr}`);
      break;
    case HEART_RATE_RESULT_STATUS.PROCESSING:
      console.log('Acquiring pulse…');
      break;
    case HEART_RATE_RESULT_STATUS.TOO_LOW:
      console.log('Place finger firmly on sensor');
      break;
    case HEART_RATE_RESULT_STATUS.TOO_HIGH:
      console.log('Sensor saturated (v1 only)');
      break;
  }
};
```

## Source files

- `src/decoder/SerialHeartRateDecoder.ts` — v1
- `src/decoder/SerialHeartRate2Decoder.ts` — v2 wrapper
- `src/processing/HeartRateProcessor.ts` — v1 DSP pipeline
- `src/lib/heartrate.js` — v2 emulator orchestrator
- `src/lib/libunicorn_out.{js,wasm}` — Unicorn ARM emulator
- `src/lib/prog.bin` — compiled ARM Thumb firmware

---


<!-- ===== from: content/advanced/dsp-pipeline.md ===== -->

# DSP pipeline (heart rate v1)

How the v1 heart rate decoder turns raw PPG samples into BPM, all in JavaScript.

## Sample rate and timing

```ts
const SAMPLE_RATE       = 200;      // Hz — PPG sample rate
const INPUT_ARRAY_SIZE  = 2048;     // FFT window
const RESULT_ARRAY_SIZE = 100;      // averaging window for output
```

A 2048-sample FFT at 200 Hz gives:
- Window duration ≈ 10.24 s
- Frequency resolution ≈ 200 / 2048 ≈ 0.098 Hz
- BPM resolution ≈ 5.86 BPM (= 0.098 × 60)

## Input validation

```ts
const MIN_INPUT_VALUE = 300_000;   // ~3.0 normalised PPG amplitude
const MAX_INPUT_VALUE = 900_000;   // ~9.0 normalised PPG amplitude

if (sample < MIN_INPUT_VALUE) status = 'TOO_LOW';
else if (sample > MAX_INPUT_VALUE) status = 'TOO_HIGH';
```

`TOO_LOW` typically means the user's finger is barely on the sensor (or absent). `TOO_HIGH` means saturation — too much pressure or ambient light leaking in.

## Mean centering

Before filtering, the input array is centred around its mean — removing DC offset:

```ts
const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
const centred = arr.map(x => x - mean);
```

## Biquad cascade

Eight cascaded second-order sections form a Butterworth bandpass roughly tuned to the heart-rate frequency band (0.5–3 Hz, i.e. 30–180 BPM):

```ts
const SOS = [
  [[1.0000, 0, -1.0000], [1.0000, -1.9794, 0.9847]],
  [[1.0000, 0, -1.0000], [1.0000, -1.9948, 0.9953]],
  [[1.0000, 0, -1.0000], [1.0000, -1.9889, 0.9893]],
  [[1.0000, 0, -1.0000], [1.0000, -1.9921, 0.9924]],
  [[1.0000, 0, -1.0000], [1.0000, -1.9930, 0.9933]],
  [[1.0000, 0, -1.0000], [1.0000, -1.9943, 0.9946]],
  [[1.0000, 0, -1.0000], [1.0000, -1.9947, 0.9950]],
  [[1.0000, 0, -1.0000], [1.0000, -1.9954, 0.9956]],
];

const GAIN = [0.0256, 0.0256, 0.0254, 0.0254, 0.0252, 0.0252, 0.0251, 0.0251, 1.0000];
```

Each section is a transposed-direct-form-II biquad with state vector `w = [1, 1, 1]` (initialised non-zero — see below).

> {info}
> The composite gain product is `0.0256^8 ≈ 1.1e-11`. The signal is heavily attenuated, then recovered by FFT magnitude scaling and the final stage gain of 1.0. Don't be alarmed by tiny intermediate values.

## FFT and peak detection

After filtering, the array is passed to `jsfft`:

```ts
const spectrum = fft(centredFiltered);
const magnitudes = spectrum.map(c => Math.hypot(c.re, c.im));

let peakIdx = 0;
let peakMag = 0;
for (let i = 0; i < magnitudes.length / 2; i++) {
  if (magnitudes[i] > peakMag) {
    peakMag = magnitudes[i];
    peakIdx = i;
  }
}

const peakFreqHz = peakIdx * (SAMPLE_RATE / INPUT_ARRAY_SIZE);
const heartRate = peakFreqHz * 60;     // BPM
```

The frequency-to-BPM conversion is intentionally simple: the bandpass narrows the search space, so the global max is reliably the fundamental, not a harmonic.

## Rolling average

The pipeline accumulates 100 BPM estimates before emitting a final result:

```ts
const recent = [];   // up to 100 samples
recent.push(currentBpm);
if (recent.length < RESULT_ARRAY_SIZE) {
  return { status: 'PROCESSING', value: null };
}
if (recent.length > RESULT_ARRAY_SIZE) recent.shift();
const avg = recent.reduce((a, b) => a + b) / recent.length;
return { status: 'READY', value: Math.round(avg) };
```

This means **first reading takes ~10 s** (filling the FFT window) plus extra time to fill the averaging window — roughly **~15–20 seconds total** before `status: 'READY'`.

## Quirks

- **Initial filter state `[1, 1, 1]`** rather than zeros. Non-standard; appears to have been a deliberate choice for DC offset handling. Transient settles within microseconds.
- **No harmonic filtering** — relies on the bandpass alone.
- **Linear bin-to-BPM mapping** — assumes 200 Hz sample rate. If the firmware ever emits at a different rate, BPM scales linearly (so detection would still work, but values would be wrong).

## Source

- `src/processing/HeartRateProcessor.ts`
- `src/decoder/SerialHeartRateDecoder.ts`

---


<!-- ===== from: content/advanced/heart-rate-emulation.md ===== -->

# ARM emulator pipeline (heart rate v2)

Deep dive into the v2 heart rate sensor's runtime — a Unicorn-on-WebAssembly ARM Thumb emulator running a proprietary firmware blob.

## Why an emulator?

The Kiwrious heart rate detection algorithm is implemented as compiled ARM Thumb code (`prog.bin`). Rather than re-implement it in JavaScript — which would require reverse-engineering and risk drift between platforms — the SDK executes the firmware verbatim using the [Unicorn](https://www.unicorn-engine.org/) CPU emulator, compiled to WebAssembly.

## Asset payload

The v2 heart rate runtime requires these files to be hosted alongside your page:

| File | Source | Approx size |
|---|---|---|
| `libunicorn_out.js` | Emscripten wrapper | 76 KB |
| `libunicorn_out.wasm` | Compiled Unicorn engine | 770 KB |
| `unicorn-wrapper.js` | High-level emulator API | 22 KB |
| `unicorn-constants.js` | ARM register / mode constants | 63 KB |
| `libelf-integers.js` | Integer helpers | 5.8 KB |
| `heartrate.js` | Orchestrator (`HeartRateDetector`) | 2 KB |
| `prog.bin` | ARM Thumb firmware | varies |

These are bundled in `dist/js/` after `npm run build`.

## Memory map

```
 0x000000 ┌────────────────────────────┐
          │   (low memory, unused)     │
 0x008000 ├────────────────────────────┤  ← TEXT_START_ADDRESS
          │                            │
          │   prog.bin firmware code   │
          │                            │
          │   Entry: 0x0800c | 1       │  ← MAIN_ADDRESS (Thumb mode)
          │   Exit:  0x008014          │  ← EXIT_ADDRESS
          │                            │
 0x200000 ├────────────────────────────┤  ← STACK_ADDRESS
          │                            │
          │   ARM stack                │
          │                            │
 0x380000 ├────────────────────────────┤  ← INPUT_ADDRESS
          │                            │
          │   Input buffer (160 bytes) │
          │   = 10 frames × 16 bytes   │
          │                            │
 0x3F0000 ├────────────────────────────┤  ← RETURN_ADDRESS
          │                            │
          │   Output buffer (16 bytes) │
          │                            │
 0x400000 └────────────────────────────┘  ← RAM_SIZE = 4 MiB
```

## Execution flow

```js
// Pseudocode of HeartRateDetector.detect(input160bytes)
async function detect(input) {
  // 1. Allocate emulator if not yet created
  if (!uc) {
    uc = new Unicorn();
    uc.open('arm');
    uc.mem_map(0, 0x400000, ALL);
    uc.mem_write(0x008000, await fetch('js/prog.bin').then(r => r.arrayBuffer()));
  }

  // 2. Write 160 bytes of PPG input
  uc.mem_write(0x380000, input);

  // 3. Reset registers, set SP and PC
  uc.reg_write('SP', 0x200000);
  uc.reg_write('PC', 0x0800c | 1);   // bit 0 = Thumb mode

  // 4. Execute until exit
  uc.emu_start(0x0800c | 1, 0x008014);

  // 5. Read 16-byte result
  const out = uc.mem_read(0x3F0000, 16);
  const dv = new DataView(out.buffer);
  return {
    status:    dv.getUint32(0,  true),
    value:     dv.getUint32(4,  true),
    trustlevel: dv.getUint32(8,  true),
    snr:       dv.getUint32(12, true),
  };
}
```

## Status code mapping

The firmware returns a status code in the first uint32 of the output buffer. The decoder maps these to the public enum:

| Raw uint32 | `HEART_RATE_RESULT_STATUS` |
|---|---|
| `0` | `PROCESSING` |
| `4` | `TOO_LOW` |
| `48` | `READY` |

Other values are not currently observed in the wild and will surface as-is.

## Performance characteristics

| Phase | Cost |
|---|---|
| First-time emulator init | ~50–150 ms (WASM compile + memory map + firmware load) |
| Per-frame detection | ~5–15 ms (depends on host CPU) |
| Total payload | ~1 MB |

Subsequent detections reuse the warm emulator — only the input buffer is rewritten.

## Why hysteresis?

The firmware can transiently emit `PROCESSING` even while a steady pulse is being detected. To smooth the UX, the decoder applies a post-filter: if previous status was `READY` and the next is `PROCESSING`, override to `READY`.

```ts
if (last.status === 'READY' && current.status === 'PROCESSING') {
  current.status = 'READY';
}
```

## Failure modes

- **Firmware blob 404** — `prog.bin` not hosted next to `heartrate.js`. Check your dist setup.
- **WASM not supported** — Unicorn requires WebAssembly. All Web Serial-supporting browsers also support WASM.
- **Memory access errors** — Indicate corrupted input or wrong base addresses. Check `INPUT_ADDRESS` and frame size.
- **Infinite loop** — Should not happen with shipped firmware; if it does, `uc_emu_start` has a hardcoded exit address (`0x8014`).

---


<!-- ===== from: content/advanced/disconnect-resume.md ===== -->

# Disconnect & resume

How the SDK handles unplugs, browser tab changes, and reconnection.

## Graceful disconnect

When you call `serialService.disconnectAsync()`:

```ts
async disconnectAsync(): Promise<void> {
  this._isReading = false;        // 1. Tell the read loop to exit

  if (this._reader) {              // 2. Cancel + release the reader
    await this._reader.cancel();
    this._reader.releaseLock();
    this._reader = null;
  }

  if (this._port) {                // 3. Close the port
    setTimeout(async () => {
      await this._port.close();
      // NOTE: this._port = null is intentionally NOT set
      // so that resumeReading() can reuse it.
    }, 0);
  }

  this._isConnected = false;
  this.onSerialConnection?.(false);
}
```

The `setTimeout(..., 0)` yields to the event loop so the read loop has a chance to finish its current iteration before the port closes. Without it, you can race into `port.close()` while a `reader.read()` is still in flight.

> {info}
> The `_port` reference is **intentionally retained** — even after a clean disconnect. This enables `resumeReading()` to skip the port-picker. The original code has a comment marking this: *"DO NOT UNCOMMECNT"* (sic).

## Abrupt disconnect (USB unplug)

`navigator.serial.ondisconnect` fires when the device is physically removed:

```ts
serial.ondisconnect = async () => {
  await this.disconnectAsync();
  this._port = null;     // here we DO null it — the port is gone
};
```

In this case `canResumeReading` becomes `false`; the user must re-pair via `connectAndReadAsync()`.

## Resume

```ts
async resumeReading(): Promise<void> {
  if (!this._port) {
    // No retained port → fall through to a fresh connection
    await this.connectAndReadAsync();
    return;
  }
  // Skip stage 1 (port picker), go straight to opening it
  await this.startStage2ConnectPortAsync(this._port);
}
```

Use it like this:

```js
async function reconnect() {
  if (serialService.canResumeReading) {
    await serialService.resumeReading();
  } else {
    await serialService.connectAndReadAsync();
  }
}
```

This pattern gives the user a "Reconnect" button that doesn't bother them with the OS port picker on every disconnect.

## State diagram

```
                          ┌──────────────┐
              ┌──────────►│  Connected   │◄──────────┐
              │           │  + Reading   │           │
   connect    │           └──────┬───────┘           │
              │                  │                   │
              │                  │ disconnectAsync() │
              │                  │ or USB unplug     │
              │                  ▼                   │
              │           ┌──────────────┐           │
              └───────────│  Disconnected│           │
                          │  (port held) │           │
                          └──────┬───────┘           │
                                 │ resumeReading()   │
                                 └───────────────────┘

   USB unplug clears _port → state becomes
   "Disconnected, port lost" → must call connectAndReadAsync().
```

## Recording auto-save on disconnect

The `kiwrious-measure-vue` app auto-saves any in-progress recording when `onSerialConnection(false)` fires:

```js
serialService.onSerialConnection = (connected) => {
  if (!connected && this.isRecording) {
    this.isRecording = false;
    this.saveRecording();
  }
};
```

This is a consumer-app convention, not part of the SDK contract — but a good pattern to copy.

## Why callbacks fire on disconnect

`onSerialConnection(false)` always fires after a graceful or abrupt disconnect. There is no separate "lost" callback. Distinguish via `canResumeReading`:

| `connected` | `canResumeReading` | Meaning |
|---|---|---|
| `false` | `true` | Disconnect, port retained — can resume |
| `false` | `false` | Disconnect, port lost — must re-pair |

---


<!-- ===== from: content/advanced/discrepancies.md ===== -->

# Cross-project discrepancies

Audit of differences between the SDK, the legacy library, the Vue consumer, and the Scratch GUI fork. Some are bugs; others are intentional divergence; a few are notable.

## Summary

| # | Where | Severity | Subject |
|---|---|---|---|
| 1 | Scratch GUI | **Bug** | Wrong baud rate (115200 vs canonical 230400) |
| 2 | Scratch GUI | Medium | Microchip filter restricts by PID `0xec19`; SDK accepts any PID |
| 3 | Scratch GUI | Diff | Exposes both tVOC and CO2eq; SDK exposes only one VOC value |
| 4 | Scratch GUI | **Bug** | `_isConducatanceIncreasing` set twice (typo + missing decreasing flag) |
| 5 | Scratch GUI | Bug | Origin Trial token expired April 2021 |
| 6 | Scratch GUI | Diff | No heart rate sensor support |
| 7 | New SDK | Minor | `HEART_RATE2` listed twice in `SerialDecoderFactory.ts` |
| 8 | All | Diff | `port.open({ baudrate, baudRate })` — both spellings passed |
| 9 | Vue app | Drift | Pins `kiwrious-webserial@1.0.20`; legacy library is at v1.0.21 |
| 10 | All decoders | Quirk | UV decoder returns strings (`.toFixed()`); other decoders return numbers |
| 11 | Vue app | Quirk | `CONDUCTIVITY_DEFAULT[status]` overlay maps `MIN→0`, `MAX→200000` for chart UX |
| 12 | All | Quirk | VOC warm-up is **client-side simulated**, not driven by firmware signal |

---

## 1. Scratch GUI uses wrong baud rate

| Project | Baud rate |
|---|---|
| New SDK | **230400** |
| Legacy library | **230400** |
| Vue consumer | (delegates to library — 230400) |
| Scratch GUI | **115200** ❌ |

**Evidence:** `lib.min.js` line 399253 in `scratch-gui` hard-codes `115200`. The SDK and library both pass `230400` (with both spellings).

**Impact:** A Kiwrious device emitting at 230400 baud will produce garbled or no data when read at 115200. Either:
- The firmware that the Scratch GUI was originally built against ran at 115200, or
- The Scratch GUI is silently broken and has been since the SDK moved to 230400.

**Recommendation:** verify against current firmware. If 230400 is canonical, fix the Scratch GUI.

---

## 2. Scratch GUI restricts Microchip filter by PID

| Project | Microchip filter |
|---|---|
| New SDK | `{ usbVendorId: 0x04d8 }` (any PID) |
| Legacy library | `{ usbVendorId: 0x04d8, vendorId: 0x04d8 }` (any PID) |
| Scratch GUI | `{ usbVendorId: 0x04d8, usbProductId: 0xec19 }` (only PID 0xec19) |

**Impact:** Newer Kiwrious sensors that ship with a different Microchip PID will not appear in the Scratch GUI's port-picker. The SDK and library accept all Microchip PIDs.

---

## 3. VOC fields differ between Scratch GUI and SDK

| Project | VOC fields |
|---|---|
| New SDK | `Voc` (single, bytes 6–7) |
| Legacy library | `Voc` (single, bytes 6–7) |
| Scratch GUI | `tVOC (ppb)` from bytes 6–7, **plus** `CO2eq (ppm)` from bytes 8–9 |

**Impact:** The Scratch GUI exposes more sensor data than the SDK. Either the firmware does emit a CO2eq reading at offset 8–9 that the SDK ignores, or the Scratch GUI is reading garbage at offset 8–9. Worth verifying with firmware authors.

If valid, the SDK could be extended to surface a `CO2` field on VOC readings.

---

## 4. Scratch GUI conductance increasing/decreasing typo

`scratch-gui/lib.min.js` near line 399964:

```js
this._isConducatanceIncreasing = this._isIncrease(...);
this._isConducatanceIncreasing = this._isDecrease(...);   // ← should be _isConducatanceDecreasing
```

Note the misspelled identifier (`Conducatance`) and the duplicated assignment. Result: the `is conductance decreasing?` block always reports the *increasing* result.

---

## 5. Scratch GUI origin trial token expired

`index.html` and `compatibility-testing.html` carry an `Origin-Trial` meta tag for Web Serial. The token expired on **April 7, 2021** (`expiry: 1617753599`). On modern Chrome, Web Serial is now generally available and the token is unnecessary — but the page still ships the expired one.

Cosmetic only; modern Chrome ignores expired trial tokens.

---

## 6. Scratch GUI does not implement heart rate

Scratch GUI implements 5 sensor types: UV, Humidity, Temperature, Conductivity, VOC. It has **no heart rate support** — no opcodes, no decoder. The Unicorn emulator stack is not bundled there.

This is intentional (block-based programming UX for kids) but worth documenting.

---

## 7. Duplicate `HEART_RATE2` case in `SerialDecoderFactory`

```ts
// src/service/SerialDecoderFactory.ts (new SDK)
case 'HEART_RATE2':                              // line ~39
  return new SerialHeartRate2Decoder();
// ...
case 'HEART_RATE2':                              // line ~60 (unreachable)
  return new SerialHeartRate2Decoder();
```

Behaviour is correct (the second branch is unreachable) but it's dead code. Cleanup item.

---

## 8. `port.open({ baudrate, baudRate })` passes both spellings

```ts
await port.open({ baudrate: 230400, baudRate: 230400 });
```

The Web Serial spec uses `baudRate` (camelCase). Older Chromium implementations accepted `baudrate` (lowercase). The SDK passes both for cross-version safety. Not a bug — defensive coding.

---

## 9. Vue consumer pins old library version

```json
// kiwrious-measure-vue/package.json
"kiwrious-webserial": "1.0.20"
```

The library repo is at v1.0.21. One patch behind. Probably fine; worth refreshing on the next release pass.

---

## 10. UV decoder returns strings

`SerialUVDecoder` returns `.toFixed(0)` for Lux and `.toFixed(1)` for UV index — both **strings**. Other decoders (humidity, temperature v1) return numbers. Temperature v2 IR also returns a string (via `.toFixed(0)`).

**Recommendation:** consumers should `Number(value)` before doing arithmetic. Inconsistent return types would benefit from a normalisation pass in the decoder layer.

---

## 11. Vue app overlays conductivity status with chart-friendly numbers

When the library returns `{ status: 'MAX', value: 'MAX' }`, the Vue app replaces the value with the constant `200000` so its log-scale chart can render it. This is a **UI choice**, not part of the SDK contract — your app should branch on `status` instead.

---

## 12. VOC warm-up is client-side simulated

The 20-second warm-up is **not driven by a firmware signal**. The decoder runs a JavaScript timer that increments `dataReadyPercentage` at 5%/sec. The first non-zero VOC reading clears the timer and forces `READY`.

**Implication:** the warm-up timer fires whether the sensor is actually warming up or already stable. The percentage is purely cosmetic.

---

## What to do about it

For each item above:

- **Bugs (1, 4, 5)**: file as issues against the Scratch GUI fork.
- **Cleanup (7)**: remove duplicate case in `SerialDecoderFactory`.
- **Diffs (2, 3, 6)**: confirm with firmware team whether canonical behaviour should change in any project.
- **Drift (9)**: bump version pin.
- **Quirks (8, 10, 11, 12)**: document behaviour (this page).

This page is the canonical record. Update it when discrepancies are resolved.

---


<!-- ===== from: content/examples/basic.md ===== -->

# Basic example

A minimal HTML+JavaScript page that connects, reads, and displays live sensor data.

## Full source

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Kiwrious basic demo</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 640px; margin: 40px auto; padding: 0 20px; }
    button { padding: 10px 20px; margin-right: 8px; }
    .reading { background: #f5f5f7; padding: 16px; border-radius: 8px; margin-top: 16px; }
    .label { font-weight: 600; color: #6b7280; }
    .value { font-size: 28px; font-weight: 700; }
    .unit { color: #6b7280; }
  </style>
</head>
<body>
  <h1>Kiwrious sensor demo</h1>

  <button id="connect">Connect</button>
  <button id="disconnect">Disconnect</button>

  <div id="reading" class="reading">
    <p>Click Connect to pair a Kiwrious sensor.</p>
  </div>

  <script type="module">
    import serialService from './kiwrious-webserial.esm.js';

    const out = document.getElementById('reading');

    const formatters = {
      UV: (vals) => `
        <p><span class="label">Lux</span></p>
        <p class="value">${vals[0].value} <span class="unit">lx</span></p>
        <p><span class="label">UV index</span></p>
        <p class="value">${vals[1].value}</p>
      `,
      HUMIDITY: (vals) => `
        <p><span class="label">Temperature</span></p>
        <p class="value">${vals[0].value.toFixed(1)} <span class="unit">°C</span></p>
        <p><span class="label">Humidity</span></p>
        <p class="value">${vals[1].value.toFixed(1)} <span class="unit">%RH</span></p>
      `,
      TEMPERATURE: (vals) => {
        const ambient = Number(vals[0].value).toFixed(1);
        const ir = Number(vals[1].value).toFixed(1);
        return `
          <p><span class="label">Ambient</span></p>
          <p class="value">${ambient} <span class="unit">°C</span></p>
          <p><span class="label">Surface (IR)</span></p>
          <p class="value">${ir} <span class="unit">°C</span></p>
        `;
      },
      CONDUCTIVITY: (vals) => {
        const r = vals[0].value;
        return `
          <p><span class="label">Conductivity (${r.status})</span></p>
          <p class="value">${typeof r.value === 'number' ? r.value : r.value} <span class="unit">µS/cm</span></p>
        `;
      },
      VOC: (vals) => {
        const r = vals[0].value;
        if (r.status === 'PROCESSING') {
          return `<p>Warming up… ${r.dataReadyPercentage.toFixed(0)}%</p>`;
        }
        return `
          <p><span class="label">VOC</span></p>
          <p class="value">${r.value} <span class="unit">ppb</span></p>
        `;
      },
      HEART_RATE: (vals) => {
        const r = vals[0].value;
        if (r.status !== 'READY') return `<p>${r.status.toLowerCase().replace('_', ' ')}…</p>`;
        return `
          <p><span class="label">Heart rate</span></p>
          <p class="value">${r.value} <span class="unit">BPM</span></p>
        `;
      },
    };

    serialService.onSerialData = (reading) => {
      const fmt = formatters[reading.sensorType];
      if (fmt) out.innerHTML = fmt(reading.decodedValues);
    };

    serialService.onSerialConnection = (connected) => {
      if (!connected) out.innerHTML = '<p>Disconnected.</p>';
    };

    serialService.onFirmwareUpdateAvailable = (outdated) => {
      if (outdated) console.warn('Sensor firmware is out of date.');
    };

    document.getElementById('connect').onclick = () => serialService.connectAndReadAsync();
    document.getElementById('disconnect').onclick = () => serialService.disconnectAsync();
  </script>
</body>
</html>
```

## What's happening

1. The page imports `serialService` from a local copy of the ESM build.
2. It registers three callbacks before any user interaction.
3. On Connect, the SDK shows the OS port-picker; once the user chooses a Kiwrious device, the port opens at 230400 baud and the read loop starts.
4. Each frame fires `onSerialData`, which dispatches to a per-sensor formatter.
5. On Disconnect, the read loop exits cleanly.

## Run it locally

```bash
cd your-project/
npx http-server . -p 8080
open http://localhost:8080
```

Web Serial requires a secure context — `http://localhost` qualifies, as does any `https://` URL.

## Customise

- Replace the formatter logic with your own UI.
- Throttle high-frequency sensors (heart rate, conductivity) using a `setInterval` to avoid re-rendering 100 times per second.
- Persist readings to `localStorage`, IndexedDB, or stream to a server via `fetch`.
- Add a recording button — see [recording & CSV export](recording.md).

---


<!-- ===== from: content/examples/vue.md ===== -->

# Vue integration

Kiwrious's reference consumer is a Vue 2 app, [`kiwrious-measure-vue`](https://github.com/). Here's the integration pattern.

## Service module

Wrap the singleton in a service module:

```ts
// src/services/sensor.service.ts
import serialService from 'kiwrious-webserial/lib/service/SerialService';
import type { SensorReadResult }   from 'kiwrious-webserial/lib/data/SensorReadResult';
import { SENSOR_TYPE }             from 'kiwrious-webserial/lib/service/SerialRawValue';
import { VOC_RESULT_STATUS }       from 'kiwrious-webserial/lib/service/SerialVOCDecoder';
import { HEART_RATE_RESULT_STATUS } from 'kiwrious-webserial/lib/service/HeartRateProcessor';

export {
  serialService,
  SENSOR_TYPE,
  VOC_RESULT_STATUS,
  HEART_RATE_RESULT_STATUS,
};
export type { SensorReadResult };

export default serialService;
```

## Component

```ts
// src/components/Sensor/Sensor.ts
import Vue from 'vue';
import Component from 'vue-class-component';
import sensorService, {
  SENSOR_TYPE,
  VOC_RESULT_STATUS,
  HEART_RATE_RESULT_STATUS,
  SensorReadResult,
} from '@/services/sensor.service';

@Component
export default class Sensor extends Vue {
  isConnected = false;
  isReady = false;
  sensorType: string = SENSOR_TYPE.UNKNOWN;
  latestValues: any[] = [];

  mounted() {
    sensorService.onSerialData = (reading: SensorReadResult) => {
      this.sensorType = reading.sensorType;
      this.latestValues = reading.decodedValues;
      this.processValues();
    };
    sensorService.onSerialConnection = (connected: boolean) => {
      this.isConnected = connected;
      if (!connected) this.latestValues = [];
    };
    sensorService.onFirmwareUpdateAvailable = (outdated) => {
      if (outdated) this.$emit('firmware-outdated');
    };
  }

  beforeDestroy() {
    sensorService.onSerialData = undefined;
    sensorService.onSerialConnection = undefined;
    sensorService.onFirmwareUpdateAvailable = undefined;
  }

  async connect() {
    await sensorService.connectAndReadAsync();
  }

  async disconnect() {
    await sensorService.disconnectAsync();
  }

  processValues() {
    this.latestValues.forEach((el) => {
      if (el.type !== 'object') {
        this.isReady = true;
        return;
      }
      switch (el.label) {
        case 'Voc':
          this.isReady = el.value.status === VOC_RESULT_STATUS.READY;
          break;
        case 'HeartRate':
          this.isReady = el.value.status === HEART_RATE_RESULT_STATUS.READY;
          break;
        case 'Con':
          this.isReady = true;   // always ready, no warm-up
          break;
      }
    });
  }
}
```

## Template

```html
<template>
  <div class="sensor">
    <button v-if="!isConnected" @click="connect">Connect</button>
    <button v-else @click="disconnect">Disconnect</button>

    <div v-if="isConnected">
      <p>{{ sensorType }} {{ isReady ? '— Ready' : '— Warming up' }}</p>
      <ul>
        <li v-for="v in latestValues" :key="v.label">
          {{ v.label }}: {{ formatValue(v) }}
        </li>
      </ul>
    </div>
  </div>
</template>
```

## Decoupling read rate from render rate

The SDK can deliver up to ~900 Hz of frames. Most UIs don't need to update that fast. The reference Vue app uses a separate `setInterval` chart updator:

```ts
let chartUpdator: number | null = null;
let UPDATE_INTERVAL = 1000;   // ms

mounted() {
  sensorService.onSerialData = (reading) => {
    this.latestValues = reading.decodedValues;     // update frequently
  };
  sensorService.onSerialConnection = (connected) => {
    if (connected) {
      chartUpdator = window.setInterval(() => {
        this.$refs.chart.appendPoint(this.latestValues);
      }, UPDATE_INTERVAL);
    } else if (chartUpdator) {
      clearInterval(chartUpdator);
    }
  };
}
```

This keeps the chart smooth without re-rendering on every frame.

## Vuex / Pinia store

For larger apps, dispatch readings to a store:

```ts
sensorService.onSerialData = (reading) => {
  this.$store.commit('sensor/setReading', reading);
};
```

The store can then derive computed properties (rolling averages, alarms, recording state) without coupling them to the component.

## Auto-save on disconnect

A nice-to-have pattern from the reference app: auto-save any in-progress recording when the sensor unplugs.

```ts
sensorService.onSerialConnection = (connected) => {
  if (!connected && this.isRecording) {
    this.isRecording = false;
    this.saveRecording();
  }
};
```

---


<!-- ===== from: content/examples/scratch.md ===== -->

# Scratch (block) integration

The Kiwrious Scratch GUI fork (in `scratch-gui/`) ships an extension that exposes Kiwrious sensors as Scratch blocks for block-based programming.

> {warn}
> **The Scratch GUI is not a consumer of the SDK.** It reimplements the serial protocol inline. It also has [several known discrepancies](../advanced/discrepancies.md) — most notably, it uses **115200 baud** rather than the canonical **230400**, and it does not support heart rate. These notes describe how the Scratch extension currently behaves; for new integrations, prefer the SDK.

## Extension metadata

| Field | Value |
|---|---|
| Extension ID | `kiwrious` |
| Display name | `Kiwrious` |
| Colour | `#F85708` |
| Class | `Scratch3Kiwrious` |

## Block opcodes

### Commands

| Opcode | Block text |
|---|---|
| `connect` | "Connect" |
| `readForever` | "Read Forever" |
| `freezeReading` | "Freeze Reading" |
| `unfreezeReading` | "Unfreeze Reading" |

### Booleans

| Opcode | Block text |
|---|---|
| `isSensorValue` | "[SENSOR_ANY] [OP] [VALUE]" |
| `isReadingAlternating` | "is [SENSOR] [increasing/decreasing]?" |

### Reporters

| Opcode | Block text | Unit | Sensor |
|---|---|---|---|
| `getHumidity` | Humidity (%) | %RH | HUMIDITY |
| `getTemperature` | Ambient Temperature (°C) | °C | HUMIDITY or TEMPERATURE |
| `getIRTemperature` | Infrared Temperature (°C) | °C | TEMPERATURE |
| `getResistance` | Resistance (Ω) | Ω | CONDUCTIVITY |
| `getConductance` | Conductance (µS) | µS | CONDUCTIVITY |
| `getLux` | Lux | lx | UV / UV2 |
| `getUV` | UV | index | UV / UV2 |
| `getTVOC` | tVOC (ppb) | ppb | VOC |
| `getCO2eq` | CO2eq (ppm) | ppm | VOC |

> {info}
> The Scratch extension exposes both `tVOC` (bytes 6–7) and `CO2eq` (bytes 8–9) for VOC. The canonical SDK only surfaces a single VOC value. The CO2eq decoding *may* be valid firmware data that the SDK ignores — verify with the firmware team.

## Configuration constants

```js
const FILTERS = {
  filters: [
    { usbVendorId: 0x04d8, usbProductId: 0xec19 },
    { usbVendorId: 0x0d28, usbProductId: 0x0204 }
  ]
};

const BAUD_RATE          = 115200;   // ❌ should be 230400
const PACKET_HEADER_BYTE = 0x0a;
const PACKET_FOOTER_BYTE = 0x0b;
const KIWRIOUS_RX_LENGTH = 26;
const MAX_RETRY_TIME     = 128;
```

## Header / footer validation

Unlike the SDK (which slices strictly by 26-byte boundaries), the Scratch extension validates the header and footer bytes:

```js
if (sensorData[0] !== PACKET_HEADER_BYTE || sensorData[1] !== PACKET_HEADER_BYTE) {
  // resync — discard one byte and retry up to MAX_RETRY_TIME times
}
if (sensorData[24] !== PACKET_FOOTER_BYTE || sensorData[25] !== PACKET_FOOTER_BYTE) {
  // resync
}
```

This is more defensive than the SDK's behaviour. The trade-off is robustness vs. simplicity.

## Increasing / decreasing flags

The extension tracks per-sensor monotonicity flags:

```
_isHumidityIncreasing,  _isHumidityDecreasing
_isTemperatureIncreasing, _isTemperatureDecreasing
_isIRTemperatureIncreasing, _isIRTemperatureDecreasing
_isResistanceIncreasing, _isResistanceDecreasing
_isConducatanceIncreasing, _isConducatanceDecreasing   ← typo: "Conducatance"
_isLuxIncreasing, _isLuxDecreasing
_isUvIncreasing, _isUvDecreasing
_isVocIncreasing, _isVocDecreasing
_isCo2Increasing, _isCo2Decreasing
```

These power the `isReadingAlternating` boolean block.

> {bug}
> `_isConducatanceIncreasing` is set twice in the conductance decoder (one of those assignments was clearly meant for the decreasing flag). The "is conductance decreasing?" block always reflects the increasing result. See [discrepancies #4](../advanced/discrepancies.md).

## Freeze / unfreeze

Setting `connectivityHandler.isFreezeEnabled = true` causes the decoder to hold the last value and report `_isXxxIncreasing/Decreasing = false`. Useful for snapshot lessons.

## Recommendation for new Scratch integrations

If you're building a new Scratch extension or block environment, **prefer the SDK**: it gives you the canonical serial layer plus heart-rate support. Wrap `serialService` in your extension and forward decoded values to your block runtime.

```js
import serialService from 'kiwrious-webserial';

class KiwriousExtension {
  constructor() {
    this.lastReading = null;
    serialService.onSerialData = (r) => { this.lastReading = r; };
  }

  connect() { return serialService.connectAndReadAsync(); }

  getHumidity() {
    if (this.lastReading?.sensorType !== 'HUMIDITY') return 0;
    return this.lastReading.decodedValues[1].value;
  }
  // ... etc
}
```

---


<!-- ===== from: content/examples/recording.md ===== -->

# Recording & CSV export

A common pattern: record a stream of sensor readings, then export to CSV. The reference Vue app implements this end-to-end.

## Minimal recording loop

```js
let isRecording = false;
let buffer = [];

document.querySelector('#start').onclick = () => {
  buffer = [];
  isRecording = true;
};
document.querySelector('#stop').onclick = () => {
  isRecording = false;
  exportCsv(buffer);
};

serialService.onSerialData = (reading) => {
  if (!isRecording) return;
  buffer.push({
    timestamp: new Date().toISOString(),
    sensorType: reading.sensorType,
    values: reading.decodedValues,
  });
};
```

## CSV export

```js
function exportCsv(samples) {
  if (!samples.length) return;

  // Determine columns from the first sample
  const labels = samples[0].values.map((v) => v.label);
  const header = ['timestamp', 'sensorType', ...labels];

  const rows = samples.map((s) => {
    const map = Object.fromEntries(s.values.map((v) => [v.label, valueToCell(v)]));
    return [s.timestamp, s.sensorType, ...labels.map((l) => map[l] ?? '')];
  });

  const csv = [header, ...rows]
    .map((row) => row.map(escapeCsv).join(','))
    .join('\n');

  download(csv, 'kiwrious-recording.csv');
}

function valueToCell(v) {
  if (typeof v.value === 'object' && v.value !== null) {
    return v.value.value ?? v.value.status ?? '';
  }
  return v.value;
}

function escapeCsv(s) {
  const str = String(s);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function download(text, filename) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
```

## Sample-rate control

To record at a fixed rate (e.g., 1 Hz, 2 Hz, 5 Hz) regardless of the sensor's native frequency, use a `setInterval` to sample the latest reading:

```js
let latest = null;
let recorder = null;

serialService.onSerialData = (r) => { latest = r; };

document.querySelector('#start').onclick = () => {
  buffer = [];
  recorder = setInterval(() => {
    if (latest) buffer.push({
      timestamp: new Date().toISOString(),
      sensorType: latest.sensorType,
      values: latest.decodedValues,
    });
  }, 1000);   // 1 Hz
};
document.querySelector('#stop').onclick = () => {
  clearInterval(recorder);
  exportCsv(buffer);
};
```

The reference Vue app exposes a dropdown with these rates:

| Rate | Interval |
|---|---|
| 1 sample / minute | 60,000 ms |
| 1 sample / 30 s | 30,000 ms |
| 1 sample / 5 s | 5,000 ms |
| 1 sample / sec | 1,000 ms |
| 2 samples / sec | 500 ms |
| 5 samples / sec | 200 ms |

## Auto-save on disconnect

If the sensor unplugs mid-recording, save what you have:

```js
serialService.onSerialConnection = (connected) => {
  if (!connected && isRecording) {
    isRecording = false;
    exportCsv(buffer);
  }
};
```

## Computing min / max / average

The reference Vue app annotates the CSV with summary statistics per observable. Useful for science class:

```js
function summarize(samples, label) {
  const nums = samples
    .map((s) => valueToCell(s.values.find((v) => v.label === label)))
    .map(Number)
    .filter(Number.isFinite);

  if (!nums.length) return null;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  return { min, max, avg };
}
```

Append a summary block at the top of the CSV (or as a separate sheet) before exporting.

## Time deltas

Two timestamp formats are useful:

- **Absolute** — wall clock (`new Date().toISOString()`)
- **Relative** — seconds since recording started (`(now - start) / 1000`)

The reference app emits both columns. Relative time is friendlier for plotting in Excel.

```js
const start = performance.now();
buffer.push({
  abs: new Date().toISOString(),
  rel: ((performance.now() - start) / 1000).toFixed(3),
  // ...
});
```

---

