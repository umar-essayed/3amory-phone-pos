// ═══════════════════════════════════════════════════════════════════════════
// El Ghandour Phone POS - Barcode & Thermal Label Print Engine
// Implements the Golden Architecture from BARCODE_PRINTING_MASTER_GUIDE.md
// Supports:
// 1. 203 DPI Canvas Rendering with Golden Coordinates (Cairo RTL)
// 2. Pure TSPL Binary Generation with 1-Bit Packed Monochrome Bitmap
// 3. Labelary REST API PDF & PNG generation
// 4. WebUSB Direct Raw Hardware Dispatch
// ═══════════════════════════════════════════════════════════════════════════

import JsBarcode from 'jsbarcode';

export interface BarcodeLabelItem {
  id: string;
  name: string;
  barcode: string;
  price: number | string;
  storeName?: string;
  origin?: string;
  quantity?: number;
}

export interface GoldenLabelConfig {
  widthMm: number;
  heightMm: number;
  gapMm: number;
  dpi: number;
  showStoreName: boolean;
  storeName: string;
  showProductName: boolean;
  showPrice: boolean;
  showOrigin: boolean;
  originText: string;
}

export const GOLDEN_LABEL_CONFIG: GoldenLabelConfig = {
  widthMm: 42.5,
  heightMm: 25.0,
  gapMm: 1.0,
  dpi: 203,
  showStoreName: true,
  storeName: 'الغندور فون',
  showProductName: true,
  showPrice: true,
  showOrigin: true,
  originText: 'ضمان محلي',
};

export class BarcodePrintEngine {
  /**
   * 1. Render single label to HTML5 Canvas at exact 203 DPI resolution
   * Following Section 2 & 9 of BARCODE_PRINTING_MASTER_GUIDE.md
   */
  public static renderLabelToCanvas(
    item: BarcodeLabelItem,
    cfg: GoldenLabelConfig = GOLDEN_LABEL_CONFIG
  ): HTMLCanvasElement {
    const dotsPerMm = cfg.dpi / 25.4;
    const w = Math.round(cfg.widthMm * dotsPerMm);
    const h = Math.round(cfg.heightMm * dotsPerMm);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return canvas;

    // Pure white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    // 1. Store Name (Centered, Cairo Bold)
    if (cfg.showStoreName) {
      ctx.fillStyle = '#000000';
      ctx.textBaseline = 'top';
      ctx.textAlign = 'center';
      const storeFontSize = Math.round(20 * (cfg.dpi / 203));
      ctx.font = `bold ${storeFontSize}px 'Cairo', 'Segoe UI', sans-serif`;
      ctx.fillText(item.storeName || cfg.storeName, 20.6 * dotsPerMm, 1.8 * dotsPerMm);
    }

    // 2. Product Name (Centered, Cairo Bold, truncated after 28 chars)
    if (cfg.showProductName) {
      ctx.fillStyle = '#000000';
      ctx.textBaseline = 'top';
      ctx.textAlign = 'center';
      const nameFontSize = Math.round(15 * (cfg.dpi / 203));
      ctx.font = `bold ${nameFontSize}px 'Cairo', 'Segoe UI', sans-serif`;
      let title = item.name || '';
      if (title.length > 28) title = title.substring(0, 27) + '...';
      ctx.fillText(title, 20.7 * dotsPerMm, 5.2 * dotsPerMm);
    }

    // 3. Barcode (Code 128, crisp 2-dot narrow bar)
    if (item.barcode) {
      try {
        const helperCanvas = document.createElement('canvas');
        JsBarcode(helperCanvas, item.barcode, {
          format: 'CODE128',
          width: 2,
          height: Math.round(44 * (cfg.dpi / 203)),
          displayValue: true,
          fontSize: 12,
          font: 'Cairo, monospace',
          margin: 0,
        });

        const bcW = helperCanvas.width;
        const bcH = helperCanvas.height;
        const bcX = Math.max(4, Math.round((w - bcW) / 2));
        ctx.drawImage(helperCanvas, bcX, 9.0 * dotsPerMm, bcW, bcH);
      } catch (err) {
        console.warn('JsBarcode canvas error:', err);
      }
    }

    // 4. Selling Price (Left Aligned, Cairo 900)
    if (cfg.showPrice) {
      ctx.fillStyle = '#000000';
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      const priceFontSize = Math.round(17 * (cfg.dpi / 203));
      ctx.font = `900 ${priceFontSize}px 'Cairo', sans-serif`;
      const priceVal = typeof item.price === 'number' ? item.price.toLocaleString('ar-EG') : item.price;
      ctx.fillText(`${priceVal} ج.م`, 4.8 * dotsPerMm, 18.5 * dotsPerMm);
    }

    // 5. Origin / Guarantee Note (Right Aligned, Cairo 600)
    if (cfg.showOrigin) {
      ctx.fillStyle = '#000000';
      ctx.textBaseline = 'top';
      ctx.textAlign = 'right';
      const originFontSize = Math.round(12 * (cfg.dpi / 203));
      ctx.font = `600 ${originFontSize}px 'Cairo', sans-serif`;
      ctx.fillText(item.origin || cfg.originText, (cfg.widthMm - 4.5) * dotsPerMm, 18.5 * dotsPerMm);
    }

    return canvas;
  }

