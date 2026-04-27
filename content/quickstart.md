# Quickstart

Connect to a Kiwrious sensor, read live data, and disconnect — under five minutes.

## 1. Bare-bones HTML

Save this as `index.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Kiwrious quickstart</title>
</head>
<body>
  <button id="connect">Connect sensor</button>
  <button id="disconnect">Disconnect</button>
  <pre id="output">Waiting for sensor…</pre>

  <script type="module">
    import serialService from './kiwrious-webserial.esm.js';

    const out = document.getElementById('output');

    serialService.onSerialConnection = (connected) => {
      out.textContent = connected ? 'Connected. Reading…' : 'Disconnected.';
    };

    serialService.onSerialData = (reading) => {
      out.textContent = JSON.stringify(reading, null, 2);
    };

    document.getElementById('connect').onclick = () => {
      serialService.connectAndReadAsync();
    };
    document.getElementById('disconnect').onclick = () => {
      serialService.disconnectAsync();
    };
  </script>
</body>
</html>
```

## 2. Serve over HTTPS or localhost

Web Serial requires a secure context. Use any static server:

```bash
npx http-server . -p 8080
# or
python3 -m http.server 8080
```

Open `http://localhost:8080`.

## 3. Plug in a Kiwrious sensor and click Connect

The browser shows a port picker filtered by Kiwrious vendor IDs (`0x04d8`, `0x0d28`). Select your device.

You should see live decoded readings:

```json
{
  "sensorType": "HUMIDITY",
  "decodedValues": [
    { "type": "number", "label": "Temp", "value": 23.45 },
    { "type": "number", "label": "Hum",  "value": 41.20 }
  ]
}
```

## 4. Handle each sensor type

The `decodedValues` array shape depends on `sensorType`. The minimal switch:

```js
serialService.onSerialData = (reading) => {
  const v = reading.decodedValues;
  switch (reading.sensorType) {
    case 'UV':
    case 'UV2':
      console.log('Lux:', v[0].value, 'UV index:', v[1].value);
      break;
    case 'HUMIDITY':
      console.log('Temp:', v[0].value, 'Humidity:', v[1].value);
      break;
    case 'TEMPERATURE':
    case 'TEMPERATURE2':
      console.log('Ambient:', v[0].value, 'IR:', v[1].value);
      break;
    case 'CONDUCTIVITY':
      // v[0].value is { status: 'MIN' | 'READY' | 'MAX', value: number | 'MAX' }
      console.log('Conductivity:', v[0].value);
      break;
    case 'VOC':
      // v[0].value is { status, value, dataReadyPercentage }
      console.log('VOC:', v[0].value);
      break;
    case 'HEART_RATE':
    case 'HEART_RATE2':
      // v[0].value is { status, value, trustlevel?, snr? }
      console.log('Heart rate:', v[0].value);
      break;
  }
};
```

> {warn}
> The first 20 seconds of a VOC sensor reading is a warm-up period. `value` is **not** a valid ppb measurement until `status === 'READY'`. See [sensors/voc](sensors/voc.md).

## 5. Detect firmware updates

```js
serialService.onFirmwareUpdateAvailable = (outdated) => {
  if (outdated) {
    alert('Sensor firmware is out of date. Visit the firmware updater.');
  }
};
```

This fires once per connection, after the first frame is decoded.

## Next steps

- [Frame format](protocol/frame-format.md) — what a 26-byte frame actually contains
- [Sensors](sensors/uv.md) — per-sensor units, byte offsets, and decoder math
- [Disconnect & resume](advanced/disconnect-resume.md) — handling unplugs and reconnections
