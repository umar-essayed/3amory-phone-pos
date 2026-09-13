import type { SaleInvoice, StoreSettings, WalletTransaction, RepairTicket, Phone, Shift, Accessory } from '../types';

export type PrintDocumentType =
  | 'sale_receipt'
  | 'wallet_receipt'
  | 'repair_ticket'
  | 'used_phone_contract'
  | 'barcode_label'
  | 'shift_report';

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

// Global print trigger event
export function triggerPrint(printData: PrintData) {
  const event = new CustomEvent('mobile-pos-print', { detail: printData });
  window.dispatchEvent(event);
}
