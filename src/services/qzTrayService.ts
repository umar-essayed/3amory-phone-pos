// ═══════════════════════════════════════════════════════════════════════════
// QZ Tray Professional POS Printing Service
// Direct WebSocket Communication with QZ Tray Desktop Print Server
// Uses Official QZ Tray Security & Digital Signatures for 100% Silent Printing
// ═══════════════════════════════════════════════════════════════════════════

import qz from 'qz-tray';
import { initQzSecurity } from '../constants/qzSecurity';

export interface QZTrayStatus {
  connected: boolean;
  version?: string;
  printers: string[];
  defaultPrinter?: string;
  error?: string;
}

export interface QZTrayConfig {
  host?: string;
  port?: number;
  securePort?: number;
  printerName?: string;
}

class QZTrayService {
  private statusListeners: Set<(status: QZTrayStatus) => void> = new Set();
  private isConnecting = false;
  private currentStatus: QZTrayStatus = {
    connected: false,
    printers: [],
  };

  private config: Required<QZTrayConfig> = {
    host: 'localhost',
    port: 8182,
    securePort: 8181,
    printerName: '',
  };

  constructor() {
    // Attempt lazy initial connection in background if in browser / desktop
    if (typeof window !== 'undefined') {
      setTimeout(() => this.connect().catch(() => {}), 1500);
    }
  }

  public setConfig(cfg: Partial<QZTrayConfig>) {
    this.config = { ...this.config, ...cfg };
  }

  public getStatus(): QZTrayStatus {
    return this.currentStatus;
  }

  public onStatusChange(callback: (status: QZTrayStatus) => void): () => void {
    this.statusListeners.add(callback);
    callback(this.currentStatus);
    return () => this.statusListeners.delete(callback);
  }

  private notifyStatus() {
    this.statusListeners.forEach((cb) => {
      try {
        cb(this.currentStatus);
      } catch (e) {
        console.warn('QZ Tray status listener error:', e);
      }
    });
  }

  /**
   * Connects to QZ Tray WebSocket Server with digital signatures and certificate
   */
  public async connect(): Promise<boolean> {
    try {
      if (qz.websocket.isActive()) {
        this.currentStatus.connected = true;
        this.currentStatus.error = undefined;
        return true;
      }
    } catch {}

    if (this.isConnecting) return false;
    this.isConnecting = true;

    try {
      // 1. Initialize digital certificate & request signer
      initQzSecurity();

      // 2. Connect via official QZ WebSocket engine
      await qz.websocket.connect({
        host: this.config.host,
        port: {
          insecure: [this.config.port || 8182],
          secure: [this.config.securePort || 8181],
        },
        usingSecure: false,
        retries: 2,
        delay: 1,
      });

      this.currentStatus.connected = true;
      this.currentStatus.error = undefined;
      this.isConnecting = false;

      // 3. Fetch version and available printers
      try {
        const ver = await qz.api.getVersion();
        this.currentStatus.version = ver;
      } catch {}

      await this.refreshPrinters();
      return true;
    } catch (err: any) {
      this.isConnecting = false;
      this.currentStatus = {
        connected: false,
        printers: [],
        error: `تعذر الاتصال بـ QZ Tray: ${err?.message || err}`,
      };
      this.notifyStatus();
      return false;
    }
  }

  /**
   * Refreshes printer list and default printer without any security dialogs
   */
  public async refreshPrinters(): Promise<string[]> {
    try {
      if (!qz.websocket.isActive()) {
        const ok = await this.connect();
        if (!ok) return [];
      }

      const printers = await qz.printers.find();
      let defaultPrinter: string | undefined;
      try {
        defaultPrinter = await qz.printers.getDefault();
      } catch {}

      this.currentStatus.printers = Array.isArray(printers) ? printers : [];
      this.currentStatus.defaultPrinter = defaultPrinter;
      this.notifyStatus();
      return this.currentStatus.printers;
    } catch (err) {
      console.warn('Failed to list QZ Tray printers:', err);
      return [];
    }
  }

  /**
   * Prints raw ESC/POS binary data directly and silently to thermal printer
   */
  public async printRaw(printerName: string, rawBytes: Uint8Array): Promise<boolean> {
    const isConnected = await this.connect();
    if (!isConnected) {
      throw new Error('سيرفر الطباعة QZ Tray غير متصل. يرجى التأكد من تشغيله.');
    }

    const targetPrinter =
      printerName ||
      this.config.printerName ||
      this.currentStatus.defaultPrinter ||
      this.currentStatus.printers[0];

    if (!targetPrinter) {
      throw new Error('لم يتم تحديد طابعة صالحة في QZ Tray.');
    }

    // Convert byte array to base64
    let binaryStr = '';
    const len = rawBytes.byteLength;
    for (let i = 0; i < len; i++) {
      binaryStr += String.fromCharCode(rawBytes[i]);
    }
    const base64Data = btoa(binaryStr);

    const config = qz.configs.create(targetPrinter, {
      encoding: 'UTF-8',
    });

    const data = [
      {
        type: 'raw',
        format: 'command',
        flavor: 'base64',
        data: base64Data,
      },
    ];

    await qz.print(config, data as any);
    return true;
  }

  /**
   * Directly kicks cash drawer connected to thermal printer
   */
  public async kickCashDrawer(printerName?: string): Promise<boolean> {
    const target =
      printerName ||
      this.config.printerName ||
      this.currentStatus.defaultPrinter ||
      this.currentStatus.printers[0];

    if (!target) return false;

    // Standard ESC/POS kick drawer command: ESC p 0 25 250
    const drawerCmd = new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]);
    return this.printRaw(target, drawerCmd);
  }

  /**
   * Disconnects WebSocket cleanly
   */
  public async disconnect() {
    try {
      if (qz.websocket.isActive()) {
        await qz.websocket.disconnect();
      }
    } catch {}
    this.currentStatus.connected = false;
    this.notifyStatus();
  }
}

export const qzTrayService = new QZTrayService();
