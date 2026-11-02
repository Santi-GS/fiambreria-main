import { describe, expect, it } from 'vitest';
import {
  SYSTEL_CONTROL,
  SystelStreamParser,
  parseSystelAsciiPayload
} from '@/lib/scale/systel-protocol';

function buildSystelFrame(asciiWeight: string, includeAck = true): Uint8Array {
  const payload = Array.from(asciiWeight).map((ch) => ch.charCodeAt(0));
  let bcc = SYSTEL_CONTROL.STX;
  for (const b of payload) {
    bcc ^= b;
  }
  bcc ^= SYSTEL_CONTROL.ETX;

  const bytes = [
    ...(includeAck ? [SYSTEL_CONTROL.ACK] : []),
    SYSTEL_CONTROL.STX,
    ...payload,
    SYSTEL_CONTROL.ETX,
    bcc
  ];
  return new Uint8Array(bytes);
}

describe('Systel Croma serial protocol parser', () => {
  it('parses standard Systel Croma decimal Kg frames accurately', () => {
    const parsed = parseSystelAsciiPayload(' 00.350', 1000);
    expect(parsed).toMatchObject({
      weightKg: 0.35,
      weightGrams: 350,
      isZero: false,
      isNegative: false
    });
  });

  it('parses comma decimals and fixed-point 5-digit integer frames', () => {
    const commaDecimal = parseSystelAsciiPayload('01,275');
    expect(commaDecimal?.weightGrams).toBe(1275);
    expect(commaDecimal?.weightKg).toBe(1.275);

    const fixedPoint = parseSystelAsciiPayload('00485');
    expect(fixedPoint?.weightGrams).toBe(485);
    expect(fixedPoint?.weightKg).toBe(0.485);
  });

  it('handles negative/under-zero tare weights safely by clamping to 0g with isNegative=true', () => {
    const negative = parseSystelAsciiPayload('-00.020');
    expect(negative).toMatchObject({
      weightKg: 0,
      weightGrams: 0,
      isZero: false,
      isNegative: true
    });
  });

  it('decodes complete ACK + STX + weight + ETX + BCC frames and detects stability on consecutive readings', () => {
    const parser = new SystelStreamParser();

    const firstEvents = parser.push(buildSystelFrame('00.525'), 1000);
    expect(firstEvents).toHaveLength(1);
    expect(firstEvents[0]).toEqual({
      type: 'reading',
      reading: expect.objectContaining({
        weightGrams: 525,
        weightKg: 0.525,
        stable: false
      })
    });

    const secondEvents = parser.push(buildSystelFrame('00.525'), 1250);
    expect(secondEvents).toHaveLength(1);
    expect(secondEvents[0]).toEqual({
      type: 'reading',
      reading: expect.objectContaining({
        weightGrams: 525,
        weightKg: 0.525,
        stable: true
      })
    });
  });

  it('reassembles fragmented USB chunks split mid-frame without corrupting readings', () => {
    const parser = new SystelStreamParser();
    const frame = buildSystelFrame('02.140');

    const part1 = frame.subarray(0, 3);
    const part2 = frame.subarray(3, 6);
    const part3 = frame.subarray(6);

    expect(parser.push(part1)).toEqual([]);
    expect(parser.push(part2)).toEqual([]);
    const events = parser.push(part3);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: 'reading',
      reading: expect.objectContaining({
        weightGrams: 2140,
        weightKg: 2.14
      })
    });
  });

  it('handles WACK (busy), NACK, and continuous CR/LF ASCII lines', () => {
    const parser = new SystelStreamParser();

    expect(parser.push(new Uint8Array([SYSTEL_CONTROL.WACK]))).toEqual([{ type: 'busy' }]);
    expect(parser.push(new Uint8Array([SYSTEL_CONTROL.NACK]))).toEqual([{ type: 'nack' }]);

    const continuousLine = new TextEncoder().encode('ST,GS,+00.750kg\r\n');
    const events = parser.push(continuousLine);
    expect(events).toEqual([
      {
        type: 'reading',
        reading: expect.objectContaining({
          weightGrams: 750,
          weightKg: 0.75,
          stable: true
        })
      }
    ]);
  });
});

