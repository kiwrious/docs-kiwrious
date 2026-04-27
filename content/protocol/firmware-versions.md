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
