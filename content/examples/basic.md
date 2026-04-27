# Basic example

A minimal HTML+JavaScript page that connects, reads, and displays live sensor data.

## Full source

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Kiwrious basic demo</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 640px; margin: 40px auto; padding: 0 20px; }
    button { padding: 10px 20px; margin-right: 8px; }
    .reading { background: #f5f5f7; padding: 16px; border-radius: 8px; margin-top: 16px; }
    .label { font-weight: 600; color: #6b7280; }
    .value { font-size: 28px; font-weight: 700; }
    .unit { color: #6b7280; }
  </style>
</head>
<body>
  <h1>Kiwrious sensor demo</h1>

  <button id="connect">Connect</button>
  <button id="disconnect">Disconnect</button>

  <div id="reading" class="reading">
    <p>Click Connect to pair a Kiwrious sensor.</p>
  </div>

  <script type="module">
    import serialService from './kiwrious-webserial.esm.js';

    const out = document.getElementById('reading');

    const formatters = {
      UV: (vals) => `
        <p><span class="label">Lux</span></p>
        <p class="value">${vals[0].value} <span class="unit">lx</span></p>
        <p><span class="label">UV index</span></p>
        <p class="value">${vals[1].value}</p>
      `,
      HUMIDITY: (vals) => `
        <p><span class="label">Temperature</span></p>
        <p class="value">${vals[0].value.toFixed(1)} <span class="unit">°C</span></p>
        <p><span class="label">Humidity</span></p>
        <p class="value">${vals[1].value.toFixed(1)} <span class="unit">%RH</span></p>
      `,
      TEMPERATURE: (vals) => {
        const ambient = Number(vals[0].value).toFixed(1);
        const ir = Number(vals[1].value).toFixed(1);
        return `
          <p><span class="label">Ambient</span></p>
          <p class="value">${ambient} <span class="unit">°C</span></p>
          <p><span class="label">Surface (IR)</span></p>
          <p class="value">${ir} <span class="unit">°C</span></p>
        `;
      },
      CONDUCTIVITY: (vals) => {
        const r = vals[0].value;
        return `
          <p><span class="label">Conductivity (${r.status})</span></p>
          <p class="value">${typeof r.value === 'number' ? r.value : r.value} <span class="unit">µS/cm</span></p>
        `;
      },
      VOC: (vals) => {
        const r = vals[0].value;
        if (r.status === 'PROCESSING') {
          return `<p>Warming up… ${r.dataReadyPercentage.toFixed(0)}%</p>`;
        }
        return `
          <p><span class="label">VOC</span></p>
          <p class="value">${r.value} <span class="unit">ppb</span></p>
        `;
      },
      HEART_RATE: (vals) => {
        const r = vals[0].value;
        if (r.status !== 'READY') return `<p>${r.status.toLowerCase().replace('_', ' ')}…</p>`;
        return `
          <p><span class="label">Heart rate</span></p>
          <p class="value">${r.value} <span class="unit">BPM</span></p>
        `;
      },
    };

    serialService.onSerialData = (reading) => {
      const fmt = formatters[reading.sensorType];
      if (fmt) out.innerHTML = fmt(reading.decodedValues);
    };

    serialService.onSerialConnection = (connected) => {
      if (!connected) out.innerHTML = '<p>Disconnected.</p>';
    };

    serialService.onFirmwareUpdateAvailable = (outdated) => {
      if (outdated) console.warn('Sensor firmware is out of date.');
    };

    document.getElementById('connect').onclick = () => serialService.connectAndReadAsync();
    document.getElementById('disconnect').onclick = () => serialService.disconnectAsync();
  </script>
</body>
</html>
```

## What's happening

1. The page imports `serialService` from a local copy of the ESM build.
2. It registers three callbacks before any user interaction.
3. On Connect, the SDK shows the OS port-picker; once the user chooses a Kiwrious device, the port opens at 230400 baud and the read loop starts.
4. Each frame fires `onSerialData`, which dispatches to a per-sensor formatter.
5. On Disconnect, the read loop exits cleanly.

## Run it locally

```bash
cd your-project/
npx http-server . -p 8080
open http://localhost:8080
```

Web Serial requires a secure context — `http://localhost` qualifies, as does any `https://` URL.

## Customise

- Replace the formatter logic with your own UI.
- Throttle high-frequency sensors (heart rate, conductivity) using a `setInterval` to avoid re-rendering 100 times per second.
- Persist readings to `localStorage`, IndexedDB, or stream to a server via `fetch`.
- Add a recording button — see [recording & CSV export](recording.md).
