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
