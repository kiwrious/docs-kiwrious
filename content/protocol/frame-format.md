# 26-byte frame format

Every Kiwrious sensor — regardless of type — emits fixed-size **26-byte frames** over USB serial. All multi-byte values are **little-endian**.

## Frame layout

```
 byte  │  0   1   2   3   4   5   6   7   8   9  10  11  12  13  14  15  16  17  18  19  20  21  22  23  24  25
       ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤
 field │  HDR  │ T │ — reserved — │              sensor data (16 bytes)              │  SEQ  │  FTR  │
```

| Offset | Size | Field | Type | Description |
|---|---|---|---|---|
| 0 | 2 | Header | `uint16` LE | Frame start marker (e.g., `0x0a 0x0a`) |
| 2 | 1 | Sensor type | `uint8` | Identifier byte — see [sensor types](sensor-types.md) |
| 3 | 3 | Reserved | — | Padding / reserved |
| 6 | 16 | Sensor data | varies | Per-sensor payload — see each sensor's page |
| 22 | 2 | Sequence | `uint16` LE | Monotonic sequence number for sample ordering |
| 24 | 2 | Footer | `uint16` LE | Frame end marker |

> {info}
> The header and footer are not validated by the SDK's `SerialReader` — the buffer is sliced strictly by 26-byte boundaries. Validation occurs only by virtue of decoded values being sensible. Some consumer implementations (notably the Scratch GUI fork) do validate `0x0a 0x0a` / `0x0b 0x0b`.

## Reading bytes

The `SerialRawValue` class wraps a `Uint8Array` and exposes typed getters. All methods use little-endian byte order.

```ts
class SerialRawValue {
  // Single byte
  getByteByIndex(i: number): number;
  getHexDigitByIndex(i: number): string;          // 2-char zero-padded hex

  // 16-bit
  getTwoBytesByIndex(i: number): number;          // uint16 LE
  getTwoBytesUnsignedByIndex(i: number): number;  // uint16 LE (alias)
  getTwoBytesSignedByIndex(i: number): number;    // int16 LE

  // 32-bit
  getFourBytesByIndex(i: number): number;         // uint32 LE
  getFourBytesFloatByIndex(i: number): number;    // IEEE 754 float32 LE

  // Slice
  sliceBytes(start: number, len: number): Uint8Array;

  // Detected type
  get sensorType(): SENSOR_TYPE;
  get decoderType(): string;
  get isFirmwareOutdated(): boolean;
}
```

## Sensor data interpretations

The 16 payload bytes (offsets 6–21) are interpreted differently per sensor type.

| Sensor | 6-7 | 8-9 | 10-13 | 14-17 | 18-21 |
|---|---|---|---|---|---|
| **UV** | float32 Lux | float32 UV index | — | — | — |
| **Humidity** | int16 Temp ÷100 | int16 Humidity ÷100 | — | — | — |
| **Temperature v1** | int16 IR ÷100 | int16 Ambient ÷100 | — | — | — |
| **Temperature v2** | int16 Ambient ÷100 | uint16 raw X | float32 a | float32 b | float32 c |
| **Conductivity** | uint16 d0 | uint16 d1 | — | — | — |
| **VOC** | uint16 raw | — | — | — | — |
| **Heart rate v1** | uint32 sample 0 | uint32 sample 1 | uint32 sample 2 | uint32 sample 3 | — |
| **Heart rate v2** | (10 frames concatenated) | | | | |

> {warn}
> **Bytes 6–7 are at offset 6, NOT offset 4.** The 3 reserved bytes (3–5) come *after* the type byte. Several reverse-engineering attempts have made this mistake.

## Frame buffering

USB serial reads do not always return exactly 26 bytes per `read()` call. The SDK's `SerialReader` accumulates bytes in an internal `Uint8Array`:

1. Read from `port.readable` reader.
2. Append result to internal buffer.
3. While buffer length ≥ 26: extract one 26-byte frame, return it, retain the tail.
4. If buffer length < 26: read again.

This is implemented with **tail recursion** rather than a loop — pathological fragmentation could in theory blow the stack, but in practice firmware emits whole frames.

```ts
private async readOnce(): Promise<SerialRawValue> {
  if (this._array.length >= EXPECTED_LENGTH) {
    const frame = this._array.subarray(0, EXPECTED_LENGTH);
    this._array = this._array.subarray(EXPECTED_LENGTH);
    return new SerialRawValue(frame);
  }
  const { value } = await this._reader.read();
  this._array = concat(this._array, value);
  return await this.readOnce();
}
```

## Multi-frame readers

Most sensors decode one frame at a time. **Heart rate v2** is the exception: it requires 10 consecutive frames (160 bytes of payload) to feed into the ARM emulator algorithm. This is implemented by `TenValuesReader` rather than `SingleValueReader`. See [heart rate](../sensors/heart-rate.md).

## Sequence number

Bytes 22–23 contain a monotonic sequence number that wraps at 65535. The SDK does not currently expose this to consumers, but it can be useful for detecting dropped frames if you read raw values directly.
