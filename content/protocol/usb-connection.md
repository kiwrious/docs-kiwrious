# USB connection

How the SDK opens a Kiwrious device using `navigator.serial`.

## Vendor ID filters

The SDK calls `navigator.serial.requestPort()` with two filters:

```ts
{
  filters: [
    { usbVendorId: 0x04d8, vendorId: 0x04d8 },          // Microchip Technology
    { usbVendorId: 0x0d28, usbProductId: 0x0204 }       // ARM mbed (CMSIS-DAP)
  ]
}
```

| Vendor ID | Manufacturer | Notes |
|---|---|---|
| `0x04d8` | Microchip Technology | Primary Kiwrious devices (PIC18F-class MCUs). All product IDs accepted. |
| `0x0d28` | ARM Holdings (mbed) | Cortex-M0 platform; only PID `0x0204` accepted. |

> {info}
> Both `usbVendorId` and the legacy `vendorId` keys are passed for the Microchip filter — historical browser API differences. Either is honoured by current Chromium.

## Port settings

After the user selects a port, the SDK opens it with:

```ts
await port.open({ baudrate: 230400, baudRate: 230400 });
```

| Parameter | Value | Notes |
|---|---|---|
| Baud rate | 230400 | Both spellings (`baudrate` / `baudRate`) are passed for cross-browser safety |
| Data bits | 8 | Web Serial default — not set explicitly |
| Stop bits | 1 | Web Serial default |
| Parity | none | Web Serial default |
| Flow control | none | Web Serial default |

> {warn}
> The Scratch GUI fork uses **115200 baud** with a different filter. That is not the canonical configuration — see [discrepancies](../advanced/discrepancies.md).

## Connection lifecycle

```
┌─ User clicks "Connect" ──────────────────────────────┐
│                                                      │
│  ① navigator.serial.requestPort(filters)             │
│      └─→ OS port-picker dialog                       │
│                                                      │
│  ② port.open({ baudRate: 230400 })                   │
│                                                      │
│  ③ port.readable.getReader()                         │
│                                                      │
│  ④ Read first 26-byte frame                          │
│      → Detect sensor type from byte 2                │
│      → Pick decoder via SerialDecoderFactory         │
│      → Compare firmware version vs. LATEST_*         │
│                                                      │
│  ⑤ onSerialConnection(true)                          │
│      onFirmwareUpdateAvailable(outdated?)            │
│                                                      │
│  ⑥ Loop: read → decode → onSerialData(...)           │
│                                                      │
└──────────────────────────────────────────────────────┘
```

## Reconnection

The SDK retains the `SerialPort` reference even after disconnect, so a previously-paired device can be resumed without re-prompting the user:

```ts
if (serialService.canResumeReading) {
  await serialService.resumeReading();   // Skip the port-picker
} else {
  await serialService.connectAndReadAsync();   // Show the picker
}
```

See [disconnect & resume](../advanced/disconnect-resume.md).

## OS-level events

The SDK installs `navigator.serial.onconnect` and `onserial.ondisconnect` handlers:

- `onconnect` — currently logged but no further action (manual reconnection required)
- `ondisconnect` — calls `disconnectAsync()` automatically and clears the internal `_port` reference

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| "Port is already readable" | A previous reader was not released. Call `disconnectAsync()` first. |
| Port picker shows no devices | Wrong USB VID/PID, missing driver on Windows, USB hub power issue, or sensor not powered. |
| `requestPort()` rejects | User cancelled the dialog. |
| `onSerialData` never fires | Sensor is producing fragmented packets — buffered internally, but check that bytes 0–1 are the expected header. |

## Source references

- `SerialService.connectAndReadAsync()` — open + read entry point
- `SerialService.startStage1RequestPortAsync()` — `navigator.serial.requestPort()`
- `SerialService.startStage2ConnectPortAsync()` — `port.open()` and reader setup
- `SerialService.startReading()` — read loop
