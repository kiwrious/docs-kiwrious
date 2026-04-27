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
