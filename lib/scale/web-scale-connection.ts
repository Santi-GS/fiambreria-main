import {
  SYSTEL_ALT_P_PACKET,
  SYSTEL_ENQ_PACKET,
  SYSTEL_SERIAL_CONFIG,
  SystelStreamParser,
  type SystelScaleReading
} from './systel-protocol';

/**
 * Tipos mínimos del navegador para Web Serial API y WebUSB API
 * (evita depender de paquetes @types externos en tsconfig).
 */
interface BrowserSerialPort {
  readonly readable: ReadableStream<Uint8Array> | null;
  readonly writable: WritableStream<Uint8Array> | null;
  open(options: {
    baudRate: number;
    dataBits?: number;
    stopBits?: number;
    parity?: 'none' | 'even' | 'odd';
    flowControl?: 'none' | 'hardware';
  }): Promise<void>;
  setSignals?(signals: { dataTerminalReady?: boolean; requestToSend?: boolean }): Promise<void>;
  close(): Promise<void>;
}

interface BrowserSerial {
  getPorts(): Promise<BrowserSerialPort[]>;
  requestPort(options?: {
    filters?: Array<{ usbVendorId?: number; usbProductId?: number }>;
  }): Promise<BrowserSerialPort>;
}

interface UsbEndpoint {
  endpointNumber: number;
  direction: 'in' | 'out';
  type: 'bulk' | 'interrupt' | 'isochronous';
  packetSize: number;
}

interface UsbAlternateInterface {
  alternateSetting: number;
  interfaceClass: number;
  endpoints: UsbEndpoint[];
}

interface UsbInterface {
  interfaceNumber: number;
  alternates: UsbAlternateInterface[];
  claimed: boolean;
}

interface UsbConfiguration {
  configurationValue: number;
  interfaces: UsbInterface[];
}

interface BrowserUsbDevice {
  vendorId: number;
  productId: number;
  productName?: string;
  opened: boolean;
  configuration: UsbConfiguration | null;
  configurations: UsbConfiguration[];
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(configurationValue: number): Promise<void>;
  claimInterface(interfaceNumber: number): Promise<void>;
  releaseInterface(interfaceNumber: number): Promise<void>;
  controlTransferOut(
    setup: {
      requestType: 'standard' | 'class' | 'vendor';
      recipient: 'device' | 'interface' | 'endpoint' | 'other';
      request: number;
      value: number;
      index: number;
    },
    data?: BufferSource | Uint8Array
  ): Promise<{ status: string; bytesWritten: number }>;
  transferIn(
    endpointNumber: number,
    length: number
  ): Promise<{ status: string; data?: DataView }>;
  transferOut(
    endpointNumber: number,
    data: BufferSource | Uint8Array
  ): Promise<{ status: string; bytesWritten: number }>;
}

interface BrowserUsb {
  getDevices(): Promise<BrowserUsbDevice[]>;
  requestDevice(options: {
    filters: Array<{ vendorId?: number; classCode?: number }>;
  }): Promise<BrowserUsbDevice>;
}

type NavigatorWithHardware = Navigator & {
  serial?: BrowserSerial;
  usb?: BrowserUsb;
};

/** Vendors USB-RS232 más utilizados con balanzas Systel Croma */
const USB_SERIAL_VENDORS = {
  FTDI: 0x0403,
  CH34X: 0x1a86,
  CP210X: 0x10c4,
  PL2303: 0x067b
} as const;

const WEBUSB_FILTERS = [
  { vendorId: USB_SERIAL_VENDORS.CH34X },
  { vendorId: USB_SERIAL_VENDORS.FTDI },
  { vendorId: USB_SERIAL_VENDORS.CP210X },
  { vendorId: USB_SERIAL_VENDORS.PL2303 },
  { classCode: 0x02 }, // USB CDC Communications
  { classCode: 0x0a } // USB CDC Data
];

export type ScaleConnectionStatus =
  | 'unsupported'
  | 'insecure-context'
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

