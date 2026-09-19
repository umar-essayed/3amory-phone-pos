import type {
  SaleInvoice,
  StoreSettings,
  WalletTransaction,
  RepairTicket,
  Phone,
  Shift,
  Accessory,
} from '../types';
import { systemLogger } from './logger';

export type PrintDocumentType =
  | 'sale_receipt'
  | 'wallet_receipt'
  | 'repair_ticket'
  | 'used_phone_contract'
  | 'barcode_label'
  | 'shift_report'
  | 'return_receipt';

export interface PrintData {
  type: PrintDocumentType;
  invoice?: SaleInvoice;
  walletTx?: WalletTransaction;
  repair?: RepairTicket;
  phone?: Phone;
  shift?: Shift;
  accessory?: Accessory;
  settings: StoreSettings;
}

// ═══════════════════════════════════════════════════════════════════════════
// ESC/POS Command Constants for Desktop Thermal Printers (80mm & 58mm)
// ═══════════════════════════════════════════════════════════════════════════
export const ESC_POS = {
  INIT: new Uint8Array([0x1b, 0x40]), // Initialize printer
  ALIGN_LEFT: new Uint8Array([0x1b, 0x61, 0x00]), // Left align
  ALIGN_CENTER: new Uint8Array([0x1b, 0x61, 0x01]), // Center align
  ALIGN_RIGHT: new Uint8Array([0x1b, 0x61, 0x02]), // Right align
  BOLD_ON: new Uint8Array([0x1b, 0x45, 0x01]), // Bold font ON
  BOLD_OFF: new Uint8Array([0x1b, 0x45, 0x00]), // Bold font OFF
  DOUBLE_SIZE_ON: new Uint8Array([0x1d, 0x21, 0x11]), // Double width & height
  DOUBLE_SIZE_OFF: new Uint8Array([0x1d, 0x21, 0x00]), // Normal text
  FEED_LINES: (n: number) => new Uint8Array([0x1b, 0x64, n]), // Feed n lines
  CUT_PAPER_FULL: new Uint8Array([0x1d, 0x56, 0x00]), // Full cut
  CUT_PAPER_PARTIAL: new Uint8Array([0x1d, 0x56, 0x01]), // Partial cut
  FEED_AND_CUT: new Uint8Array([0x1d, 0x56, 0x41, 0x03]), // Feed 3 lines & cut
  DRAWER_KICK: new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]), // Kick drawer pin 2
  DRAWER_KICK_PIN5: new Uint8Array([0x1b, 0x70, 0x01, 0x19, 0xfa]), // Kick drawer pin 5
};

// ═══════════════════════════════════════════════════════════════════════════
// Desktop Bridge / Native Printer Detection
// ═══════════════════════════════════════════════════════════════════════════
export interface DesktopPrinterBridge {
  isDesktop: boolean;
  type: 'electron' | 'tauri' | 'webserial' | 'webusb' | 'browser';
  printRaw?: (data: Uint8Array) => Promise<boolean>;
  printSilent?: (options?: any) => Promise<boolean>;
  kickDrawer?: () => Promise<boolean>;
}

