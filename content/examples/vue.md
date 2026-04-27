# Vue integration

Kiwrious's reference consumer is a Vue 2 app, [`kiwrious-measure-vue`](https://github.com/). Here's the integration pattern.

## Service module

Wrap the singleton in a service module:

```ts
// src/services/sensor.service.ts
import serialService from 'kiwrious-webserial/lib/service/SerialService';
import type { SensorReadResult }   from 'kiwrious-webserial/lib/data/SensorReadResult';
import { SENSOR_TYPE }             from 'kiwrious-webserial/lib/service/SerialRawValue';
import { VOC_RESULT_STATUS }       from 'kiwrious-webserial/lib/service/SerialVOCDecoder';
import { HEART_RATE_RESULT_STATUS } from 'kiwrious-webserial/lib/service/HeartRateProcessor';

export {
  serialService,
  SENSOR_TYPE,
  VOC_RESULT_STATUS,
  HEART_RATE_RESULT_STATUS,
};
export type { SensorReadResult };

export default serialService;
```

## Component

```ts
// src/components/Sensor/Sensor.ts
import Vue from 'vue';
import Component from 'vue-class-component';
import sensorService, {
  SENSOR_TYPE,
  VOC_RESULT_STATUS,
  HEART_RATE_RESULT_STATUS,
  SensorReadResult,
} from '@/services/sensor.service';

@Component
export default class Sensor extends Vue {
  isConnected = false;
  isReady = false;
  sensorType: string = SENSOR_TYPE.UNKNOWN;
  latestValues: any[] = [];

  mounted() {
    sensorService.onSerialData = (reading: SensorReadResult) => {
      this.sensorType = reading.sensorType;
      this.latestValues = reading.decodedValues;
      this.processValues();
    };
    sensorService.onSerialConnection = (connected: boolean) => {
      this.isConnected = connected;
      if (!connected) this.latestValues = [];
    };
    sensorService.onFirmwareUpdateAvailable = (outdated) => {
      if (outdated) this.$emit('firmware-outdated');
    };
  }

  beforeDestroy() {
    sensorService.onSerialData = undefined;
    sensorService.onSerialConnection = undefined;
    sensorService.onFirmwareUpdateAvailable = undefined;
  }

  async connect() {
    await sensorService.connectAndReadAsync();
  }

  async disconnect() {
    await sensorService.disconnectAsync();
  }

  processValues() {
    this.latestValues.forEach((el) => {
      if (el.type !== 'object') {
        this.isReady = true;
        return;
      }
      switch (el.label) {
        case 'Voc':
          this.isReady = el.value.status === VOC_RESULT_STATUS.READY;
          break;
        case 'HeartRate':
          this.isReady = el.value.status === HEART_RATE_RESULT_STATUS.READY;
          break;
        case 'Con':
          this.isReady = true;   // always ready, no warm-up
          break;
      }
    });
  }
}
```

## Template

```html
<template>
  <div class="sensor">
    <button v-if="!isConnected" @click="connect">Connect</button>
    <button v-else @click="disconnect">Disconnect</button>

    <div v-if="isConnected">
      <p>{{ sensorType }} {{ isReady ? '— Ready' : '— Warming up' }}</p>
      <ul>
        <li v-for="v in latestValues" :key="v.label">
          {{ v.label }}: {{ formatValue(v) }}
        </li>
      </ul>
    </div>
  </div>
</template>
```

## Decoupling read rate from render rate

The SDK can deliver up to ~900 Hz of frames. Most UIs don't need to update that fast. The reference Vue app uses a separate `setInterval` chart updator:

```ts
let chartUpdator: number | null = null;
let UPDATE_INTERVAL = 1000;   // ms

mounted() {
  sensorService.onSerialData = (reading) => {
    this.latestValues = reading.decodedValues;     // update frequently
  };
  sensorService.onSerialConnection = (connected) => {
    if (connected) {
      chartUpdator = window.setInterval(() => {
        this.$refs.chart.appendPoint(this.latestValues);
      }, UPDATE_INTERVAL);
    } else if (chartUpdator) {
      clearInterval(chartUpdator);
    }
  };
}
```

This keeps the chart smooth without re-rendering on every frame.

## Vuex / Pinia store

For larger apps, dispatch readings to a store:

```ts
sensorService.onSerialData = (reading) => {
  this.$store.commit('sensor/setReading', reading);
};
```

The store can then derive computed properties (rolling averages, alarms, recording state) without coupling them to the component.

## Auto-save on disconnect

A nice-to-have pattern from the reference app: auto-save any in-progress recording when the sensor unplugs.

```ts
sensorService.onSerialConnection = (connected) => {
  if (!connected && this.isRecording) {
    this.isRecording = false;
    this.saveRecording();
  }
};
```
