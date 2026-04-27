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