export function detectDesktopEnvironment(): DesktopPrinterBridge {
  const win = window as any;

  // Electron Bridge
  if (win.electronAPI?.isDesktop) {
    return {
      isDesktop: true,
      type: 'electron',
      printRaw: async (data: Uint8Array) => win.electronAPI.printRaw(data),
      printSilent: async (options?: any) => win.electronAPI.printSilent(options),
      kickDrawer: async () => win.electronAPI.kickDrawer(),
    };
  }

  // Tauri Bridge
  if (win.__TAURI__) {
    return {
      isDesktop: true,
      type: 'tauri',
      printRaw: async (data: Uint8Array) => {
        try {
          await win.__TAURI__.invoke('plugin:printer|print_raw', { data: Array.from(data) });
          return true;
        } catch {
          return false;
        }
      },
      kickDrawer: async () => {
        try {
          await win.__TAURI__.invoke('plugin:printer|kick_drawer');
          return true;
        } catch {
          return false;
        }
      },
    };
  }

  // Modern WebSerial API (Connect directly to USB-to-Serial thermal printers)
  if ('serial' in navigator) {
    return {
      isDesktop: false,
      type: 'webserial',
      printRaw: async (data: Uint8Array) => {
        try {
          const ports = await (navigator as any).serial.getPorts();
          if (ports.length > 0) {
            const port = ports[0];
            await port.open({ baudRate: 9600 });
            const writer = port.writable.getWriter();
            await writer.write(data);
            writer.releaseLock();
            await port.close();
            return true;
          }
        } catch (err) {
          console.warn('WebSerial print note:', err);
        }
        return false;
      },
    };
  }

  return {
    isDesktop: false,
    type: 'browser',
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Raw ESC/POS Buffer Generator for Desktop Thermal Printers
// ═══════════════════════════════════════════════════════════════════════════
export function buildEscPosReceiptBuffer(printData: PrintData): Uint8Array {
  const chunks: Uint8Array[] = [];
  const encoder = new TextEncoder();

  const append = (buf: Uint8Array) => chunks.push(buf);
  const appendText = (text: string) => chunks.push(encoder.encode(text + '\n'));

  // 1. Initialize
  append(ESC_POS.INIT);

  // 2. Open Cash Drawer (if sale)
  if (printData.type === 'sale_receipt' || printData.type === 'wallet_receipt') {
    append(ESC_POS.DRAWER_KICK);
  }

  // 3. Header
  append(ESC_POS.ALIGN_CENTER);
  append(ESC_POS.DOUBLE_SIZE_ON);
  appendText(printData.settings.storeName || 'الغندور فون');
  append(ESC_POS.DOUBLE_SIZE_OFF);

  if (printData.settings.phone1) {
    appendText(`Tel: ${printData.settings.phone1}`);
  }
  if (printData.settings.address) {
    appendText(printData.settings.address);
  }

  appendText('--------------------------------');

  // 4. Receipt details
  if (printData.type === 'sale_receipt' && printData.invoice) {
    append(ESC_POS.ALIGN_LEFT);
    appendText(`Invoice: ${printData.invoice.invoiceNumber}`);
    appendText(`Date: ${new Date(printData.invoice.createdAt).toLocaleString('ar-EG')}`);
    appendText(`Cashier: ${printData.invoice.cashierName}`);
    appendText('--------------------------------');

    for (const item of printData.invoice.items) {
      const line = `${item.name.slice(0, 16)} x${item.quantity} = ${item.totalPrice} ${printData.settings.currency}`;
      appendText(line);
      if (item.imei && printData.settings.showImeiOnReceipt) {
        appendText(`  IMEI: ${item.imei}`);
      }
    }

    appendText('================================');
    append(ESC_POS.BOLD_ON);
    appendText(`TOTAL: ${printData.invoice.total} ${printData.settings.currency}`);
    append(ESC_POS.BOLD_OFF);
    appendText(`Payment: ${printData.invoice.paymentMethod}`);
  } else if (printData.type === 'wallet_receipt' && printData.walletTx) {
    append(ESC_POS.ALIGN_LEFT);
    appendText(`TX ID: ${printData.walletTx.id}`);
    appendText(`Type: ${printData.walletTx.type}`);
    appendText(`Wallet: ${printData.walletTx.walletName}`);
    appendText(`Amount: ${printData.walletTx.amount} ${printData.settings.currency}`);
    appendText(`Commission: ${printData.walletTx.commission} ${printData.settings.currency}`);
    if (printData.walletTx.customerPhone) {
      appendText(`Phone: ${printData.walletTx.customerPhone}`);
    }
  }

  // 5. Footer & Cut
  appendText('--------------------------------');
  append(ESC_POS.ALIGN_CENTER);
  if (printData.settings.receiptFooter) {
    appendText(printData.settings.receiptFooter);
  }
  appendText('Thank You!');
  append(ESC_POS.FEED_AND_CUT);

  // Merge chunks into single Uint8Array
  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// Cash Drawer Kick Command (Open Drawer)
// ═══════════════════════════════════════════════════════════════════════════
export async function kickCashDrawer(targetPrinterName?: string): Promise<boolean> {
  const bridge = detectDesktopEnvironment();
  if (bridge.kickDrawer) {
    try {
      const res = await bridge.kickDrawer();
      if (res) return true;
    } catch {}
  }
  if (bridge.printRaw) {
    try {
      return await bridge.printRaw(ESC_POS.DRAWER_KICK);
    } catch {}
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Unified Print Trigger (Desktop Native Bridge -> Print Preview Modal)
// ═══════════════════════════════════════════════════════════════════════════
export async function triggerPrint(printData: PrintData): Promise<void> {
  const docInfo = `نوع: ${printData.type} | المحل: ${printData.settings.storeName}`;
  await systemLogger.logPrinter({
    message: `بدء معالجة أمر طباعة (${docInfo})`,
    docType: printData.type,
    printerName: printData.settings.paperSize,
  });

  const selectedPrinterName =
    printData.settings.selectedPrinter ||
    (printData.settings as any).printerName ||
    '';

  const isSilentEnabled =
    printData.settings.silentPrintEnabled ||
    (printData.settings.autoPrintReceipt && !!selectedPrinterName);

  // 1. If running in Desktop mode and silent print is requested, attempt direct OS silent print
  const bridge = detectDesktopEnvironment();
  if (bridge.isDesktop && isSilentEnabled) {
    if (bridge.printSilent) {
      try {
        await systemLogger.logPrinter({
          message: `محاولة الطباعة الصامتة المباشرة لنظام التشغيل على الطابعة: ${selectedPrinterName || 'الافتراضية'}`,
          docType: printData.type,
          printerName: selectedPrinterName,
        });
        const printed = await bridge.printSilent({ deviceName: selectedPrinterName });
        if (printed) {
          await systemLogger.logPrinter({
            message: 'تمت الطباعة الصامتة بنجاح عبر نظام التشغيل',
            docType: printData.type,
            printerName: selectedPrinterName,
          });
          return;
        }
      } catch (err: any) {
        console.warn('Native printSilent fallback note:', err);
      }
    }

    if (bridge.printRaw) {
      try {
        await systemLogger.logPrinter({
          message: 'محاولة الطباعة المباشرة عبر منفذ سطح المكتب الأصلي (Desktop Native Bridge)',
          docType: printData.type,
        });
        const rawBuffer = buildEscPosReceiptBuffer(printData);
        const printed = await bridge.printRaw(rawBuffer);
        if (printed) {
          await systemLogger.logPrinter({
            message: 'تمت الطباعة بنجاح عبر مشغل سطح المكتب الأصلي',
            docType: printData.type,
          });
          return;
        }
      } catch (err: any) {
        console.warn('Native desktop print fallback:', err);
      }
    }
  }

  // 2. Fallback / standard: dispatch print event for custom preview & browser print
  await systemLogger.logPrinter({
    message: 'فتح نافذة معاينة الفاتورة للطباعة',
    docType: printData.type,
    printerName: printData.settings.paperSize,
  });
  const event = new CustomEvent('mobile-pos-print', { detail: printData });
  window.dispatchEvent(event);
}