export type ScaleCallbacks = {
  onStatusChange: (status: ScaleConnectionStatus, errorMessage?: string) => void;
  onReading: (reading: SystelScaleReading) => void;
};

interface ActiveTransport {
  write(packet: Uint8Array): Promise<void>;
  close(): Promise<void>;
}

function getHardwareNavigator(): NavigatorWithHardware | null {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return null;
  return navigator as NavigatorWithHardware;
}

export function detectScaleSupport(): {
  supported: boolean;
  insecureContext: boolean;
  hasWebSerial: boolean;
  hasWebUsb: boolean;
} {
  if (typeof window === 'undefined') {
    return { supported: false, insecureContext: false, hasWebSerial: false, hasWebUsb: false };
  }

  const insecureContext = !window.isSecureContext;
  const nav = getHardwareNavigator();
  const hasWebSerial = Boolean(nav?.serial);
  const hasWebUsb = Boolean(nav?.usb);

  return {
    supported: !insecureContext && (hasWebSerial || hasWebUsb),
    insecureContext,
    hasWebSerial,
    hasWebUsb
  };
}

/**
 * Configura a 9600 8N1 los adaptadores USB-a-RS232 más populares cuando se usa WebUSB directo (ej. tablets Android OTG).
 */
async function configureWebUsbSerialChip(
  device: BrowserUsbDevice,
  interfaceNumber: number
): Promise<{ stripFtdiStatusHeader: boolean }> {
  const vid = device.vendorId;

  // 1. FTDI (FT232R, FT231X, FT2232) - cada paquete IN incluye 2 bytes iniciales de estado de módem
  if (vid === USB_SERIAL_VENDORS.FTDI) {
    // Reset
    await device.controlTransferOut({
      requestType: 'vendor',
      recipient: 'device',
      request: 0x00,
      value: 0x0000,
      index: interfaceNumber
    });
    // 8 bits, sin paridad, 1 bit de parada
    await device.controlTransferOut({
      requestType: 'vendor',
      recipient: 'device',
      request: 0x04,
      value: 0x0008,
      index: interfaceNumber
    });
    // Sin control de flujo + DTR/RTS activos
    await device.controlTransferOut({
      requestType: 'vendor',
      recipient: 'device',
      request: 0x02,
      value: 0x0000,
      index: interfaceNumber
    });
    await device.controlTransferOut({
      requestType: 'vendor',
      recipient: 'device',
      request: 0x01,
      value: 0x0303,
      index: interfaceNumber
    });
    // 9600 bps (3.000.000 / 9600 = 312.5 -> 0x4138)
    await device.controlTransferOut({
      requestType: 'vendor',
      recipient: 'device',
      request: 0x03,
      value: 0x4138,
      index: interfaceNumber
    });

    return { stripFtdiStatusHeader: true };
  }

  // 2. Qinheng CH340 / CH341
  if (vid === USB_SERIAL_VENDORS.CH34X) {
    await device.controlTransferOut({
      requestType: 'vendor',
      recipient: 'device',
      request: 0xa1,
      value: 0x0000,
      index: 0x0000
    });
    // Baudrate 9600
    await device.controlTransferOut({
      requestType: 'vendor',
      recipient: 'device',
      request: 0x9a,
      value: 0x1312,
      index: 0xb282
    });
    // LCR: RX + TX habilitados, 8N1 (0xc3)
    await device.controlTransferOut({
      requestType: 'vendor',
      recipient: 'device',
      request: 0x9a,
      value: 0x2518,
      index: 0x00c3
    });
    // Activar DTR y RTS
    await device.controlTransferOut({
      requestType: 'vendor',
      recipient: 'device',
      request: 0xa4,
      value: 0xff9f,
      index: 0x0000
    });

    return { stripFtdiStatusHeader: false };
  }

  // 3. Silicon Labs CP2102 / CP210x
  if (vid === USB_SERIAL_VENDORS.CP210X) {
    // IFC_ENABLE
    await device.controlTransferOut({
      requestType: 'vendor',
      recipient: 'interface',
      request: 0x00,
      value: 0x0001,
      index: interfaceNumber
    });
    // 8N1
    await device.controlTransferOut({
      requestType: 'vendor',
      recipient: 'interface',
      request: 0x03,
      value: 0x0800,
      index: interfaceNumber
    });
    // DTR + RTS
    await device.controlTransferOut({
      requestType: 'vendor',
      recipient: 'interface',
      request: 0x07,
      value: 0x0303,
      index: interfaceNumber
    });
    // SET_BAUDRATE 9600 (0x00002580 LE)
    const baudBytes = new Uint8Array([0x80, 0x25, 0x00, 0x00]);
    await device.controlTransferOut(
      {
        requestType: 'vendor',
        recipient: 'interface',
        request: 0x1e,
        value: 0x0000,
        index: interfaceNumber
      },
      baudBytes
    );

    return { stripFtdiStatusHeader: false };
  }

  // 4. Prolific PL2303 y dispositivos USB CDC-ACM estándar
  const lineCoding = new Uint8Array([0x80, 0x25, 0x00, 0x00, 0x00, 0x00, 0x08]); // 9600, 1 stop, no parity, 8 bits
  await device
    .controlTransferOut(
      {
        requestType: 'class',
        recipient: 'interface',
        request: 0x20,
        value: 0x0000,
        index: interfaceNumber
      },
      lineCoding
    )
    .catch(() => null);

  await device
    .controlTransferOut({
      requestType: 'class',
      recipient: 'interface',
      request: 0x22,
      value: 0x0003,
      index: interfaceNumber
    })
    .catch(() => null);

  return { stripFtdiStatusHeader: false };
}

