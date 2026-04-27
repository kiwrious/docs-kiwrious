# Heart rate sensor

The most complex sensor in the family. Two firmware versions use **completely different algorithms**:

- **v1** — DSP pipeline in JavaScript: cascaded Biquad filters → FFT → peak detection
- **v2** — ARM Thumb firmware emulated via Unicorn (WASM)

## Quick reference

| Field | v1 | v2 |
|---|---|---|
| Type byte | `5` | `10` |
| `sensorType` | `'HEART_RATE'` | `'HEART_RATE'` |
| Decoder type | `HEART_RATE` | `HEART_RATE2` |
| Reader | `SingleValueReader` (1 frame) | `TenValuesReader` (10 frames) |
| Algorithm | Bandpass + FFT + averaging | Proprietary, ARM-emulated |
| Outputs | BPM | BPM, trust level, SNR |

---

## Heart rate v1 (DSP pipeline)

### Frame layout

| Offset | Size | Type | Field |
|---|---|---|---|
| 6 | 4 | uint32 LE | sample 0 |
| 10 | 4 | uint32 LE | sample 1 |
| 14 | 4 | uint32 LE | sample 2 |
| 18 | 4 | uint32 LE | sample 3 |

Each frame contains four PPG samples. The decoder feeds them to `HeartRateProcessor.processMultiInput()`.

### Pipeline

```
                     ┌──────────────────────┐
   uint32 samples ── │  Range check         │
                     │  300,000 ≤ x ≤ 900,000│
                     └──────────┬───────────┘
                                ▼
                     ┌──────────────────────┐
                     │  Mean centering      │
                     └──────────┬───────────┘
                                ▼
                     ┌──────────────────────┐
                     │  8-stage cascaded    │
                     │  Biquad bandpass     │
                     │  (~0.5–3 Hz / 30–180 BPM) │
                     └──────────┬───────────┘
                                ▼
                     ┌──────────────────────┐
                     │  2048-sample FFT     │
                     │  @ 200 Hz sample rate│
                     └──────────┬───────────┘
                                ▼
                     ┌──────────────────────┐
                     │  Peak frequency × 60 │
                     │  → BPM               │
                     └──────────┬───────────┘
                                ▼
                     ┌──────────────────────┐
                     │  Rolling mean of 100 │
                     │  → output BPM        │
                     └──────────────────────┘
```

### Constants

```ts
const SAMPLE_RATE       = 200;       // Hz
const INPUT_ARRAY_SIZE  = 2048;      // ~10.24 s at 200 Hz
const RESULT_ARRAY_SIZE = 100;       // averaging window
const MIN_INPUT_VALUE   = 300_000;   // ~3.0 normalised PPG amplitude
const MAX_INPUT_VALUE   = 900_000;   // ~9.0 normalised PPG amplitude
```

Inputs outside `[300000, 900000]` produce `TOO_LOW` or `TOO_HIGH` status — the FFT requires the finger to be cleanly on the sensor.

### Output

```ts
{
  status: 'PROCESSING' | 'READY' | 'TOO_LOW' | 'TOO_HIGH',
  value: number | null,    // BPM when READY
}
```

`PROCESSING` means accumulating samples — the first reading takes ~10 seconds (2048 samples at 200 Hz) plus 100 additional FFT outputs to fill the rolling-mean window.

> {info}
> The Biquad filter delay-line is initialised to `[1, 1, 1]` rather than zeros — non-standard but stable; the transient settles within milliseconds.

---

## Heart rate v2 (ARM emulator)

### Frame layout

The reader accumulates **10 consecutive 26-byte frames** before invoking the decoder. Each frame contributes 16 bytes of PPG data (offsets 6–21), giving 160 bytes total.

### Touch detection

A min-value threshold check on the **first** frame's bytes 6–9 (uint32) gates the algorithm:

```ts
LOW_THRESHOLD  = 1e5;   // 100,000  — below this = no touch
HIGH_THRESHOLD = 2e6;   // 2,000,000 — must exceed this to trigger
// Hysteresis: once triggered, must drop below LOW to reset
```

If the value is below the threshold, the decoder returns `status: 'TOO_LOW'` without invoking the emulator.

### Emulator pipeline

