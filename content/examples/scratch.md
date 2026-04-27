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
