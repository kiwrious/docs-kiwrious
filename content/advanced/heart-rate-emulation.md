# ARM emulator pipeline (heart rate v2)

Deep dive into the v2 heart rate sensor's runtime — a Unicorn-on-WebAssembly ARM Thumb emulator running a proprietary firmware blob.

## Why an emulator?

The Kiwrious heart rate detection algorithm is implemented as compiled ARM Thumb code (`prog.bin`). Rather than re-implement it in JavaScript — which would require reverse-engineering and risk drift between platforms — the SDK executes the firmware verbatim using the [Unicorn](https://www.unicorn-engine.org/) CPU emulator, compiled to WebAssembly.

## Asset payload

The v2 heart rate runtime requires these files to be hosted alongside your page:

| File | Source | Approx size |
|---|---|---|
| `libunicorn_out.js` | Emscripten wrapper | 76 KB |
| `libunicorn_out.wasm` | Compiled Unicorn engine | 770 KB |
| `unicorn-wrapper.js` | High-level emulator API | 22 KB |
| `unicorn-constants.js` | ARM register / mode constants | 63 KB |
| `libelf-integers.js` | Integer helpers | 5.8 KB |
| `heartrate.js` | Orchestrator (`HeartRateDetector`) | 2 KB |
| `prog.bin` | ARM Thumb firmware | varies |

These are bundled in `dist/js/` after `npm run build`.

## Memory map

```
 0x000000 ┌────────────────────────────┐
          │   (low memory, unused)     │
 0x008000 ├────────────────────────────┤  ← TEXT_START_ADDRESS
          │                            │
          │   prog.bin firmware code   │
          │                            │
          │   Entry: 0x0800c | 1       │  ← MAIN_ADDRESS (Thumb mode)
          │   Exit:  0x008014          │  ← EXIT_ADDRESS
          │                            │
 0x200000 ├────────────────────────────┤  ← STACK_ADDRESS
          │                            │
          │   ARM stack                │
          │                            │
 0x380000 ├────────────────────────────┤  ← INPUT_ADDRESS
          │                            │
          │   Input buffer (160 bytes) │
          │   = 10 frames × 16 bytes   │
          │                            │
 0x3F0000 ├────────────────────────────┤  ← RETURN_ADDRESS
          │                            │
          │   Output buffer (16 bytes) │
          │                            │
 0x400000 └────────────────────────────┘  ← RAM_SIZE = 4 MiB
```

## Execution flow

```js
// Pseudocode of HeartRateDetector.detect(input160bytes)
async function detect(input) {
  // 1. Allocate emulator if not yet created
  if (!uc) {
    uc = new Unicorn();
    uc.open('arm');
    uc.mem_map(0, 0x400000, ALL);
    uc.mem_write(0x008000, await fetch('js/prog.bin').then(r => r.arrayBuffer()));
  }

  // 2. Write 160 bytes of PPG input
  uc.mem_write(0x380000, input);

  // 3. Reset registers, set SP and PC
  uc.reg_write('SP', 0x200000);
  uc.reg_write('PC', 0x0800c | 1);   // bit 0 = Thumb mode

  // 4. Execute until exit
  uc.emu_start(0x0800c | 1, 0x008014);

  // 5. Read 16-byte result
  const out = uc.mem_read(0x3F0000, 16);
  const dv = new DataView(out.buffer);
  return {
    status:    dv.getUint32(0,  true),
    value:     dv.getUint32(4,  true),
    trustlevel: dv.getUint32(8,  true),
    snr:       dv.getUint32(12, true),
  };
}
```

## Status code mapping

The firmware returns a status code in the first uint32 of the output buffer. The decoder maps these to the public enum:

| Raw uint32 | `HEART_RATE_RESULT_STATUS` |
|---|---|
| `0` | `PROCESSING` |
| `4` | `TOO_LOW` |
| `48` | `READY` |

Other values are not currently observed in the wild and will surface as-is.

## Performance characteristics

| Phase | Cost |
|---|---|
| First-time emulator init | ~50–150 ms (WASM compile + memory map + firmware load) |
| Per-frame detection | ~5–15 ms (depends on host CPU) |
| Total payload | ~1 MB |

Subsequent detections reuse the warm emulator — only the input buffer is rewritten.

## Why hysteresis?

The firmware can transiently emit `PROCESSING` even while a steady pulse is being detected. To smooth the UX, the decoder applies a post-filter: if previous status was `READY` and the next is `PROCESSING`, override to `READY`.

```ts
if (last.status === 'READY' && current.status === 'PROCESSING') {
  current.status = 'READY';
}
```

## Failure modes

- **Firmware blob 404** — `prog.bin` not hosted next to `heartrate.js`. Check your dist setup.
- **WASM not supported** — Unicorn requires WebAssembly. All Web Serial-supporting browsers also support WASM.
- **Memory access errors** — Indicate corrupted input or wrong base addresses. Check `INPUT_ADDRESS` and frame size.
- **Infinite loop** — Should not happen with shipped firmware; if it does, `uc_emu_start` has a hardcoded exit address (`0x8014`).
