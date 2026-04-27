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
