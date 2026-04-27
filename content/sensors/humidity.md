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