function stripFtdiHeaders(raw: Uint8Array, maxPacketSize: number): Uint8Array {
  const step = maxPacketSize > 2 ? maxPacketSize : 64;
  const output: number[] = [];
  for (let offset = 0; offset < raw.length; offset += step) {
    const end = Math.min(offset + step, raw.length);
    for (let idx = offset + 2; idx < end; idx += 1) {
      output.push(raw[idx]);
    }
  }
  return new Uint8Array(output);
}

/**
 * Controlador de sesión para una balanza Systel Croma conectada por USB al dispositivo actual.
 */
export class SystelScaleSession {
  private callbacks: ScaleCallbacks;
  private parser = new SystelStreamParser();
  private transport: ActiveTransport | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private closed = false;
  private unansweredEnqPolls = 0;
  private hasReceivedData = false;

  constructor(callbacks: ScaleCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Intenta reconectar silenciosamente a una balanza ya autorizada previamente en este navegador/tablet.
   */
  async tryAutoConnect(): Promise<boolean> {
    const support = detectScaleSupport();
    if (support.insecureContext) {
      this.callbacks.onStatusChange('insecure-context');
      return false;
    }
    if (!support.supported) {
      this.callbacks.onStatusChange('unsupported');
      return false;
    }

    const nav = getHardwareNavigator();
    if (!nav) return false;

    if (nav.serial) {
      try {
        const ports = await nav.serial.getPorts();
        if (ports.length > 0) {
          await this.openWebSerialPort(ports[0]);
          return true;
        }
      } catch {
        // Continuar con WebUSB si WebSerial falla en Android
      }
    }

    if (nav.usb) {
      try {
        const devices = await nav.usb.getDevices();
        if (devices.length > 0) {
          await this.openWebUsbDevice(devices[0]);
          return true;
        }
      } catch {
        // Sin dispositivo autorizado disponible
      }
    }

    this.callbacks.onStatusChange('disconnected');
    return false;
  }

  /**
   * Abre el selector del navegador para que el usuario autorice el cable RS-232 a USB de la balanza por primera vez.
   */
  async requestAndConnect(): Promise<boolean> {
    const support = detectScaleSupport();
    if (support.insecureContext) {
      this.callbacks.onStatusChange(
        'insecure-context',
        'Para leer la balanza USB desde el navegador, ingresa por HTTPS (Cloudflare Tunnel) o habilita el origen local en Chrome.'
      );
      return false;
    }
    if (!support.supported) {
      this.callbacks.onStatusChange(
        'unsupported',
        'Este navegador no soporta conexión USB serie. Usa Google Chrome en Android o Windows.'
      );
      return false;
    }

    const nav = getHardwareNavigator();
    if (!nav) return false;

    await this.disconnect();
    this.closed = false;
    this.callbacks.onStatusChange('connecting');

    let serialCancelledByUser = false;

    if (nav.serial) {
      try {
        const port = await nav.serial.requestPort();
        await this.openWebSerialPort(port);
        return true;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'NotFoundError') {
          serialCancelledByUser = true;
          // En algunas tablets Android Chrome muestra la lista WebSerial vacía; si hay WebUSB probamos WebUSB
          if (!nav.usb) {
            this.callbacks.onStatusChange('disconnected');
            return false;
          }
        } else if (!nav.usb) {
          this.callbacks.onStatusChange(
            'error',
            err instanceof Error ? err.message : 'No se pudo abrir el puerto USB de la balanza.'
          );
          return false;
        }
      }
    }

    if (nav.usb) {
      try {
        const device = await nav.usb.requestDevice({ filters: WEBUSB_FILTERS });
        await this.openWebUsbDevice(device);
        return true;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'NotFoundError') {
          this.callbacks.onStatusChange('disconnected');
          return false;
        }
        this.callbacks.onStatusChange(
          'error',
          serialCancelledByUser
            ? 'No se seleccionó ningún adaptador USB-RS232.'
            : err instanceof Error
              ? err.message
              : 'No se pudo reclamar el adaptador USB en esta tablet.'
        );
        return false;
      }
    }

