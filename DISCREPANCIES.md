# Cross-project discrepancies

Audit of differences across the four Kiwrious projects that touch the serial protocol. **Bugs are flagged with ❌. Behavioural differences without a clear "right answer" are flagged with ⚠.**

The full discussion with file citations lives in [`content/advanced/discrepancies.md`](content/advanced/discrepancies.md). This file is the at-a-glance summary.

| # | Severity | Project(s) | Issue |
|---|---|---|---|
| 1 | ❌ Bug | scratch-gui | **Wrong baud rate** — `115200` vs canonical `230400` (`lib.min.js` ~399253) |
| 2 | ⚠ Diff | scratch-gui | Microchip filter restricts by PID `0xec19`; SDK accepts any PID under `0x04d8` |
| 3 | ⚠ Diff | scratch-gui | Exposes both `tVOC (ppb)` and `CO2eq (ppm)`; SDK exposes only one VOC value |
| 4 | ❌ Bug | scratch-gui | `_isConducatanceIncreasing` set twice in conductance decoder (`lib.min.js` ~399964) — typo + missing decreasing flag means "is conductance decreasing?" block always reflects the increasing result |
| 5 | ⚠ Cosmetic | scratch-gui | Origin Trial token expired April 2021 (Web Serial is GA now, ignored) |
| 6 | ⚠ Diff | scratch-gui | No heart rate sensor support (5 sensor types, not 7) |
| 7 | ⚠ Cleanup | kiwrious-web-serial-sdk | Duplicate `case 'HEART_RATE2':` in `SerialDecoderFactory.ts` (~lines 39 and 60); second branch unreachable |
| 8 | ⚠ Quirk | All | `port.open({ baudrate: 230400, baudRate: 230400 })` — both spellings passed for legacy browser compat |
| 9 | ⚠ Drift | kiwrious-measure-vue | Pins `kiwrious-webserial@1.0.20`; library is at `1.0.21` |
| 10 | ⚠ Quirk | kiwrious-web-serial-sdk, library | UV / Temp v2 decoders return `.toFixed()` strings; other decoders return numbers |
| 11 | ⚠ Quirk | kiwrious-measure-vue | `CONDUCTIVITY_DEFAULT[status]` overlay — maps `MIN→0`, `MAX→200000` purely for chart UX |
| 12 | ⚠ Quirk | All | VOC warm-up is **client-side simulated** — not driven by a firmware ready signal |

## Recommended actions

| | What | Where |
|---|---|---|
| Verify with firmware team | What baud rate is canonical | scratch-gui — confirm and fix #1 |
| Verify with firmware team | Is `CO2eq` at bytes 8–9 a real reading or noise | If real, surface in SDK; otherwise remove from scratch-gui |
| Fix typo | Conductance increasing/decreasing flag | scratch-gui — #4 |
| Remove dead code | Duplicate `HEART_RATE2` case | kiwrious-web-serial-sdk — #7 |
| Bump version pin | `kiwrious-webserial@1.0.21` | kiwrious-measure-vue — #9 |
| Document quirks | Items 8, 10, 11, 12 | Done — see linked docs |

## Severity legend

- **❌ Bug** — Confirmed incorrect behaviour. Fix recommended.
- **⚠ Diff / Quirk / Drift** — Behavioural difference or minor inconsistency. Document and decide case-by-case.
- **⚠ Cleanup / Cosmetic** — Code health, no behaviour impact.