  /**
   * 2. Convert Canvas to 1-Bit Packed Monochrome Bitmap
   * Threshold luminance: 0.299*R + 0.587*G + 0.114*B < 180 = Black (0 in TSPL)
   */
  public static canvasTo1BitMonochrome(canvas: HTMLCanvasElement): {
    widthBytes: number;
    height: number;
    data: Uint8Array;
  } {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('No 2d context');

    const w = canvas.width;
    const h = canvas.height;
    const imgData = ctx.getImageData(0, 0, w, h);
    const rgba = imgData.data;

    const widthBytes = Math.ceil(w / 8);
    const packed = new Uint8Array(widthBytes * h);
    packed.fill(255); // 0xFF = White

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const r = rgba[idx];
        const g = rgba[idx + 1];
        const b = rgba[idx + 2];
        const a = rgba[idx + 3];

        const isBlack = a >= 128 && 0.299 * r + 0.587 * g + 0.114 * b < 180;
        if (isBlack) {
          const byteIdx = y * widthBytes + Math.floor(x / 8);
          const bitIdx = x % 8;
          packed[byteIdx] &= ~(1 << (7 - bitIdx)); // 0 = Burn thermal head
        }
      }
    }

    return { widthBytes, height: h, data: packed };
  }

  /**
   * 3. Generate raw TSPL binary payload for TSC / Xprinter / Rongta / Gprinter
   */
  public static generateTSPLBinary(
    items: BarcodeLabelItem[],
    cfg: GoldenLabelConfig = GOLDEN_LABEL_CONFIG
  ): Uint8Array {
    const encoder = new TextEncoder();
    const chunks: Uint8Array[] = [];

    items.forEach((item) => {
      const qty = item.quantity || 1;
      const canvas = this.renderLabelToCanvas(item, cfg);
      const mono = this.canvasTo1BitMonochrome(canvas);

      const header =
        `SIZE ${cfg.widthMm} mm, ${cfg.heightMm} mm\n` +
        `GAP ${cfg.gapMm} mm, 0 mm\n` +
        `DIRECTION 1\n` +
        `CLS\n` +
        `BITMAP 0,0,${mono.widthBytes},${mono.height},0,`;

      chunks.push(encoder.encode(header));
      chunks.push(mono.data);
      chunks.push(encoder.encode(`\nPRINT ${qty},1\n`));
    });

    const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
    const result = new Uint8Array(totalLen);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }

  /**
   * 4. Direct WebUSB raw binary dispatch
   */
  public static async sendToWebUSB(payload: Uint8Array): Promise<boolean> {
    if (typeof navigator === 'undefined' || !('usb' in navigator)) {
      throw new Error('WebUSB غير مدعوم في هذا المتصفح.');
    }

    const usb = (navigator as any).usb;
    const device = await usb.requestDevice({ filters: [] });
    await device.open();
    if (device.configuration === null) {
      await device.selectConfiguration(1);
    }
    await device.claimInterface(0);

    const endpoint = device.configuration.interfaces[0].alternate.endpoints.find(
      (e: any) => e.direction === 'out'
    );
    const endpointNum = endpoint ? endpoint.endpointNumber : 1;

    await device.transferOut(endpointNum, payload);
    await device.close();
    return true;
  }

  /**
   * 5. Download multi-label PDF via Labelary REST API
   * Generates a perfectly calibrated multi-page PDF ready for any printer driver
   */
  public static async downloadLabelaryPdf(
    items: BarcodeLabelItem[],
    cfg: GoldenLabelConfig = GOLDEN_LABEL_CONFIG
  ): Promise<Blob> {
    const widthInches = (cfg.widthMm / 25.4).toFixed(4);
    const heightInches = (cfg.heightMm / 25.4).toFixed(4);

    // Combine ZPL blocks for all items
    let combinedZpl = '';
    items.forEach((item) => {
      const qty = item.quantity || 1;
      for (let i = 0; i < qty; i++) {
        combinedZpl += `^XA^PW340^LL200^LS0\n`;
        if (cfg.showStoreName) {
          combinedZpl += `^FO0,14^FB340,1,0,C^A0N,22,22^FD${item.storeName || cfg.storeName}^FS\n`;
        }
        if (cfg.showProductName) {
          combinedZpl += `^FO0,42^FB340,1,0,C^A0N,18,18^FD${item.name}^FS\n`;
        }
        if (item.barcode) {
          combinedZpl += `^BY2,2,45^FO50,72^BCN,45,Y,N,N^FD${item.barcode}^FS\n`;
        }
        if (cfg.showPrice) {
          combinedZpl += `^FO20,150^A0N,20,20^FDEGP ${item.price}^FS\n`;
        }
        if (cfg.showOrigin) {
          combinedZpl += `^FO220,150^A0N,16,16^FD${item.origin || cfg.originText}^FS\n`;
        }
        combinedZpl += `^XZ\n`;
      }
    });

    const url = `https://api.labelary.com/v1/printers/8dpmm/labels/${widthInches}x${heightInches}/`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/pdf',
      },
      body: combinedZpl,
    });

    if (!resp.ok) {
      throw new Error(`Labelary API returned error ${resp.status}`);
    }

    return await resp.blob();
  }
}
