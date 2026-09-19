import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import JsBarcode from 'jsbarcode';
import {
  Barcode,
  Search,
  Printer,
  Plus,
  Minus,
  Trash2,
  Settings2,
  Tag,
  Smartphone,
  Sparkles,
  Layers,
  RotateCcw,
  Check,
  CheckCircle2,
  Info,
  Copy,
  ExternalLink,
  ShieldCheck,
  Download,
  Usb,
} from 'lucide-react';
import { db } from '../db';
import { useModal } from '../context/ModalContext';
import { systemLogger } from '../services/logger';
import { BarcodePrintEngine } from '../services/barcodePrintEngine';
import type { Accessory, Phone, StoreSettings } from '../types';

export interface BarcodePrintItem {
  id: string;
  name: string;
  barcode: string;
  price: number;
  quantity: number;
  type: 'accessory' | 'phone' | 'custom';
  category?: string;
  stock?: number;
  origin?: string;
}

export interface LabelDimensionPreset {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  dotsWidth: number; // @ 203 DPI
  dotsHeight: number;
  isSheet?: boolean;
}

export const LABEL_PRESETS: LabelDimensionPreset[] = [
  {
    id: '42.5x25',
    name: '42.5 × 25 مم (القياسي الذهبي المعتمد)',
    widthMm: 42.5,
    heightMm: 25.0,
    dotsWidth: 340,
    dotsHeight: 200,
  },
  {
    id: '38x25',
    name: '38 × 25 مم (رول الموبايل الشائع)',
    widthMm: 38.0,
    heightMm: 25.0,
    dotsWidth: 304,
    dotsHeight: 200,
  },
  {
    id: '50x25',
    name: '50 × 25 مم (رول عريض)',
    widthMm: 50.0,
    heightMm: 25.0,
    dotsWidth: 400,
    dotsHeight: 200,
  },
  {
    id: '50x30',
    name: '50 × 30 مم (رول كبير)',
    widthMm: 50.0,
    heightMm: 30.0,
    dotsWidth: 400,
    dotsHeight: 240,
  },
  {
    id: '40x30',
    name: '40 × 30 مم',
    widthMm: 40.0,
    heightMm: 30.0,
    dotsWidth: 320,
    dotsHeight: 240,
  },
  {
    id: 'a4',
    name: 'ورقة A4 ملصقات مجمعة (A4 Sheet)',
    widthMm: 210,
    heightMm: 297,
    dotsWidth: 1680,
    dotsHeight: 2376,
    isSheet: true,
  },
];