    this.callbacks.onStatusChange('disconnected');
    return false;
  }

  async disconnect(): Promise<void> {
    this.closed = true;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    const active = this.transport;
    this.transport = null;
    if (active) {
      await active.close().catch(() => null);
    }
  }

  private startPollingLoop() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.unansweredEnqPolls = 0;
    this.hasReceivedData = false;

    const sendPoll = async () => {
      if (this.closed || !this.transport) return;
      try {
        // Alterna a 'P' cada 4 intentos sólo mientras no haya respondido al ENQ estándar
        const useAltCommand = !this.hasReceivedData && this.unansweredEnqPolls > 0 && this.unansweredEnqPolls % 4 === 0;
        this.unansweredEnqPolls += 1;
        await this.transport.write(useAltCommand ? SYSTEL_ALT_P_PACKET : SYSTEL_ENQ_PACKET);
      } catch {
        // Ignorar errores transitorios de escritura durante reconexión
      }
    };

    void sendPoll();
    this.pollTimer = setInterval(() => {
      void sendPoll();
    }, 260);
  }

  private handleIncomingBytes(bytes: Uint8Array) {
    if (bytes.length === 0) return;
    const events = this.parser.push(bytes);
    for (const ev of events) {
      if (ev.type === 'reading') {
        this.hasReceivedData = true;
        this.unansweredEnqPolls = 0;
        this.callbacks.onReading(ev.reading);
      }
    }
  }

  private async openWebSerialPort(port: BrowserSerialPort) {
    this.closed = false;
    this.parser.reset();
    this.callbacks.onStatusChange('connecting');

    await port.open(SYSTEL_SERIAL_CONFIG);
    await port.setSignals?.({ dataTerminalReady: true, requestToSend: true }).catch(() => null);

    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    let writer: WritableStreamDefaultWriter<Uint8Array> | null = null;

    if (port.writable) {
      writer = port.writable.getWriter();
    }

    this.transport = {
      write: async (packet: Uint8Array) => {
        if (!writer) return;
        await writer.write(packet);
      },
      close: async () => {
        try {
          await reader?.cancel();
        } catch {
          // noop
        }
        try {
          reader?.releaseLock();
        } catch {
          // noop
        }
        try {
          writer?.releaseLock();
        } catch {
          // noop
        }
        await port.close().catch(() => null);
      }
    };

    this.callbacks.onStatusChange('connected');
    this.startPollingLoop();

    // Bucle de lectura asíncrono
    void (async () => {
      try {
        if (!port.readable) return;
        reader = port.readable.getReader();
        while (!this.closed) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) {
            this.handleIncomingBytes(value);
          }
        }
      } catch (err) {
        if (!this.closed) {
          this.callbacks.onStatusChange(
            'error',
            err instanceof Error ? err.message : 'Se perdió la conexión con la balanza USB.'
          );
        }
      }
    })();
  }

  private async openWebUsbDevice(device: BrowserUsbDevice) {
    this.closed = false;
    this.parser.reset();
    this.callbacks.onStatusChange('connecting');

    if (!device.opened) {
      await device.open();
    }
    if (!device.configuration && device.configurations.length > 0) {
      await device.selectConfiguration(device.configurations[0].configurationValue);
    }

    const config = device.configuration;
    if (!config) {
      throw new Error('No se pudo leer la configuración USB del adaptador RS-232.');
    }

    // Buscar interfaz de datos con endpoints bulk IN y bulk OUT
    let targetIfaceNum = config.interfaces[0]?.interfaceNumber ?? 0;
    let inEndpoint: UsbEndpoint | null = null;
    let outEndpoint: UsbEndpoint | null = null;

    for (const iface of config.interfaces) {
      for (const alt of iface.alternates) {
        const candidateIn = alt.endpoints.find((ep) => ep.direction === 'in' && ep.type === 'bulk');
        const candidateOut = alt.endpoints.find((ep) => ep.direction === 'out' && ep.type === 'bulk');
        if (candidateIn && candidateOut) {
          targetIfaceNum = iface.interfaceNumber;
          inEndpoint = candidateIn;
          outEndpoint = candidateOut;
          break;
        }
      }
      if (inEndpoint && outEndpoint) break;
    }

    if (!inEndpoint || !outEndpoint) {
      throw new Error('El adaptador USB seleccionado no expone canales serie compatibles.');
    }

    // Reclamar interfaz de control (0) si existe en CDC-ACM, y la interfaz de datos
    if (targetIfaceNum !== 0 && config.interfaces.some((i) => i.interfaceNumber === 0)) {
      await device.claimInterface(0).catch(() => null);
    }
    await device.claimInterface(targetIfaceNum);

    const { stripFtdiStatusHeader } = await configureWebUsbSerialChip(device, targetIfaceNum);
    const activeIn = inEndpoint;
    const activeOut = outEndpoint;

    this.transport = {
      write: async (packet: Uint8Array) => {
        if (this.closed) return;
        await device.transferOut(activeOut.endpointNumber, packet);
      },
      close: async () => {
        await device.releaseInterface(targetIfaceNum).catch(() => null);
        await device.close().catch(() => null);
      }
    };

    this.callbacks.onStatusChange('connected');
    this.startPollingLoop();

    // Bucle de lectura USB Bulk IN
    void (async () => {
      try {
        const readSize = Math.max(activeIn.packetSize || 64, 64);
        while (!this.closed) {
          const result = await device.transferIn(activeIn.endpointNumber, readSize);
          if (result.data && result.data.byteLength > 0) {
            const rawBytes = new Uint8Array(
              result.data.buffer,
              result.data.byteOffset,
              result.data.byteLength
            );
            const payload = stripFtdiStatusHeader
              ? stripFtdiHeaders(rawBytes, activeIn.packetSize || 64)
              : rawBytes;
            this.handleIncomingBytes(payload);
          }
        }
      } catch (err) {
        if (!this.closed) {
          this.callbacks.onStatusChange(
            'error',
            err instanceof Error ? err.message : 'Se desconectó el cable USB de la balanza.'
          );
        }
      }
    })();
  }
}
