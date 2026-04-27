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
