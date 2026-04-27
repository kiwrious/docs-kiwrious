# DSP pipeline (heart rate v1)

How the v1 heart rate decoder turns raw PPG samples into BPM, all in JavaScript.

## Sample rate and timing

```ts
const SAMPLE_RATE       = 200;      // Hz — PPG sample rate
const INPUT_ARRAY_SIZE  = 2048;     // FFT window
const RESULT_ARRAY_SIZE = 100;      // averaging window for output
```

A 2048-sample FFT at 200 Hz gives:
- Window duration ≈ 10.24 s
- Frequency resolution ≈ 200 / 2048 ≈ 0.098 Hz
- BPM resolution ≈ 5.86 BPM (= 0.098 × 60)

## Input validation

```ts
const MIN_INPUT_VALUE = 300_000;   // ~3.0 normalised PPG amplitude
const MAX_INPUT_VALUE = 900_000;   // ~9.0 normalised PPG amplitude

if (sample < MIN_INPUT_VALUE) status = 'TOO_LOW';
else if (sample > MAX_INPUT_VALUE) status = 'TOO_HIGH';
```

`TOO_LOW` typically means the user's finger is barely on the sensor (or absent). `TOO_HIGH` means saturation — too much pressure or ambient light leaking in.

## Mean centering

Before filtering, the input array is centred around its mean — removing DC offset:

```ts
const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
const centred = arr.map(x => x - mean);
```

## Biquad cascade

Eight cascaded second-order sections form a Butterworth bandpass roughly tuned to the heart-rate frequency band (0.5–3 Hz, i.e. 30–180 BPM):

```ts
const SOS = [
  [[1.0000, 0, -1.0000], [1.0000, -1.9794, 0.9847]],
  [[1.0000, 0, -1.0000], [1.0000, -1.9948, 0.9953]],
  [[1.0000, 0, -1.0000], [1.0000, -1.9889, 0.9893]],
  [[1.0000, 0, -1.0000], [1.0000, -1.9921, 0.9924]],
  [[1.0000, 0, -1.0000], [1.0000, -1.9930, 0.9933]],
  [[1.0000, 0, -1.0000], [1.0000, -1.9943, 0.9946]],
  [[1.0000, 0, -1.0000], [1.0000, -1.9947, 0.9950]],
  [[1.0000, 0, -1.0000], [1.0000, -1.9954, 0.9956]],
];

const GAIN = [0.0256, 0.0256, 0.0254, 0.0254, 0.0252, 0.0252, 0.0251, 0.0251, 1.0000];
```

Each section is a transposed-direct-form-II biquad with state vector `w = [1, 1, 1]` (initialised non-zero — see below).

> {info}
> The composite gain product is `0.0256^8 ≈ 1.1e-11`. The signal is heavily attenuated, then recovered by FFT magnitude scaling and the final stage gain of 1.0. Don't be alarmed by tiny intermediate values.

## FFT and peak detection

After filtering, the array is passed to `jsfft`:

```ts
const spectrum = fft(centredFiltered);
const magnitudes = spectrum.map(c => Math.hypot(c.re, c.im));

let peakIdx = 0;
let peakMag = 0;
for (let i = 0; i < magnitudes.length / 2; i++) {
  if (magnitudes[i] > peakMag) {
    peakMag = magnitudes[i];
    peakIdx = i;
  }
}

const peakFreqHz = peakIdx * (SAMPLE_RATE / INPUT_ARRAY_SIZE);
const heartRate = peakFreqHz * 60;     // BPM
```

The frequency-to-BPM conversion is intentionally simple: the bandpass narrows the search space, so the global max is reliably the fundamental, not a harmonic.

## Rolling average

The pipeline accumulates 100 BPM estimates before emitting a final result:

```ts
const recent = [];   // up to 100 samples
recent.push(currentBpm);
if (recent.length < RESULT_ARRAY_SIZE) {
  return { status: 'PROCESSING', value: null };
}
if (recent.length > RESULT_ARRAY_SIZE) recent.shift();
const avg = recent.reduce((a, b) => a + b) / recent.length;
return { status: 'READY', value: Math.round(avg) };
```

This means **first reading takes ~10 s** (filling the FFT window) plus extra time to fill the averaging window — roughly **~15–20 seconds total** before `status: 'READY'`.

## Quirks

- **Initial filter state `[1, 1, 1]`** rather than zeros. Non-standard; appears to have been a deliberate choice for DC offset handling. Transient settles within microseconds.
- **No harmonic filtering** — relies on the bandpass alone.
- **Linear bin-to-BPM mapping** — assumes 200 Hz sample rate. If the firmware ever emits at a different rate, BPM scales linearly (so detection would still work, but values would be wrong).

## Source

- `src/processing/HeartRateProcessor.ts`
- `src/decoder/SerialHeartRateDecoder.ts`
