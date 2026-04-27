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
