# SerialService

The singleton entry point. The SDK's default export is a single shared `SerialService` instance.

```ts
import serialService from 'kiwrious-webserial';
```

## Methods

### `connectAndReadAsync()`

Prompts the user to select a Kiwrious device and starts the read loop.

```ts
async connectAndReadAsync(): Promise<void>
```

- Calls `navigator.serial.requestPort({ filters: [...] })` — shows the OS port-picker.
- Opens the selected port at 230400 baud.
- Reads the first 26-byte frame to detect sensor type.
- Selects the appropriate decoder via `SerialDecoderFactory`.
- Loops: read → decode → invoke `onSerialData`.
- Fires `onSerialConnection(true)` after the first successful read.

```js
document.querySelector('#connect').onclick = () => {
  serialService.connectAndReadAsync();
};
```

### `resumeReading()`

Resume reading from a previously-opened port without re-prompting the user.

```ts
async resumeReading(): Promise<void>
```

If `_port` is still retained internally (the SDK does **not** null it on disconnect), this skips the port-picker and re-opens the same port. Otherwise it falls back to `connectAndReadAsync()`.

```js
if (serialService.canResumeReading) {
  await serialService.resumeReading();
} else {
  await serialService.connectAndReadAsync();
}
```

### `disconnectAsync()`

Stop the read loop, release the reader, close the port.

```ts
async disconnectAsync(): Promise<void>
```

Steps:
1. Sets `_isReading = false` so the read loop exits naturally on the next iteration.
2. Cancels any in-flight `reader.read()`.
3. Releases the reader's lock.
4. Calls `port.close()`.
5. Fires `onSerialConnection(false)`.
6. **Retains** the `_port` reference (intentionally — for `resumeReading`).

> {info}
> The disconnect is wrapped in `setTimeout(..., 0)` to yield to the event loop and let the read loop finish gracefully before closing.

### `triggerStopReading()`

Sets `_isReading = false` without closing the port. Rarely needed — `disconnectAsync` covers most cases.

```ts
triggerStopReading(): void
```

## Properties

### `isReading: boolean`

`true` while the read loop is active.

### `canResumeReading: boolean`

`true` if a `_port` reference is still held internally (i.e., the user previously paired a device and disconnect was clean).

## Internal pipeline

```
connectAndReadAsync()
   ├─ startStage1RequestPortAsync()    ← navigator.serial.requestPort()
   └─ startStage2ConnectPortAsync(port)
        ├─ port.open({ baudRate: 230400 })
        ├─ port.readable.getReader()
        └─ startReading(reader)
             ├─ Read first 26-byte frame
             ├─ SerialDecoderFactory.createDecoder(decoderType)
             ├─ SerialDecoderFactory.createValueReader(decoderType)
             ├─ onSerialConnection(true)
             ├─ onFirmwareUpdateAvailable(rawValue.isFirmwareOutdated)
             └─ while (_isReading) {
                  const raw = await valueReader.readValue(reader);
                  const decoded = await decoder.decode(raw);
                  if (decoded) onSerialData(decoded);
                }
```

## Singleton pattern

`SerialService` is exported as a default-instance singleton:

```ts
// SerialService.ts (simplified)
const serialService = new SerialService();
export default serialService;
```

The same instance is shared across all imports — there is no class constructor to call yourself. This means callbacks set in one module are visible to all others; design accordingly.

## Typical lifecycle

```js
// Set callbacks once, at module load
serialService.onSerialData = (reading) => store.dispatch('reading', reading);
serialService.onSerialConnection = (c) => store.dispatch('connection', c);
serialService.onFirmwareUpdateAvailable = (out) => store.dispatch('firmware', out);

// User clicks Connect
await serialService.connectAndReadAsync();

// ... reads come in via onSerialData ...

// User clicks Disconnect
await serialService.disconnectAsync();

// Later: reconnect without prompt
if (serialService.canResumeReading) {
  await serialService.resumeReading();
}
```

See [callbacks](callbacks.md) for the full set of events and their payloads.
