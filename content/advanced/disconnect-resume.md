# Disconnect & resume

How the SDK handles unplugs, browser tab changes, and reconnection.

## Graceful disconnect

When you call `serialService.disconnectAsync()`:

```ts
async disconnectAsync(): Promise<void> {
  this._isReading = false;        // 1. Tell the read loop to exit

  if (this._reader) {              // 2. Cancel + release the reader
    await this._reader.cancel();
    this._reader.releaseLock();
    this._reader = null;
  }

  if (this._port) {                // 3. Close the port
    setTimeout(async () => {
      await this._port.close();
      // NOTE: this._port = null is intentionally NOT set
      // so that resumeReading() can reuse it.
    }, 0);
  }

  this._isConnected = false;
  this.onSerialConnection?.(false);
}
```

The `setTimeout(..., 0)` yields to the event loop so the read loop has a chance to finish its current iteration before the port closes. Without it, you can race into `port.close()` while a `reader.read()` is still in flight.

> {info}
> The `_port` reference is **intentionally retained** — even after a clean disconnect. This enables `resumeReading()` to skip the port-picker. The original code has a comment marking this: *"DO NOT UNCOMMECNT"* (sic).

## Abrupt disconnect (USB unplug)

`navigator.serial.ondisconnect` fires when the device is physically removed:

```ts
serial.ondisconnect = async () => {
  await this.disconnectAsync();
  this._port = null;     // here we DO null it — the port is gone
};
```

In this case `canResumeReading` becomes `false`; the user must re-pair via `connectAndReadAsync()`.

## Resume

```ts
async resumeReading(): Promise<void> {
  if (!this._port) {
    // No retained port → fall through to a fresh connection
    await this.connectAndReadAsync();
    return;
  }
  // Skip stage 1 (port picker), go straight to opening it
  await this.startStage2ConnectPortAsync(this._port);
}
```

Use it like this:

```js
async function reconnect() {
  if (serialService.canResumeReading) {
    await serialService.resumeReading();
  } else {
    await serialService.connectAndReadAsync();
  }
}
```

This pattern gives the user a "Reconnect" button that doesn't bother them with the OS port picker on every disconnect.

## State diagram

```
                          ┌──────────────┐
              ┌──────────►│  Connected   │◄──────────┐
              │           │  + Reading   │           │
   connect    │           └──────┬───────┘           │
              │                  │                   │
              │                  │ disconnectAsync() │
              │                  │ or USB unplug     │
              │                  ▼                   │
              │           ┌──────────────┐           │
              └───────────│  Disconnected│           │
                          │  (port held) │           │
                          └──────┬───────┘           │
                                 │ resumeReading()   │
                                 └───────────────────┘

   USB unplug clears _port → state becomes
   "Disconnected, port lost" → must call connectAndReadAsync().
```

## Recording auto-save on disconnect

The `kiwrious-measure-vue` app auto-saves any in-progress recording when `onSerialConnection(false)` fires:

```js
serialService.onSerialConnection = (connected) => {
  if (!connected && this.isRecording) {
    this.isRecording = false;
    this.saveRecording();
  }
};
```

This is a consumer-app convention, not part of the SDK contract — but a good pattern to copy.

## Why callbacks fire on disconnect

`onSerialConnection(false)` always fires after a graceful or abrupt disconnect. There is no separate "lost" callback. Distinguish via `canResumeReading`:

| `connected` | `canResumeReading` | Meaning |
|---|---|---|
| `false` | `true` | Disconnect, port retained — can resume |
| `false` | `false` | Disconnect, port lost — must re-pair |