// Single Sticker Preview Component
const SingleBarcodeSticker: React.FC<{
  item: BarcodePrintItem;
  storeName: string;
  showStoreName: boolean;
  showProductName: boolean;
  showPrice: boolean;
  showOrigin: boolean;
  originText: string;
  preset: LabelDimensionPreset;
  scale?: number;
}> = ({
  item,
  storeName,
  showStoreName,
  showProductName,
  showPrice,
  showOrigin,
  originText,
  preset,
  scale = 1,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (svgRef.current && item.barcode) {
      try {
        JsBarcode(svgRef.current, item.barcode, {
          format: 'CODE128',
          width: preset.widthMm > 40 ? 1.8 : 1.5,
          height: preset.heightMm > 25 ? 36 : 28,
          displayValue: true,
          fontSize: 11,
          font: 'Cairo, sans-serif',
          margin: 0,
          background: 'transparent',
          lineColor: '#000000',
        });
      } catch (err) {
        console.warn('Barcode render note:', err);
      }
    }
  }, [item.barcode, preset]);

  return (
    <div
      className="bg-white text-black rounded border border-slate-300 shadow-sm flex flex-col justify-between items-center text-center select-none overflow-hidden"
      style={{
        width: `${preset.widthMm * 3.78 * scale}px`,
        height: `${preset.heightMm * 3.78 * scale}px`,
        padding: `${1.5 * scale}mm`,
        boxSizing: 'border-box',
        direction: 'rtl',
      }}
    >
      {/* 1. Store Name */}
      {showStoreName && (
        <div
          className="font-black text-slate-900 truncate w-full leading-tight font-display"
          style={{ fontSize: `${Math.max(9, 12 * scale)}px` }}
        >
          {storeName || 'الغندور فون'}
        </div>
      )}

      {/* 2. Product Name */}
      {showProductName && (
        <div
          className="font-bold text-slate-800 truncate w-full leading-tight px-0.5"
          style={{ fontSize: `${Math.max(8, 10 * scale)}px` }}
          title={item.name}
        >
          {item.name}
        </div>
      )}

      {/* 3. Barcode (Mandatory, Always Visible) */}
      <div className="flex items-center justify-center w-full my-auto overflow-hidden py-0.5">
        <svg ref={svgRef} className="max-w-full" style={{ maxHeight: '100%' }}></svg>
      </div>

      {/* 4. Footer: Price & Origin */}
      <div className="w-full flex items-center justify-between px-1 font-sans border-t border-slate-200/80 pt-0.5 mt-auto">
        {showPrice ? (
          <span
            className="font-black text-slate-950 tracking-tight"
            style={{ fontSize: `${Math.max(9, 11 * scale)}px` }}
          >
            {item.price.toLocaleString('ar-EG')} ج.م
          </span>
        ) : <span />}

        {showOrigin && (
          <span
            className="font-semibold text-slate-600 truncate max-w-[50%]"
            style={{ fontSize: `${Math.max(7, 9 * scale)}px` }}
          >
            {item.origin || originText || 'ضمان محلي'}
          </span>
        )}
      </div>
    </div>
  );
};

