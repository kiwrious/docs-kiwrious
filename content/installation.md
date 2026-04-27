# Installation

The Kiwrious SDK ships as an **ES module** with no required runtime dependencies. Browser-only — it requires `navigator.serial`.

## Browser support

Web Serial is supported on:

- Chrome 89+
- Edge 89+
- Opera 75+

Firefox and Safari do not currently support Web Serial. The site must be served over HTTPS or from `localhost`.

## Install via CDN

Drop the bundled ESM build into any HTML page:

```html
<script type="module">
  import serialService from 'https://your-cdn/kiwrious-webserial.esm.js';
  // ...
</script>
```

If your sensor stack includes the **heart rate v2** sensor, you also need to host the ARM emulator assets next to your page so they can be loaded at runtime:

```
your-site/
├─ index.html
└─ js/
   ├─ libunicorn_out.js
   ├─ libunicorn_out.wasm
   ├─ unicorn-wrapper.js
   ├─ unicorn-constants.js
   ├─ libelf-integers.js
   ├─ heartrate.js
   └─ prog.bin              ← ARM Thumb firmware blob (heart rate v2 algorithm)
```

These are bundled in the SDK's `dist/js/` directory after running `npm run build`.

> {info}
> Heart rate v2 only — the other six sensor types do **not** require the emulator runtime.

## Install from a local copy

```bash
# 1. Get the SDK source
git clone <kiwrious-web-serial-sdk repo>
cd kiwrious-web-serial-sdk

# 2. Build it
npm install
npm run build

# 3. Copy dist/ into your project
cp dist/kiwrious-webserial.esm.js /path/to/your/site/
cp -r dist/js /path/to/your/site/
```

The `dist/` output contains:

| File | Purpose |
|---|---|
| `kiwrious-webserial.esm.js` | Development build (~48 KB, source maps) |
| `kiwrious-webserial.esm.min.js` | Production build (~23 KB, minified) |
| `js/libunicorn_out.{js,wasm}` | Unicorn ARM emulator (heart rate v2) |
| `js/heartrate.js` | Emulator orchestrator |
| `js/prog.bin` | ARM Thumb firmware (heart rate algorithm) |

## Use with Vue 2 / 3

```ts
// src/services/sensor.ts
import serialService from 'kiwrious-webserial/lib/service/SerialService';
import type { SensorReadResult } from 'kiwrious-webserial/lib/data/SensorReadResult';

serialService.onSerialData = (data: SensorReadResult) => {
  // dispatch to a Vuex/Pinia store
};

export default serialService;
```

> {info}
> The legacy `kiwrious-webserial` (v1.x) ships as CommonJS — import paths target `lib/` rather than ESM. The new SDK (v2.x) ships as ESM and exposes `default` from `index.ts`.

## Use with React

```tsx
// src/hooks/useKiwrious.ts
import { useEffect, useState } from 'react';
import serialService from 'kiwrious-webserial';

export function useKiwrious() {
  const [reading, setReading] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    serialService.onSerialData = setReading;
    serialService.onSerialConnection = setConnected;
    return () => {
      serialService.onSerialData = undefined;
      serialService.onSerialConnection = undefined;
    };
  }, []);

  return { reading, connected, connect: () => serialService.connectAndReadAsync() };
}
```

## TypeScript

Type definitions are emitted to `dist/index.d.ts`. Public types include:

- `SensorReadResult`
- `SensorDecodedValue`
- `SENSOR_TYPE` (string enum)
- `VOC_RESULT_STATUS`, `HEART_RATE_RESULT_STATUS`, `CONDUCTIVITY_RESULT_STATUS`

See [api/interfaces](api/interfaces.md) for the full data model.
