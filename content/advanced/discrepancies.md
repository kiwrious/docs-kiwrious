# Cross-project discrepancies

Audit of differences between the SDK, the legacy library, the Vue consumer, and the Scratch GUI fork. Some are bugs; others are intentional divergence; a few are notable.

## Summary

| # | Where | Severity | Subject |
|---|---|---|---|
| 1 | Scratch GUI | **Bug** | Wrong baud rate (115200 vs canonical 230400) |
| 2 | Scratch GUI | Medium | Microchip filter restricts by PID `0xec19`; SDK accepts any PID |
| 3 | Scratch GUI | Diff | Exposes both tVOC and CO2eq; SDK exposes only one VOC value |
| 4 | Scratch GUI | **Bug** | `_isConducatanceIncreasing` set twice (typo + missing decreasing flag) |
| 5 | Scratch GUI | Bug | Origin Trial token expired April 2021 |
| 6 | Scratch GUI | Diff | No heart rate sensor support |
| 7 | New SDK | Minor | `HEART_RATE2` listed twice in `SerialDecoderFactory.ts` |
| 8 | All | Diff | `port.open({ baudrate, baudRate })` — both spellings passed |
| 9 | Vue app | Drift | Pins `kiwrious-webserial@1.0.20`; legacy library is at v1.0.21 |
| 10 | All decoders | Quirk | UV decoder returns strings (`.toFixed()`); other decoders return numbers |
| 11 | Vue app | Quirk | `CONDUCTIVITY_DEFAULT[status]` overlay maps `MIN→0`, `MAX→200000` for chart UX |
| 12 | All | Quirk | VOC warm-up is **client-side simulated**, not driven by firmware signal |

---

## 1. Scratch GUI uses wrong baud rate

| Project | Baud rate |
|---|---|
| New SDK | **230400** |
| Legacy library | **230400** |
| Vue consumer | (delegates to library — 230400) |
| Scratch GUI | **115200** ❌ |

**Evidence:** `lib.min.js` line 399253 in `scratch-gui` hard-codes `115200`. The SDK and library both pass `230400` (with both spellings).

**Impact:** A Kiwrious device emitting at 230400 baud will produce garbled or no data when read at 115200. Either:
- The firmware that the Scratch GUI was originally built against ran at 115200, or
- The Scratch GUI is silently broken and has been since the SDK moved to 230400.

**Recommendation:** verify against current firmware. If 230400 is canonical, fix the Scratch GUI.

---

## 2. Scratch GUI restricts Microchip filter by PID

| Project | Microchip filter |
|---|---|
| New SDK | `{ usbVendorId: 0x04d8 }` (any PID) |
| Legacy library | `{ usbVendorId: 0x04d8, vendorId: 0x04d8 }` (any PID) |
| Scratch GUI | `{ usbVendorId: 0x04d8, usbProductId: 0xec19 }` (only PID 0xec19) |

**Impact:** Newer Kiwrious sensors that ship with a different Microchip PID will not appear in the Scratch GUI's port-picker. The SDK and library accept all Microchip PIDs.

---

## 3. VOC fields differ between Scratch GUI and SDK

| Project | VOC fields |
|---|---|
| New SDK | `Voc` (single, bytes 6–7) |
| Legacy library | `Voc` (single, bytes 6–7) |
| Scratch GUI | `tVOC (ppb)` from bytes 6–7, **plus** `CO2eq (ppm)` from bytes 8–9 |

**Impact:** The Scratch GUI exposes more sensor data than the SDK. Either the firmware does emit a CO2eq reading at offset 8–9 that the SDK ignores, or the Scratch GUI is reading garbage at offset 8–9. Worth verifying with firmware authors.

If valid, the SDK could be extended to surface a `CO2` field on VOC readings.

---

## 4. Scratch GUI conductance increasing/decreasing typo

`scratch-gui/lib.min.js` near line 399964:

```js
this._isConducatanceIncreasing = this._isIncrease(...);
this._isConducatanceIncreasing = this._isDecrease(...);   // ← should be _isConducatanceDecreasing
```

Note the misspelled identifier (`Conducatance`) and the duplicated assignment. Result: the `is conductance decreasing?` block always reports the *increasing* result.

---

## 5. Scratch GUI origin trial token expired

`index.html` and `compatibility-testing.html` carry an `Origin-Trial` meta tag for Web Serial. The token expired on **April 7, 2021** (`expiry: 1617753599`). On modern Chrome, Web Serial is now generally available and the token is unnecessary — but the page still ships the expired one.

Cosmetic only; modern Chrome ignores expired trial tokens.

---

## 6. Scratch GUI does not implement heart rate

Scratch GUI implements 5 sensor types: UV, Humidity, Temperature, Conductivity, VOC. It has **no heart rate support** — no opcodes, no decoder. The Unicorn emulator stack is not bundled there.

This is intentional (block-based programming UX for kids) but worth documenting.

---

## 7. Duplicate `HEART_RATE2` case in `SerialDecoderFactory`

```ts
// src/service/SerialDecoderFactory.ts (new SDK)
case 'HEART_RATE2':                              // line ~39
  return new SerialHeartRate2Decoder();
// ...
case 'HEART_RATE2':                              // line ~60 (unreachable)
  return new SerialHeartRate2Decoder();
```

Behaviour is correct (the second branch is unreachable) but it's dead code. Cleanup item.

---

## 8. `port.open({ baudrate, baudRate })` passes both spellings

```ts
await port.open({ baudrate: 230400, baudRate: 230400 });
```

The Web Serial spec uses `baudRate` (camelCase). Older Chromium implementations accepted `baudrate` (lowercase). The SDK passes both for cross-version safety. Not a bug — defensive coding.

---

## 9. Vue consumer pins old library version

```json
// kiwrious-measure-vue/package.json
"kiwrious-webserial": "1.0.20"
```

The library repo is at v1.0.21. One patch behind. Probably fine; worth refreshing on the next release pass.

---

## 10. UV decoder returns strings

`SerialUVDecoder` returns `.toFixed(0)` for Lux and `.toFixed(1)` for UV index — both **strings**. Other decoders (humidity, temperature v1) return numbers. Temperature v2 IR also returns a string (via `.toFixed(0)`).

**Recommendation:** consumers should `Number(value)` before doing arithmetic. Inconsistent return types would benefit from a normalisation pass in the decoder layer.

---

## 11. Vue app overlays conductivity status with chart-friendly numbers

When the library returns `{ status: 'MAX', value: 'MAX' }`, the Vue app replaces the value with the constant `200000` so its log-scale chart can render it. This is a **UI choice**, not part of the SDK contract — your app should branch on `status` instead.

---

## 12. VOC warm-up is client-side simulated

The 20-second warm-up is **not driven by a firmware signal**. The decoder runs a JavaScript timer that increments `dataReadyPercentage` at 5%/sec. The first non-zero VOC reading clears the timer and forces `READY`.

**Implication:** the warm-up timer fires whether the sensor is actually warming up or already stable. The percentage is purely cosmetic.

---

## What to do about it

For each item above:

- **Bugs (1, 4, 5)**: file as issues against the Scratch GUI fork.
- **Cleanup (7)**: remove duplicate case in `SerialDecoderFactory`.
- **Diffs (2, 3, 6)**: confirm with firmware team whether canonical behaviour should change in any project.
- **Drift (9)**: bump version pin.
- **Quirks (8, 10, 11, 12)**: document behaviour (this page).

This page is the canonical record. Update it when discrepancies are resolved.
