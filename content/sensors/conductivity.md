# Conductivity sensor

Measures electrical conductivity in liquids — useful for water quality, salinity, ion concentration. Single hardware revision.

## Quick reference

| Field | Value |
|---|---|
| Type byte | `4` |
| `sensorType` | `'CONDUCTIVITY'` |
| Decoder type | `CONDUCTIVITY` |
| Latest version | (no v2) |
| Output | µS/cm or status |
| Warm-up | none |

## Frame layout

| Offset | Size | Type | Field |
|---|---|---|---|
| 6 | 2 | uint16 LE | `data0` (electrode reading 1) |
| 8 | 2 | uint16 LE | `data1` (electrode reading 2) |

## Calculation

```ts
const MAX_CONDUCTANCE_VALUE = 200000;   // µS/cm cap
const MIN_CONDUCTANCE_VALUE = 65535;    // open-circuit threshold

async decode(rawValue: SerialRawValue) {
  const data0 = rawValue.getTwoBytesByIndex(6);
  const data1 = rawValue.getTwoBytesByIndex(8);

  if (data0 >= MIN_CONDUCTANCE_VALUE) {
    return result({ status: 'MIN', value: 0 });
  }

  const conductivity = Number(((1 / (data0 * data1)) * 1e6).toFixed(1));

  if (conductivity > MAX_CONDUCTANCE_VALUE) {
    return result({ status: 'MAX', value: 'MAX' });
  }

  return result({ status: 'READY', value: conductivity });
}
```

The core formula:

```
conductivity (µS/cm) = 1,000,000 / (data0 × data1)
```

This is a **dual-electrode** measurement — multiplying the two readings appears to give a resistance product, and the inverse times 10⁶ scales to microsiemens per centimetre.

## Status codes

| Status | Meaning | `value` field |
|---|---|---|
| `MIN` | Open circuit — electrodes not in contact with a conductive medium | `0` |
| `READY` | Valid measurement | `number` (µS/cm) |
| `MAX` | Over-range (>200,000 µS/cm) — short circuit or extreme contamination | `'MAX'` (string!) |

> {warn}
> When `status === 'MAX'`, the `value` is the **string `'MAX'`**, not a number. Branch on status before doing math.

## Reading

```js
serialService.onSerialData = (reading) => {
  if (reading.sensorType !== 'CONDUCTIVITY') return;
  const result = reading.decodedValues[0].value;

  switch (result.status) {
    case 'READY':
      console.log(`Conductivity: ${result.value} µS/cm`);
      break;
    case 'MIN':
      console.log('Electrodes out of solution');
      break;
    case 'MAX':
      console.log('Reading saturated');
      break;
  }
};
```

## Typical ranges

| Sample | Conductivity |
|---|---|
| Distilled water | 0.5–3 µS/cm |
| Drinking water | 50–500 µS/cm |
| Sea water | ~50,000 µS/cm |
| Industrial brine | >100,000 µS/cm |

## Notes

- The `kiwrious-measure-vue` consumer maps `MIN → 0` and `MAX → 200000` for chart visualisation purposes — that's a UI choice, not the SDK contract.
- The Scratch GUI fork exposes both **resistance** (raw `data0 × data1`) and **conductance** (1/R × 10⁶) as separate blocks. The SDK only exposes conductivity. The two are mathematically related; either is recoverable.

> {bug}
> The Scratch GUI has a copy-paste typo: `_isConducatanceIncreasing` is set twice (with one of the assignments meant for the decreasing flag). See [discrepancies](../advanced/discrepancies.md).

## Source files

- `src/decoder/SerialConductivityDecoder.ts` (new SDK)
- `kiwrious/service/SerialConductivityDecoder.ts` (legacy library)
