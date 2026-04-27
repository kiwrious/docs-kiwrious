# Recording & CSV export

A common pattern: record a stream of sensor readings, then export to CSV. The reference Vue app implements this end-to-end.

## Minimal recording loop

```js
let isRecording = false;
let buffer = [];

document.querySelector('#start').onclick = () => {
  buffer = [];
  isRecording = true;
};
document.querySelector('#stop').onclick = () => {
  isRecording = false;
  exportCsv(buffer);
};

serialService.onSerialData = (reading) => {
  if (!isRecording) return;
  buffer.push({
    timestamp: new Date().toISOString(),
    sensorType: reading.sensorType,
    values: reading.decodedValues,
  });
};
```

## CSV export

```js
function exportCsv(samples) {
  if (!samples.length) return;

  // Determine columns from the first sample
  const labels = samples[0].values.map((v) => v.label);
  const header = ['timestamp', 'sensorType', ...labels];

  const rows = samples.map((s) => {
    const map = Object.fromEntries(s.values.map((v) => [v.label, valueToCell(v)]));
    return [s.timestamp, s.sensorType, ...labels.map((l) => map[l] ?? '')];
  });

  const csv = [header, ...rows]
    .map((row) => row.map(escapeCsv).join(','))
    .join('\n');

  download(csv, 'kiwrious-recording.csv');
}

function valueToCell(v) {
  if (typeof v.value === 'object' && v.value !== null) {
    return v.value.value ?? v.value.status ?? '';
  }
  return v.value;
}

function escapeCsv(s) {
  const str = String(s);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function download(text, filename) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
```

## Sample-rate control

To record at a fixed rate (e.g., 1 Hz, 2 Hz, 5 Hz) regardless of the sensor's native frequency, use a `setInterval` to sample the latest reading:

```js
let latest = null;
let recorder = null;

serialService.onSerialData = (r) => { latest = r; };

document.querySelector('#start').onclick = () => {
  buffer = [];
  recorder = setInterval(() => {
    if (latest) buffer.push({
      timestamp: new Date().toISOString(),
      sensorType: latest.sensorType,
      values: latest.decodedValues,
    });
  }, 1000);   // 1 Hz
};
document.querySelector('#stop').onclick = () => {
  clearInterval(recorder);
  exportCsv(buffer);
};
```

The reference Vue app exposes a dropdown with these rates:

| Rate | Interval |
|---|---|
| 1 sample / minute | 60,000 ms |
| 1 sample / 30 s | 30,000 ms |
| 1 sample / 5 s | 5,000 ms |
| 1 sample / sec | 1,000 ms |
| 2 samples / sec | 500 ms |
| 5 samples / sec | 200 ms |

## Auto-save on disconnect

If the sensor unplugs mid-recording, save what you have:

```js
serialService.onSerialConnection = (connected) => {
  if (!connected && isRecording) {
    isRecording = false;
    exportCsv(buffer);
  }
};
```

## Computing min / max / average

The reference Vue app annotates the CSV with summary statistics per observable. Useful for science class:

```js
function summarize(samples, label) {
  const nums = samples
    .map((s) => valueToCell(s.values.find((v) => v.label === label)))
    .map(Number)
    .filter(Number.isFinite);

  if (!nums.length) return null;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  return { min, max, avg };
}
```

Append a summary block at the top of the CSV (or as a separate sheet) before exporting.

## Time deltas

Two timestamp formats are useful:

- **Absolute** — wall clock (`new Date().toISOString()`)
- **Relative** — seconds since recording started (`(now - start) / 1000`)

The reference app emits both columns. Relative time is friendlier for plotting in Excel.

```js
const start = performance.now();
buffer.push({
  abs: new Date().toISOString(),
  rel: ((performance.now() - start) / 1000).toFixed(3),
  // ...
});
```
