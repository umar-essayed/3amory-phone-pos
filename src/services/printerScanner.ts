// ═══════════════════════════════════════════════════════════════════════════
// 3amory phone - System Printer Scanner & Hardware Bridge
// Discovers all physical/thermal printers from OS & QZ Tray automatically
// ═══════════════════════════════════════════════════════════════════════════

import { qzTrayService } from './qzTrayService';
import { systemLogger } from './logger';

export interface DiscoveredPrinter {
  name: string;
  isDefault: boolean;
  source: 'electron_system' | 'qz_tray';
  displayName: string;
}

export class PrinterScanner {
  /**
   * Fetches all installed printers from both OS (Electron) and QZ Tray
   */
  public async getAllPrinters(): Promise<DiscoveredPrinter[]> {
    const printerMap = new Map<string, DiscoveredPrinter>();

    // 1. Native Electron Desktop Printers (Windows Spooler & Linux CUPS)
    if (typeof window !== 'undefined' && (window as any).electronAPI?.getPrinters) {
      try {
        const sysPrinters: any[] = await (window as any).electronAPI.getPrinters();
        if (Array.isArray(sysPrinters)) {
          for (const p of sysPrinters) {
            const pName = p.name || p.displayName;
            if (pName) {
              printerMap.set(pName, {
                name: pName,
                isDefault: !!p.isDefault,
                source: 'electron_system',
                displayName: `${pName} ${p.isDefault ? '(طابعة النظام الافتراضية)' : ''}`,
              });
            }
          }
        }
      } catch (err) {
        console.warn('Electron getPrinters note:', err);
      }
    }

    // 2. QZ Tray Server Printers (if running)
    try {
      if (qzTrayService.getStatus().connected) {
        const qzPrinters = await qzTrayService.refreshPrinters();
        const defaultQz = qzTrayService.getStatus().defaultPrinter;
        for (const qzP of qzPrinters) {
          if (!printerMap.has(qzP)) {
            printerMap.set(qzP, {
              name: qzP,
              isDefault: qzP === defaultQz,
              source: 'qz_tray',
              displayName: `${qzP} (QZ Tray Server)`,
            });
          }
        }
      }
    } catch (err) {
      console.warn('QZ Tray printers check note:', err);
    }

    const list = Array.from(printerMap.values());
    // Sort: default printer first, then alphabetically
    return list.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Attempt to start QZ Tray application if installed on user machine
   */
  public async launchQzTray(): Promise<{ success: boolean; path?: string }> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.launchQzTray) {
      try {
        const res = await (window as any).electronAPI.launchQzTray();
        if (res?.success) {
          await systemLogger.logPrinter({
            message: `تم تشغيل برنامج QZ Tray تلقائياً من المسار: ${res.path}`,
          });
          return res;
        }
      } catch (err) {
        console.warn('Launch QZ Tray note:', err);
      }
    }
    return { success: false };
  }

  /**
   * Open the official download page for QZ Tray
   */
  public openQzDownloadPage() {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.downloadQzTray) {
      (window as any).electronAPI.downloadQzTray();
    } else {
      window.open('https://qz.io/download/', '_blank');
    }
  }
}

export const printerScanner = new PrinterScanner();