export const BarcodeView: React.FC = () => {
  const { showToast, showAlert, showConfirm } = useModal();

  // Settings
  const settings = useLiveQuery(async () => {
    return (await db.settings.get(1)) || (await db.settings.toCollection().first());
  });

  // DB Data
  const accessories = useLiveQuery(() => db.accessories.toArray()) || [];
  const phones = useLiveQuery(() => db.phones.toArray()) || [];

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | 'accessories' | 'phones'>('all');

  // Print Queue
  const [printQueue, setPrintQueue] = useState<BarcodePrintItem[]>([]);

  // Label Configuration Toggles
  const [showStoreName, setShowStoreName] = useState(true);
  const [customStoreName, setCustomStoreName] = useState('الغندور فون');
  const [showProductName, setShowProductName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showOrigin, setShowOrigin] = useState(true);
  const [originText, setOriginText] = useState('ضمان أصلي');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('42.5x25');

  // Custom Item Form
  const [customName, setCustomName] = useState('');
  const [customBarcode, setCustomBarcode] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customQty, setCustomQty] = useState(1);
  const [activeTab, setActiveTab] = useState<'queue' | 'custom' | 'sheet'>('queue');

  // Printing state
  const [isPrinting, setIsPrinting] = useState(false);

  // Sync settings when loaded
  useEffect(() => {
    if (settings?.storeName) {
      setCustomStoreName(settings.storeName);
    }
    if (settings?.barcodeLabelSize) {
      const match = LABEL_PRESETS.find((p) => p.id === settings.barcodeLabelSize);
      if (match) {
        setSelectedPresetId(match.id);
      }
    }
  }, [settings]);

  // Selected Preset
  const currentPreset = LABEL_PRESETS.find((p) => p.id === selectedPresetId) || LABEL_PRESETS[0];

  // Filtered Products from DB
  const filteredProducts = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const results: BarcodePrintItem[] = [];

    if (selectedTypeFilter === 'all' || selectedTypeFilter === 'accessories') {
      accessories.forEach((acc) => {
        const matches =
          !q ||
          acc.name.toLowerCase().includes(q) ||
          acc.barcode.toLowerCase().includes(q) ||
          acc.category.toLowerCase().includes(q);
        if (matches) {
          results.push({
            id: `acc_${acc.id}`,
            name: acc.name,
            barcode: acc.barcode,
            price: acc.sellPriceRetail,
            quantity: 1,
            type: 'accessory',
            category: acc.category,
            stock: acc.stockQuantity,
          });
        }
      });
    }

    if (selectedTypeFilter === 'all' || selectedTypeFilter === 'phones') {
      phones.forEach((ph) => {
        const phoneName = `${ph.brand} ${ph.model} ${ph.storage || ''}`;
        const matches =
          !q ||
          phoneName.toLowerCase().includes(q) ||
          ph.imei1?.toLowerCase().includes(q);
        if (matches) {
          results.push({
            id: `ph_${ph.id}`,
            name: phoneName,
            barcode: ph.imei1 || `PH${ph.id}`,
            price: ph.sellPrice || ph.costPrice || 0,
            quantity: 1,
            type: 'phone',
            category: ph.condition === 'used' ? 'مستعمل' : 'جديد',
            stock: ph.status === 'available' ? 1 : 0,
          });
        }
      });
    }

    return results;
  }, [accessories, phones, searchQuery, selectedTypeFilter]);

  // Add Item to Queue
  const handleAddToQueue = (item: BarcodePrintItem, count: number = 1) => {
    setPrintQueue((prev) => {
      const idx = prev.findIndex((p) => p.id === item.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx].quantity += count;
        return copy;
      } else {
        return [...prev, { ...item, quantity: count }];
      }
    });
    showToast(`تمت إضافة "${item.name}" (+${count}) إلى قائمة الطباعة`);
  };

  // Add Item matching current stock
  const handleAddMatchingStock = (item: BarcodePrintItem) => {
    const qty = Math.max(1, item.stock || 1);
    handleAddToQueue(item, qty);
  };

  // Update quantity in queue
  const handleUpdateQueueQty = (id: string, delta: number) => {
    setPrintQueue((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as BarcodePrintItem[]
    );
  };

  // Remove from queue
  const handleRemoveFromQueue = (id: string) => {
    setPrintQueue((prev) => prev.filter((item) => item.id !== id));
  };

  // Clear queue
  const handleClearQueue = async () => {
    if (printQueue.length === 0) return;
    const ok = await showConfirm('هل تريد مسح كافة الملصقات في قائمة الطباعة؟', 'مسح القائمة');
    if (ok) {
      setPrintQueue([]);
      showToast('تم مسح قائمة الملصقات.');
    }
  };

  // Add all inventory to queue
  const handleAddAllInventory = async () => {
    const count = accessories.length;
    if (count === 0) {
      showAlert('لا توجد إكسسوارات في المخزون لإضافتها.', 'تنبيه');
      return;
    }
    const ok = await showConfirm(
      `هل تريد إضافة كافة أصناف الإكسسوارات (${count} صنف) بمقدار رصيدها المتوفر في المخزن إلى قائمة الطباعة؟`,
      'طباعة باركود المخزن بالكامل'
    );
    if (!ok) return;

    const newItems: BarcodePrintItem[] = accessories
      .filter((a) => a.stockQuantity > 0)
      .map((a) => ({
        id: `acc_${a.id}`,
        name: a.name,
        barcode: a.barcode,
        price: a.sellPriceRetail,
        quantity: a.stockQuantity,
        type: 'accessory',
        category: a.category,
        stock: a.stockQuantity,
      }));

    setPrintQueue(newItems);
    showToast(`تمت إضافة ${newItems.length} صنف بإجمالي كمياتهم إلى القائمة!`);
  };

  // Generate a random 12-digit barcode for custom items
  const handleGenerateRandomBarcode = () => {
    const random = '2' + Math.floor(10000000000 + Math.random() * 90000000000).toString();
    setCustomBarcode(random);
  };

  // Add custom manual item
  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) {
      showAlert('يرجى كتابة اسم المنتج.', 'بيانات ناقصة');
      return;
    }
    if (!customBarcode.trim()) {
      showAlert('يرجى كتابة أو توليد رقم الباركود.', 'بيانات ناقصة');
      return;
    }

    const priceNum = parseFloat(customPrice) || 0;
    const newItem: BarcodePrintItem = {
      id: `custom_${Date.now()}`,
      name: customName.trim(),
      barcode: customBarcode.trim(),
      price: priceNum,
      quantity: Math.max(1, customQty),
      type: 'custom',
    };

    handleAddToQueue(newItem, newItem.quantity);
    setCustomName('');
    setCustomBarcode('');
    setCustomPrice('');
    setCustomQty(1);
    setActiveTab('queue');
  };

  // Calculate total labels in queue
  const totalLabelsInQueue = printQueue.reduce((sum, item) => sum + item.quantity, 0);

  // Flatten queue into individual label items for printing
  const flattenedLabels = React.useMemo(() => {
    const list: BarcodePrintItem[] = [];
    printQueue.forEach((item) => {
      for (let i = 0; i < item.quantity; i++) {
        list.push(item);
      }
    });
    return list;
  }, [printQueue]);

  // Primary active item for single preview
  const previewItem: BarcodePrintItem =
    printQueue[0] ||
    (filteredProducts[0] ?? {
      id: 'demo',
      name: 'شاحن سريع 20W أصلي Type-C',
      barcode: '6221234567890',
      price: 250,
      quantity: 1,
      type: 'accessory',
      origin: 'ضمان أصلي',
    });

  // Execute Print (Electron Silent or Browser Print)
  const handleExecutePrint = async (silent: boolean = true) => {
    if (flattenedLabels.length === 0) {
      showAlert('قائمة الطباعة فارغة! أضف منتجات أولاً للطباعة.', 'تنبيه');
      return;
    }

    setIsPrinting(true);
    await systemLogger.logInit(
      `بدء عملية طباعة ملصقات الباركود: ${flattenedLabels.length} ملصق، المقاس: ${currentPreset.name}`
    );

    try {
      const isDesktop = typeof window !== 'undefined' && !!(window as any).electronAPI;
      const targetPrinter = settings?.barcodePrinter || settings?.selectedPrinter;

      // Isolated iframe print method for perfect label dimensions & zero margins
      const printArea = document.getElementById('barcode-isolated-print-container');
      if (!printArea) {
        throw new Error('تعذر العثور على حاوية الطباعة.');
      }

      const htmlContent = printArea.innerHTML;
      const iframe = document.createElement('iframe');
      iframe.style.cssText =
        'position:fixed;right:0;bottom:0;width:10px;height:10px;border:none;opacity:0.01;pointer-events:none;z-index:-9999;';
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) throw new Error('تعذر إنشاء إطار الطباعة');

      const pageStyle = currentPreset.isSheet
        ? `@page { size: A4 portrait; margin: 5mm; }`
        : `@page { size: ${currentPreset.widthMm}mm ${currentPreset.heightMm}mm; margin: 0mm; }`;

      const fullHTML = `<!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>طباعة الباركود - ${customStoreName}</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          ${pageStyle}
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Cairo', system-ui, -apple-system, sans-serif;
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .sticker-page {
            page-break-after: always;
            break-after: page;
            display: flex;
            align-items: center;
            justify-content: center;
            width: ${currentPreset.widthMm}mm;
            height: ${currentPreset.heightMm}mm;
            overflow: hidden;
          }
          .sheet-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(42.5mm, 1fr));
            gap: 2mm;
            padding: 2mm;
          }
          @media print {
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>${htmlContent}</body>
      </html>`;

      doc.open();
      doc.write(fullHTML);
      doc.close();

      setTimeout(async () => {
        try {
          if (isDesktop && silent && (window as any).electronAPI?.printSilent) {
            await (window as any).electronAPI.printSilent({
              silent: true,
              deviceName: targetPrinter,
            });
            showToast(`تم إرسال ${flattenedLabels.length} ملصق إلى طابعة الباركود بنجاح! 🏷️`);
          } else {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            showToast('تم فتح نافذة الطباعة.');
          }
        } finally {
          setTimeout(() => {
            try {
              document.body.removeChild(iframe);
            } catch (_) {}
            setIsPrinting(false);
          }, 3000);
        }
      }, 500);
    } catch (err: any) {
      console.error('Print barcode error:', err);
      showAlert(`فشل في عملية الطباعة: ${err?.message || err}`, 'خطأ في الطباعة', 'error');
      setIsPrinting(false);
    }
  };

  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Download calibrated PDF via Labelary REST API
  const handleDownloadLabelaryPdf = async () => {
    if (printQueue.length === 0) {
      showAlert('قائمة الطباعة فارغة! أضف منتجات أولاً للتحميل.', 'تنبيه');
      return;
    }
    setDownloadingPdf(true);
    try {
      const blob = await BarcodePrintEngine.downloadLabelaryPdf(printQueue, {
        widthMm: currentPreset.widthMm,
        heightMm: currentPreset.heightMm,
        gapMm: 1.0,
        dpi: 203,
        showStoreName,
        storeName: customStoreName,
        showProductName,
        showPrice,
        showOrigin,
        originText,
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `barcode_labels_${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('تم إنشاء وتحميل ملف PDF للباركود بجودة 203 DPI مطابقة للمواصفات! 📄');
    } catch (err: any) {
      showAlert(`فشل تحميل الـ PDF: ${err?.message || err}`, 'تنبيه', 'error');
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Send raw TSPL directly to printer via WebUSB
  const handleWebUsbDirectPrint = async () => {
    if (printQueue.length === 0) {
      showAlert('قائمة الطباعة فارغة! أضف منتجات أولاً.', 'تنبيه');
      return;
    }
    try {
      const binary = BarcodePrintEngine.generateTSPLBinary(printQueue, {
        widthMm: currentPreset.widthMm,
        heightMm: currentPreset.heightMm,
        gapMm: 1.0,
        dpi: 203,
        showStoreName,
        storeName: customStoreName,
        showProductName,
        showPrice,
        showOrigin,
        originText,
      });

      await BarcodePrintEngine.sendToWebUSB(binary);
      showToast('تم إرسال أوامر TSPL المباشرة بنجاح عبر منفذ USB! ⚡');
    } catch (err: any) {
      showAlert(`WebUSB: ${err?.message || err}`, 'اتصال USB مباشر', 'info');
    }
  };

  return (
    <div className="space-y-6 select-none font-sans" dir="rtl">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-600/10 text-cyan-600 border border-cyan-500/20 shrink-0">
            <Barcode className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight font-display flex items-center gap-2">
              طباعة ملصقات الباركود
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200">
                203 DPI دقيق
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              توليد وطباعة استيكرات الباركود لكافة المنتجات والإكسسوارات والهواتف بدقة عالية
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleExecutePrint(true)}
            disabled={isPrinting || totalLabelsInQueue === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 active:scale-95 text-white font-bold text-xs shadow-md shadow-cyan-600/20 transition cursor-pointer disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            <span>طباعة صامتة فورية ({totalLabelsInQueue})</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadLabelaryPdf}
            disabled={downloadingPdf || totalLabelsInQueue === 0}
            title="توليد ملف PDF جاهز بمقاس الملصق بالضبط"
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer disabled:opacity-50"
          >
            <Download className={`h-4 w-4 ${downloadingPdf ? 'animate-bounce text-cyan-600' : ''}`} />
            <span>{downloadingPdf ? 'جاري التحميل...' : 'تحميل PDF'}</span>
          </button>

          <button
            type="button"
            onClick={handleWebUsbDirectPrint}
            disabled={totalLabelsInQueue === 0}
            title="إرسال باينري مباشر (TSPL) لطابعة USB"
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer disabled:opacity-50"
          >
            <Usb className="h-4 w-4 text-emerald-600" />
            <span>WebUSB</span>
          </button>

          <button
            type="button"
            onClick={() => handleExecutePrint(false)}
            disabled={isPrinting || totalLabelsInQueue === 0}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs transition cursor-pointer disabled:opacity-50"
          >
            <Layers className="h-4 w-4" />
            <span>معاينة الطباعة</span>
          </button>

          {printQueue.length > 0 && (
            <button
              type="button"
              onClick={handleClearQueue}
              title="مسح قائمة الطباعة"
              className="p-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 transition cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Left (Controls & Preview) vs Right (Products Search & Queue) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Label Configuration & Live Preview (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* 1. Live Sticker Preview Card */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs flex flex-col items-center">
            <div className="w-full flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-amber-500" />
                معاينة الملصق المباشرة (WYSIWYG)
              </span>
              <span className="text-[11px] font-bold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-lg">
                {currentPreset.widthMm} × {currentPreset.heightMm} مم
              </span>
            </div>

            {/* Sticker Preview Box */}
            <div className="p-6 bg-slate-100/80 rounded-2xl border border-slate-200/60 flex items-center justify-center w-full min-h-[160px] overflow-auto">
              <SingleBarcodeSticker
                item={previewItem}
                storeName={customStoreName}
                showStoreName={showStoreName}
                showProductName={showProductName}
                showPrice={showPrice}
                showOrigin={showOrigin}
                originText={originText}
                preset={currentPreset}
                scale={1.15}
              />
            </div>

            <p className="text-[11px] text-slate-400 mt-3 text-center leading-relaxed">
              معاينة حية مطابقة بنسبة 100% للطباعة على رول الورق الحراري.
            </p>
          </div>

          {/* 2. Customization Controls & Content Toggles */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Settings2 className="h-4 w-4 text-cyan-600" />
              <h3 className="text-xs font-black text-slate-900">محتويات وعناصر الملصق</h3>
            </div>

            {/* Dimension Preset Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                📏 مقاس ملصق الباركود (Label Dimension)
              </label>
              <select
                value={selectedPresetId}
                onChange={(e) => setSelectedPresetId(e.target.value)}
                className="w-full rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-cyan-600"
              >
                {LABEL_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Toggle Switches */}
            <div className="space-y-3 pt-2">
              {/* Barcode (Mandatory) */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-2">
                  <Barcode className="h-4 w-4 text-slate-700" />
                  <span className="text-xs font-bold text-slate-800">خطوط وأرقام الباركود (Code 128)</span>
                </div>
                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                  إجباري
                </span>
              </div>

              {/* Store Name Toggle & Input */}
              <div className="space-y-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showStoreName}
                      onChange={(e) => setShowStoreName(e.target.checked)}
                      className="h-4 w-4 rounded text-cyan-600 focus:ring-0"
                    />
                    <span>اسم المتجر (المحل)</span>
                  </label>
                </div>
                {showStoreName && (
                  <input
                    type="text"
                    value={customStoreName}
                    onChange={(e) => setCustomStoreName(e.target.value)}
                    placeholder="اسم المحل (مثل: الغندور فون)"
                    className="w-full rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-cyan-600"
                  />
                )}
              </div>

              {/* Product Name Toggle */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showProductName}
                    onChange={(e) => setShowProductName(e.target.checked)}
                    className="h-4 w-4 rounded text-cyan-600 focus:ring-0"
                  />
                  <span>اسم المنتج (الصنف)</span>
                </label>
              </div>

              {/* Selling Price Toggle */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPrice}
                    onChange={(e) => setShowPrice(e.target.checked)}
                    className="h-4 w-4 rounded text-cyan-600 focus:ring-0"
                  />
                  <span>سعر البيع (ج.م)</span>
                </label>
              </div>

              {/* Origin / Extra Note Toggle */}
              <div className="space-y-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showOrigin}
                      onChange={(e) => setShowOrigin(e.target.checked)}
                      className="h-4 w-4 rounded text-cyan-600 focus:ring-0"
                    />
                    <span>ملاحظة إضافية / المنشأ / الضمان</span>
                  </label>
                </div>
                {showOrigin && (
                  <input
                    type="text"
                    value={originText}
                    onChange={(e) => setOriginText(e.target.value)}
                    placeholder="نص إضافي (مثل: ضمان سنة، أصلي، صنع في مصر)"
                    className="w-full rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-cyan-600"
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Search, Product Selection & Print Queue (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <button
              type="button"
              onClick={() => setActiveTab('queue')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'queue'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <Layers className="h-4 w-4" />
              <span>قائمة الطباعة الحالية ({totalLabelsInQueue})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('custom')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'custom'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <Plus className="h-4 w-4" />
              <span>توليد باركود لصنف مخصص</span>
            </button>

            <button
              type="button"
              onClick={handleAddAllInventory}
              className="mr-auto flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
            >
              <Copy className="h-3.5 w-3.5" />
              <span>إضافة كل المخزون</span>
            </button>
          </div>

          {/* TAB 1: PRODUCT SEARCH & QUEUE */}
          {activeTab === 'queue' && (
            <div className="space-y-6">
              {/* Product Search Card */}
              <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Search Bar */}
                  <div className="relative flex-1">
                    <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="ابحث بالاسم، أو امسح الباركود، أو التصنيف..."
                      className="w-full rounded-xl bg-slate-50 border border-slate-200 pr-10 pl-4 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-cyan-600"
                    />
                  </div>

                  {/* Filter Dropdown */}
                  <select
                    value={selectedTypeFilter}
                    onChange={(e) => setSelectedTypeFilter(e.target.value as any)}
                    className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-cyan-600"
                  >
                    <option value="all">كل المنتجات</option>
                    <option value="accessories">إكسسوارات فقط</option>
                    <option value="phones">هواتف فقط</option>
                  </select>
                </div>

                {/* Instant Search Results List */}
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {filteredProducts.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      لا توجد منتجات مطابقة لكلمة البحث
                    </div>
                  ) : (
                    filteredProducts.slice(0, 30).map((prod) => (
                      <div
                        key={prod.id}
                        className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 hover:border-cyan-200 bg-slate-50/50 hover:bg-cyan-50/20 transition"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 shrink-0">
                            {prod.type === 'phone' ? (
                              <Smartphone className="h-4 w-4 text-indigo-600" />
                            ) : (
                              <Tag className="h-4 w-4 text-emerald-600" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-black text-slate-900">{prod.name}</h4>
                              {prod.category && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200/80 text-slate-600">
                                  {prod.category}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                              <span className="font-mono text-cyan-700 font-bold">{prod.barcode}</span>
                              <span>·</span>
                              <span className="font-bold text-slate-800">{prod.price} ج.م</span>
                              <span>·</span>
                              <span>المخزون: {prod.stock ?? 1}</span>
                            </div>
                          </div>
                        </div>

                        {/* Quick Add Buttons */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleAddToQueue(prod, 1)}
                            className="px-2.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs cursor-pointer active:scale-95"
                          >
                            +1
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddToQueue(prod, 5)}
                            className="px-2 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs cursor-pointer active:scale-95"
                          >
                            +5
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddMatchingStock(prod)}
                            title="إضافة بمقدار رصيد المخزن الحالي"
                            className="px-2 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs cursor-pointer active:scale-95"
                          >
                            المخزن ({prod.stock ?? 1})
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Current Print Queue Table */}
              <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-xs font-black text-slate-900 flex items-center gap-2">
                    <Layers className="h-4 w-4 text-cyan-600" />
                    الملصقات المجهزة للطباعة ({printQueue.length} صنف · {totalLabelsInQueue} استيكر)
                  </h3>

                  {printQueue.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearQueue}
                      className="text-xs text-rose-600 hover:text-rose-700 font-bold cursor-pointer"
                    >
                      إفراغ القائمة
                    </button>
                  )}
                </div>

                {printQueue.length === 0 ? (
                  <div className="text-center py-10 text-slate-400">
                    <Barcode className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                    <p className="text-xs font-bold">لم تتم إضافة أي ملصقات إلى القائمة بعد</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      اختر الأصناف من قائمة البحث بالأعلى للبدء في تجهيز ملصقات الباركود.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                    {printQueue.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-white shadow-2xs"
                      >
                        <div>
                          <h4 className="text-xs font-black text-slate-900">{item.name}</h4>
                          <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                            <span className="font-mono text-cyan-700 font-bold">{item.barcode}</span>
                            <span>·</span>
                            <span className="font-bold text-slate-800">{item.price} ج.م</span>
                          </div>
                        </div>

                        {/* Quantity Counter & Delete */}
                        <div className="flex items-center gap-2">
                          <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                            <button
                              type="button"
                              onClick={() => handleUpdateQueueQty(item.id, -1)}
                              className="p-1.5 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="px-3 text-xs font-black text-slate-900 min-w-[28px] text-center">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateQueueQty(item.id, 1)}
                              className="p-1.5 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveFromQueue(item.id)}
                            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: CUSTOM ITEM BARCODE FORM */}
          {activeTab === 'custom' && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
              <form onSubmit={handleAddCustomItem} className="space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                  <Sparkles className="h-4 w-4 text-cyan-600" />
                  <h3 className="text-xs font-black text-slate-900">إنشاء باركود لمنتج أو خدمة جديدة</h3>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">اسم الصنف أو المنتج</label>
                  <input
                    type="text"
                    required
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="مثال: جراب سيليكون شفاف آيفون 13"
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs font-bold text-slate-800 focus:outline-none focus:border-cyan-600"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700">رقم الباركود (Barcode)</label>
                    <button
                      type="button"
                      onClick={handleGenerateRandomBarcode}
                      className="text-[11px] text-cyan-600 hover:text-cyan-700 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>توليد كود تلقائي عشوائي</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={customBarcode}
                    onChange={(e) => setCustomBarcode(e.target.value)}
                    placeholder="امسح الباركود أو اضغط توليد تلقائي..."
                    className="w-full rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-cyan-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">سعر البيع (ج.م)</label>
                    <input
                      type="number"
                      step="any"
                      value={customPrice}
                      onChange={(e) => setCustomPrice(e.target.value)}
                      placeholder="0"
                      className="w-full rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs font-bold text-slate-800 focus:outline-none focus:border-cyan-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">عدد الملصقات المطلوبة</label>
                    <input
                      type="number"
                      min={1}
                      value={customQty}
                      onChange={(e) => setCustomQty(parseInt(e.target.value) || 1)}
                      className="w-full rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs font-bold text-slate-800 focus:outline-none focus:border-cyan-600"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    className="px-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 active:scale-95 text-white font-bold text-xs shadow-md shadow-cyan-600/20 transition cursor-pointer flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span>إضافة إلى قائمة الطباعة</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Hidden Isolated Print Container for Iframe / Silent Printing */}
      <div id="barcode-isolated-print-container" className="hidden">
        {currentPreset.isSheet ? (
          <div className="sheet-grid">
            {flattenedLabels.map((item, idx) => (
              <SingleBarcodeSticker
                key={`print_sheet_${item.id}_${idx}`}
                item={item}
                storeName={customStoreName}
                showStoreName={showStoreName}
                showProductName={showProductName}
                showPrice={showPrice}
                showOrigin={showOrigin}
                originText={originText}
                preset={currentPreset}
              />
            ))}
          </div>
        ) : (
          <div>
            {flattenedLabels.map((item, idx) => (
              <div key={`print_roll_${item.id}_${idx}`} className="sticker-page">
                <SingleBarcodeSticker
                  item={item}
                  storeName={customStoreName}
                  showStoreName={showStoreName}
                  showProductName={showProductName}
                  showPrice={showPrice}
                  showOrigin={showOrigin}
                  originText={originText}
                  preset={currentPreset}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
