// ═══════════════════════════════════════════════════════════════════════════
// 3amory phone - System Logger & Audit Trail Service
// Manages Desktop & Web logging across:
// 1. init-and-db.log (Database, Migrations, Application Startup)
// 2. printer.log (Thermal, QZ Tray, Silent Printing, Cash Drawer)
// 3. invoice-previews/ (Invoice Screenshots & Styled Snapshots)
// 4. system-errors.log (Uncaught Crashes, React Boundaries, Failures)
// ═══════════════════════════════════════════════════════════════════════════

import html2canvas from 'html2canvas';

export interface LogPaths {
  logsDir: string;
  invoicePreviewsDir: string;
  initLogFile: string;
  printerLogFile: string;
  systemErrorsLogFile: string;
}

export interface PrinterLogPayload {
  message: string;
  isError?: boolean;
  printerName?: string;
  docType?: string;
  details?: any;
}

export interface InvoiceSnapshotPayload {
  invoiceNumber: string;
  element?: HTMLElement | null;
  htmlContent?: string;
  metadata?: Record<string, any>;
}

class SystemLogger {
  private isDesktop: boolean;

  constructor() {
    this.isDesktop = typeof window !== 'undefined' && !!(window as any).electronAPI?.isDesktop;
    this.setupGlobalHandlers();
  }

  private setupGlobalHandlers() {
    if (typeof window === 'undefined') return;

    // Capture unhandled window runtime errors
    window.addEventListener('error', (event) => {
      this.logError(
        `Unhandled Window Error: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`,
        event.error,
        'WindowErrorListener'
      );
    });

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.logError(
        `Unhandled Promise Rejection: ${String(event.reason)}`,
        event.reason,
        'PromiseRejectionListener'
      );
    });
  }

  /**
   * Log Application Startup & Local IndexedDB / Dexie operations
   */
  public async logInit(message: string, isError = false, data?: any): Promise<void> {
    const timestamp = new Date().toISOString();
    const tag = isError ? '[INIT-ERROR]' : '[INIT-INFO]';
    const formatted = `[${timestamp}] ${tag} ${message}`;

    if (isError) {
      console.error(formatted, data || '');
    } else {
      console.info(formatted, data || '');
    }

    if (this.isDesktop && (window as any).electronAPI?.logInit) {
      try {
        await (window as any).electronAPI.logInit(message, isError, data);
      } catch (err) {
        console.warn('Electron logInit bridge error:', err);
      }
    }
  }

  /**
   * Log Printer Events (Thermal, Silent, QZ Tray, Browser Dialogs)
   */
  public async logPrinter(payload: PrinterLogPayload): Promise<void> {
    const timestamp = new Date().toISOString();
    const tag = payload.isError ? '[PRINTER-FAIL]' : '[PRINTER-OK]';
    const formatted = `[${timestamp}] ${tag} [${payload.docType || 'General'}] (Printer: ${payload.printerName || 'Default'}) ${payload.message}`;

    if (payload.isError) {
      console.error(formatted, payload.details || '');
    } else {
      console.info(formatted, payload.details || '');
    }

    if (this.isDesktop && (window as any).electronAPI?.logPrinter) {
      try {
        await (window as any).electronAPI.logPrinter(payload);
      } catch (err) {
        console.warn('Electron logPrinter bridge error:', err);
      }
    }
  }

  /**
   * Log System Crashes & Boundary Failures
   */
  public async logError(message: string, error?: any, context?: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const stack = error?.stack || (typeof error === 'string' ? error : JSON.stringify(error || {}));
    const formatted = `[${timestamp}] [SYSTEM-CRASH] [${context || 'General'}] ${message}`;

    console.error(formatted, '\nStack:', stack);

    if (this.isDesktop && (window as any).electronAPI?.logSystemError) {
      try {
        await (window as any).electronAPI.logSystemError({
          message,
          stack,
          context,
        });
      } catch (err) {
        console.warn('Electron logSystemError bridge error:', err);
      }
    }
  }

  /**
   * Captures high-res screenshot and styled HTML of printed invoices
   * Saves into 3amory-pos-logs/invoice-previews/
   */
  public async saveInvoiceSnapshot(params: InvoiceSnapshotPayload): Promise<{ success: boolean; path?: string }> {
    try {
      let imageBase64: string | undefined;
      let htmlContent: string | undefined = params.htmlContent;

      if (params.element) {
        // Render element to high-res canvas
        const canvas = await html2canvas(params.element, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          windowWidth: 1024,
        });
        imageBase64 = canvas.toDataURL('image/png');
        if (!htmlContent) {
          htmlContent = params.element.outerHTML;
        }
      }

      if (this.isDesktop && (window as any).electronAPI?.saveInvoicePreview) {
        const result = await (window as any).electronAPI.saveInvoicePreview({
          invoiceNumber: params.invoiceNumber || `INV_${Date.now()}`,
          imageBase64,
          htmlContent,
          metadata: params.metadata,
        });
        return result || { success: true };
      }

      return { success: true };
    } catch (err) {
      this.logError(`Failed to save invoice screenshot: ${params.invoiceNumber}`, err, 'InvoiceSnapshot');
      return { success: false };
    }
  }

  /**
   * Open the native OS file explorer pointing to the logs directory
   */
  public async openLogsFolder(): Promise<boolean> {
    if (this.isDesktop && (window as any).electronAPI?.openLogsFolder) {
      try {
        return await (window as any).electronAPI.openLogsFolder();
      } catch (err) {
        console.warn('Failed to open logs folder:', err);
      }
    } else {
      alert('مجلد السجلات متاح على نسخة سطح المكتب (Windows / Linux) في مسار: ~/3amory-pos-logs');
    }
    return false;
  }

  /**
   * Retrieve paths of the log files
   */
  public async getLogPaths(): Promise<LogPaths | null> {
    if (this.isDesktop && (window as any).electronAPI?.getLogPaths) {
      try {
        return await (window as any).electronAPI.getLogPaths();
      } catch {
        return null;
      }
    }
    return null;
  }
}

export const systemLogger = new SystemLogger();
