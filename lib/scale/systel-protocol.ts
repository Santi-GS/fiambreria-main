/**
 * Protocolo de comunicación serie para balanzas comerciales Systel (Croma, Clipse, Cuora).
 * Parámetros serie estándar de fábrica: 9600 bps, 8 bits de datos, sin paridad, 1 bit de parada (9600 8N1).
 */

export const SYSTEL_SERIAL_CONFIG = {
  baudRate: 9600,
  dataBits: 8 as const,
  stopBits: 1 as const,
  parity: 'none' as const
};

export const SYSTEL_CONTROL = {
  STX: 0x02,
  ETX: 0x03,
  ENQ: 0x05,
  ACK: 0x06,
  LF: 0x0a,
  CR: 0x0d,
  WACK: 0x11,
  NACK: 0x15
} as const;

/** Comando principal Systel de solicitud de peso (ENQ = 0x05) */
export const SYSTEL_ENQ_PACKET = new Uint8Array([SYSTEL_CONTROL.ENQ]);

/** Comando alternativo ASCII de solicitud de peso ('P' = 0x50) en firmwares configurados en modo petición 'P' */
export const SYSTEL_ALT_P_PACKET = new Uint8Array([0x50]);

export type SystelScaleReading = {
  /** Peso expresado en kilogramos (ej. 0.35) */
  weightKg: number;
  /** Peso redondeado en gramos enteros (ej. 350) */
  weightGrams: number;
  /** Indica si la lectura de la balanza se encuentra estable */
  stable: boolean;
  /** Indica si el plato está en cero */
  isZero: boolean;
  /** Indica peso negativo / tara bajo cero */
  isNegative: boolean;
  /** Cadena ASCII limpia recibida en la trama */
  raw: string;
  /** Marca de tiempo (Date.now()) */
  timestamp: number;
};

export type SystelParseEvent =
  | { type: 'reading'; reading: SystelScaleReading }
  | { type: 'busy' }
  | { type: 'nack' };

/**
 * Interpreta la carga útil ASCII extraída de una trama Systel (entre STX y ETX, o una línea CR/LF).
 * Ejemplos reales soportados:
 *  - "00.350" / " 00.350" / "00,350" -> 0.350 Kg (350 g)
 *  - "-00.015" -> -0.015 Kg (-15 g, isNegative=true)
 *  - "S 01.250 kg" / "ST,GS,+01.250kg" -> 1.250 Kg, stable=true
 *  - "U 00.420 kg" / "US,GS,+00.420kg" -> 0.420 Kg, stable=false
 *  - "00350" (entero fijo de 5-6 dígitos sin punto decimal) -> 350 g (0.350 Kg)
 */
export function parseSystelAsciiPayload(
  rawInput: string,
  timestamp = Date.now()
): Omit<SystelScaleReading, 'stable'> & { explicitStable: boolean | null } | null {
  // Limpiar caracteres no imprimibles residuales
  const cleaned = rawInput.replace(/[\x00-\x1f\x7f]/g, ' ').trim();
  if (!cleaned) return null;

  const upper = cleaned.toUpperCase();

  // Detectar indicadores explícitos de estabilidad si el firmware los incluye
  let explicitStable: boolean | null = null;
  if (/\b(US|UNST|INEST)\b/.test(upper) || /^U\s/.test(upper) || upper.includes('?')) {
    explicitStable = false;
  } else if (/\b(ST|EST)\b/.test(upper) || /^S\s/.test(upper)) {
    explicitStable = true;
  }

  // Buscar primero número con separador decimal (formato estándar Systel Croma en Kg: ej. "00.350" o "-0.005")
  const decimalMatch = cleaned.match(/([+-]?\s*\d+[.,]\d+)\s*(kg|g|gr)?/i);
  if (decimalMatch) {
    const normalizedNumber = decimalMatch[1].replace(/\s+/g, '').replace(',', '.');
    const numeric = Number.parseFloat(normalizedNumber);
    if (!Number.isFinite(numeric)) return null;

    const unitToken = (decimalMatch[2] ?? 'kg').toLowerCase();
    const isGramsUnit = unitToken === 'g' || unitToken === 'gr';

    const signedGrams = isGramsUnit ? Math.round(numeric) : Math.round(numeric * 1000);
    const isNegative = signedGrams < 0;
    const clampedGrams = Math.max(0, signedGrams);

    return {
      weightKg: clampedGrams / 1000,
      weightGrams: clampedGrams,
      isZero: clampedGrams === 0 && !isNegative,
      isNegative,
      raw: cleaned,
      timestamp,
      explicitStable
    };
  }

  // Formato entero sin punto decimal (ej. "00350" -> 350 g = 0.350 Kg, o "350 g")
  const intMatch = cleaned.match(/([+-]?\s*\d{1,6})\s*(kg|g|gr)?/i);
  if (intMatch) {
    const normalizedInt = intMatch[1].replace(/\s+/g, '');
    const numeric = Number.parseInt(normalizedInt, 10);
    if (!Number.isFinite(numeric)) return null;

    const unitToken = (intMatch[2] ?? 'g').toLowerCase();
    const signedGrams = unitToken === 'kg' ? numeric * 1000 : numeric;
    const isNegative = signedGrams < 0;
    const clampedGrams = Math.max(0, signedGrams);

    // En balanzas de mostrador (15 Kg / 30 Kg, máx. razonable 300 Kg), descartar basura numérica gigante
    if (clampedGrams > 500_000) return null;

    return {
      weightKg: clampedGrams / 1000,
      weightGrams: clampedGrams,
      isZero: clampedGrams === 0 && !isNegative,
      isNegative,
      raw: cleaned,
      timestamp,
      explicitStable
    };
  }

  return null;
}

