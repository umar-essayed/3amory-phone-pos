// ═══════════════════════════════════════════════════════════════════════════
// El Ghandour Phone - System Printer Scanner & Hardware Bridge
// Discovers all physical/thermal printers directly from the OS (CUPS/Spooler)
// ═══════════════════════════════════════════════════════════════════════════

export interface DiscoveredPrinter {
  name: string;
  isDefault: boolean;
  source: 'electron_system' | 'browser';
  displayName: string;
}

export class PrinterScanner {
  /**
   * Fetches all installed printers directly from OS (Electron Windows Spooler & Linux CUPS)
   */
  public async getAllPrinters(): Promise<DiscoveredPrinter[]> {
    const printerMap = new Map<string, DiscoveredPrinter>();

    // Native Electron Desktop Printers
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

    const list = Array.from(printerMap.values());
    // Sort: default printer first, then alphabetically
    return list.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return a.name.localeCompare(b.name);
    });
  }
}

export const printerScanner = new PrinterScanner();
