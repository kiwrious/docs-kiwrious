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