/**
 * Decodificador con estado para flujos de bytes USB/RS-232 fragmentados de balanzas Systel.
 * Maneja tramas STX..ETX (+ byte BCC/XOR), respuestas ACK/WACK/NACK y líneas ASCII CR/LF.
 */
export class SystelStreamParser {
  private buffer: number[] = [];
  private skipNextBccByte = false;
  private lastWeightGrams: number | null = null;
  private lastNegative = false;
  private consecutiveStableCount = 0;

  reset() {
    this.buffer = [];
    this.skipNextBccByte = false;
    this.lastWeightGrams = null;
    this.lastNegative = false;
    this.consecutiveStableCount = 0;
  }

  push(chunk: Uint8Array, timestamp = Date.now()): SystelParseEvent[] {
    const events: SystelParseEvent[] = [];

    for (let i = 0; i < chunk.length; i += 1) {
      const byte = chunk[i];

      // Después de ETX (0x03), el protocolo Systel envía 1 byte BCC (XOR).
      // Si el siguiente byte NO es un inicio de nueva trama/control conocido, lo descartamos como BCC.
      if (this.skipNextBccByte) {
        this.skipNextBccByte = false;
        if (
          byte !== SYSTEL_CONTROL.STX &&
          byte !== SYSTEL_CONTROL.ACK &&
          byte !== SYSTEL_CONTROL.WACK &&
          byte !== SYSTEL_CONTROL.NACK
        ) {
          continue;
        }
      }

      if (byte === SYSTEL_CONTROL.ACK) {
        // Confirmación previa a STX; ignorar silenciosamente
        continue;
      }

      if (byte === SYSTEL_CONTROL.WACK) {
        events.push({ type: 'busy' });
        continue;
      }

      if (byte === SYSTEL_CONTROL.NACK) {
        this.buffer = [];
        events.push({ type: 'nack' });
        continue;
      }

      if (byte === SYSTEL_CONTROL.STX) {
        // Inicia nueva trama Systel limpia
        this.buffer = [];
        continue;
      }

      if (byte === SYSTEL_CONTROL.ETX) {
        const reading = this.flushBuffer(timestamp);
        if (reading) {
          events.push({ type: 'reading', reading });
        }
        this.skipNextBccByte = true;
        continue;
      }

      if (byte === SYSTEL_CONTROL.CR || byte === SYSTEL_CONTROL.LF) {
        if (this.buffer.length > 0) {
          const reading = this.flushBuffer(timestamp);
          if (reading) {
            events.push({ type: 'reading', reading });
          }
        }
        continue;
      }

      this.buffer.push(byte);
      // Protección contra desbordamiento si entra ruido en la línea serie
      if (this.buffer.length > 128) {
        this.buffer = this.buffer.slice(-64);
      }
    }

    return events;
  }

  private flushBuffer(timestamp: number): SystelScaleReading | null {
    if (this.buffer.length === 0) return null;
    const rawText = String.fromCharCode(...this.buffer);
    this.buffer = [];

    const parsed = parseSystelAsciiPayload(rawText, timestamp);
    if (!parsed) return null;

    if (
      this.lastWeightGrams !== null &&
      Math.abs(parsed.weightGrams - this.lastWeightGrams) <= 1 &&
      parsed.isNegative === this.lastNegative
    ) {
      this.consecutiveStableCount += 1;
    } else {
      this.consecutiveStableCount = 1;
      this.lastWeightGrams = parsed.weightGrams;
      this.lastNegative = parsed.isNegative;
    }

    const stable =
      parsed.explicitStable !== null ? parsed.explicitStable : this.consecutiveStableCount >= 2;

    return {
      weightKg: parsed.weightKg,
      weightGrams: parsed.weightGrams,
      stable,
      isZero: parsed.isZero,
      isNegative: parsed.isNegative,
      raw: parsed.raw,
      timestamp: parsed.timestamp
    };
  }
}

