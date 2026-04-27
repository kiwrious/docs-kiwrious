# Event callbacks

`SerialService` exposes three optional callbacks. All are simple property assignments (no `addEventListener`-style API).

## `onSerialData`

Fires once per decoded sensor reading. The most frequent callback — typically 50–900 Hz depending on sensor.

```ts
onSerialData?: (data: SensorReadResult) => void;
```

```ts
interface SensorReadResult {
  sensorType: SENSOR_TYPE;            // 'UV' | 'HUMIDITY' | 'TEMPERATURE' | ...
  decodedValues: SensorDecodedValue[];
}

interface SensorDecodedValue {
  type: 'number' | 'object';
  label: string;                      // 'Temp' | 'Hum' | 'Lux' | ...
  value: number | string | object;    // shape depends on label
}
```

```js
serialService.onSerialData = (reading) => {
  console.log(reading.sensorType, reading.decodedValues);
};
```

See [interfaces](interfaces.md) for full payload shapes per sensor.

## `onSerialConnection`

Fires when the connection state changes.

```ts
onSerialConnection?: (connected: boolean) => void;
```

- `true` — fired after the first successful frame read (i.e., the connection is fully alive)
- `false` — fired after a graceful or abrupt disconnect

```js
serialService.onSerialConnection = (connected) => {
  setUiState(connected ? 'reading' : 'idle');
};
```

> {info}
> `connected: true` means **reading**, not just port-opened. Until the first frame decodes, the user might still see a stalled state.

## `onFirmwareUpdateAvailable`

Fires once per connection, after the first frame is decoded, if the firmware is older than `LATEST_SENSOR_VERSION`.

```ts
onFirmwareUpdateAvailable?: (outdated: boolean) => void;
```

```js
serialService.onFirmwareUpdateAvailable = (outdated) => {
  if (outdated) showFirmwareUpdateBanner();
};
```

See [firmware versions](../protocol/firmware-versions.md).

## Setting and clearing

Because callbacks are plain properties, you can clear them by assigning `undefined`:

```js
serialService.onSerialData = undefined;
serialService.onSerialConnection = undefined;
serialService.onFirmwareUpdateAvailable = undefined;
```

In React effect cleanup or Vue `beforeUnmount`, this prevents stale callbacks holding references to unmounted components.

## Throttling

The SDK does not throttle. A heart-rate sensor can deliver up to ~900 Hz of frames in theory; in practice 50–100 Hz is common. If your UI cannot render that fast, throttle in your callback:

```js
let lastUpdate = 0;
serialService.onSerialData = (reading) => {
  const now = performance.now();
  if (now - lastUpdate < 100) return;   // 10 Hz throttle
  lastUpdate = now;
  renderUi(reading);
};
```

`kiwrious-measure-vue` uses a separate `setInterval`-driven chart updator so reading rate and UI refresh rate are decoupled.
