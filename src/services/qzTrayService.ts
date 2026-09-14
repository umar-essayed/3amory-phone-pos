// ═══════════════════════════════════════════════════════════════════════════
// QZ Tray Professional POS Printing Service
// Direct WebSocket Communication with QZ Tray Desktop Print Server
// ═══════════════════════════════════════════════════════════════════════════

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
  private ws: WebSocket | null = null;
  private requestId = 0;
  private promises: Map<number, { resolve: (val: any) => void; reject: (err: any) => void }> = new Map();
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
    // Attempt lazy initial connection in background if in browser
    if (typeof window !== 'undefined') {
      setTimeout(() => this.connect().catch(() => {}), 1000);
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
   * Connects to QZ Tray WebSocket Server
   */
  public async connect(): Promise<boolean> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return true;
    }

    if (this.isConnecting) return false;
    this.isConnecting = true;

    // Try standard ws:// port 8182, then fallback to wss:// port 8181
    const urls = [
      `ws://${this.config.host}:${this.config.port}`,
      `wss://${this.config.host}:${this.config.securePort}`,
    ];

    for (const url of urls) {
      try {
        const connected = await this.tryConnectUrl(url);
        if (connected) {
          this.isConnecting = false;
          await this.refreshPrinters();
          return true;
        }
      } catch {
        // try next url
      }
    }

    this.isConnecting = false;
    this.currentStatus = {
      connected: false,
      printers: [],
      error: 'تعذر الاتصال بـ QZ Tray. تأكد من تشغيله على الجهاز المحلي (ws://localhost:8182).',
    };
    this.notifyStatus();
    return false;
  }

  private tryConnectUrl(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const socket = new WebSocket(url);

        const timeout = setTimeout(() => {
          socket.close();
          resolve(false);
        }, 2000);

        socket.onopen = () => {
          clearTimeout(timeout);
          this.ws = socket;
          this.setupSocketHandlers(socket);
          this.currentStatus.connected = true;
          this.currentStatus.error = undefined;
          this.notifyStatus();
          resolve(true);
        };

        socket.onerror = () => {
          clearTimeout(timeout);
          resolve(false);
        };
      } catch {
        resolve(false);
      }
    });
  }

  private setupSocketHandlers(socket: WebSocket) {
    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        // Handle RPC response
        if (msg.uid !== undefined && this.promises.has(msg.uid)) {
          const { resolve, reject } = this.promises.get(msg.uid)!;
          this.promises.delete(msg.uid);

          if (msg.error) {
            reject(new Error(typeof msg.error === 'string' ? msg.error : JSON.stringify(msg.error)));
          } else {
            resolve(msg.result !== undefined ? msg.result : msg);
          }
        }
      } catch (err) {
        console.warn('QZ Tray incoming message parse note:', err);
      }
    };

    socket.onclose = () => {
      this.ws = null;
      this.currentStatus.connected = false;
      this.notifyStatus();
    };

    socket.onerror = (err) => {
      console.warn('QZ Tray socket error:', err);
      this.currentStatus.connected = false;
      this.notifyStatus();
    };
  }

  private sendRPC<T = any>(call: string, params: any = {}): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('سيرفر الطباعة QZ Tray غير متصل حالياً.'));
    }

    const uid = ++this.requestId;
    const payload = JSON.stringify({
      call,
      params,
      uid,
      timestamp: Date.now(),
    });

    return new Promise<T>((resolve, reject) => {
      this.promises.set(uid, { resolve, reject });
      this.ws!.send(payload);

      // Timeout safety
      setTimeout(() => {
        if (this.promises.has(uid)) {
          this.promises.delete(uid);
          reject(new Error(`انتهت مهلة استجابة QZ Tray للطلب (${call})`));
        }
      }, 10000);
    });
  }

  /**
   * Refreshes printer list and default printer
   */
  public async refreshPrinters(): Promise<string[]> {
    try {
      const printers = await this.sendRPC<string[]>('printers.find');
      let defaultPrinter: string | undefined;
      try {
        defaultPrinter = await this.sendRPC<string>('printers.getDefault');
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
   * Prints raw ESC/POS binary data directly to thermal printer
   */
  public async printRaw(printerName: string, rawBytes: Uint8Array): Promise<boolean> {
    const isConnected = await this.connect();
    if (!isConnected) {
      throw new Error('سيرفر الطباعة QZ Tray غير متصل. يرجى التأكد من تشغيله.');
    }

    const targetPrinter = printerName || this.currentStatus.defaultPrinter || this.currentStatus.printers[0];
    if (!targetPrinter) {
      throw new Error('لم يتم تحديد طابعة حرارية صالحة في QZ Tray.');
    }

    // Convert binary to base64
    let binaryStr = '';
    const len = rawBytes.byteLength;
    for (let i = 0; i < len; i++) {
      binaryStr += String.fromCharCode(rawBytes[i]);
    }
    const base64Data = btoa(binaryStr);

    const printPayload = {
      printer: { name: targetPrinter },
      data: [
        {
          type: 'raw',
          format: 'command',
          flavor: 'base64',
          data: base64Data,
        },
      ],
    };

    await this.sendRPC('print', printPayload);
    return true;
  }

  /**
   * Directly kicks cash drawer connected to printer
   */
  public async kickCashDrawer(printerName?: string): Promise<boolean> {
    const target = printerName || this.config.printerName || this.currentStatus.defaultPrinter || this.currentStatus.printers[0];
    if (!target) return false;

    // Standard ESC/POS kick drawer command: ESC p 0 25 250
    const drawerCmd = new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]);
    return this.printRaw(target, drawerCmd);
  }

  /**
   * Disconnects WebSocket cleanly
   */
  public disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.currentStatus.connected = false;
    this.notifyStatus();
  }
}

export const qzTrayService = new QZTrayService();