The 160-byte input feeds an ARM Thumb-mode binary (`prog.bin`) running in the Unicorn CPU emulator (compiled to WebAssembly).

```
┌─────────────────────────────────────────────────────────────┐
│  Unicorn ARM emulator (libunicorn_out.wasm)                 │
│                                                             │
│   Memory layout:                                            │
│     0x008000  ← prog.bin (firmware code)                    │
│     0x00800c  ← main entry point (Thumb mode, OR with 1)    │
│     0x008014  ← exit/return address                         │
│     0x200000  ← stack pointer                               │
│     0x380000  ← input buffer (160 bytes)                    │
│     0x3F0000  ← output buffer (16 bytes)                    │
│     0x400000  ← total RAM                                   │
│                                                             │
│   1. Write 160-byte input to 0x380000                       │
│   2. Set SP = 0x200000, PC = 0x0800c | 1 (Thumb)            │
│   3. uc_emu_start(...) until 0x8014                         │
│   4. Read 16 bytes from 0x3F0000                            │
└─────────────────────────────────────────────────────────────┘
```

### Output buffer layout

| Offset | Size | Type | Field |
|---|---|---|---|
| 0 | 4 | uint32 LE | status code |
| 4 | 4 | uint32 LE | heart rate (BPM) |
| 8 | 4 | uint32 LE | trust level |
| 12 | 4 | uint32 LE | SNR |

### Status code mapping

| Raw code | `status` |
|---|---|
| `0` | `PROCESSING` |
| `4` | `TOO_LOW` |
| `48` | `READY` |

### Hysteresis

The decoder applies a post-filter to prevent UI flicker: if the previous status was `READY` and the new one is `PROCESSING`, force `READY`.

```ts
if (previousStatus === 'READY' && currentStatus === 'PROCESSING') {
  result.status = 'READY';   // hold steady
}
```

### Output

```ts
{
  status: 'PROCESSING' | 'READY' | 'TOO_LOW',
  value: number,         // BPM
  trustlevel: number,    // 0..100
  snr: number,           // signal-to-noise
}
```

### Why an emulator?

The proprietary heart-rate detection algorithm is shipped as compiled ARM Thumb. Re-implementing it in JavaScript would require reverse-engineering. The Unicorn-on-WASM approach lets the SDK execute the firmware verbatim, with full fidelity to whatever the hardware would compute.

The trade-off is bundle size:

| Asset | Size |
|---|---|
| `libunicorn_out.wasm` | ~770 KB |
| `libunicorn_out.js` | ~76 KB |
| `unicorn-wrapper.js` | ~22 KB |
| `unicorn-constants.js` | ~63 KB |
| `prog.bin` | varies (typ. 100–200 KB) |
| **Total** | **~1 MB** |

This payload is only loaded if the user actually plugs in a v2 heart rate sensor.

---

## Reading (both versions)

```js
import { HEART_RATE_RESULT_STATUS } from 'kiwrious-webserial/lib/service/HeartRateProcessor';

serialService.onSerialData = (reading) => {
  if (reading.sensorType !== 'HEART_RATE') return;
  const v = reading.decodedValues[0].value;

  switch (v.status) {
    case HEART_RATE_RESULT_STATUS.READY:
      console.log(`${v.value} BPM`);
      if ('trustlevel' in v) console.log(`Trust ${v.trustlevel}%, SNR ${v.snr}`);
      break;
    case HEART_RATE_RESULT_STATUS.PROCESSING:
      console.log('Acquiring pulse…');
      break;
    case HEART_RATE_RESULT_STATUS.TOO_LOW:
      console.log('Place finger firmly on sensor');
      break;
    case HEART_RATE_RESULT_STATUS.TOO_HIGH:
      console.log('Sensor saturated (v1 only)');
      break;
  }
};
```

## Source files

- `src/decoder/SerialHeartRateDecoder.ts` — v1
- `src/decoder/SerialHeartRate2Decoder.ts` — v2 wrapper
- `src/processing/HeartRateProcessor.ts` — v1 DSP pipeline
- `src/lib/heartrate.js` — v2 emulator orchestrator
- `src/lib/libunicorn_out.{js,wasm}` — Unicorn ARM emulator
- `src/lib/prog.bin` — compiled ARM Thumb firmware
