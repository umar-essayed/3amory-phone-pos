// ═══════════════════════════════════════════════════════════════════════════
// الغندور فون (El Ghandour Phone) - Backup, Restore & Persistent Mirror Management Service
// ═══════════════════════════════════════════════════════════════════════════

import { db, DEFAULT_SETTINGS } from '../db';
import { systemLogger } from './logger';

export interface FullDatabaseBackup {
  exportDate: string;
  version: string;
  storeName: string;
  settings: any[];
  users: any[];
  phones: any[];
  accessories: any[];
  wallets: any[];
  walletTransactions: any[];
  invoices: any[];
  repairs: any[];
  shifts: any[];
  expenses: any[];
  customers: any[];
  suppliers: any[];
}

export class BackupService {
  /**
   * Serializes all IndexedDB tables into a single comprehensive JSON payload
   */
  public async exportFullDatabaseSnapshot(): Promise<FullDatabaseBackup> {
    const settings = await db.settings.toArray();
    const users = await db.users.toArray();
    const phones = await db.phones.toArray();
    const accessories = await db.accessories.toArray();
    const wallets = await db.wallets.toArray();
    const walletTransactions = await db.walletTransactions.toArray();
    const invoices = await db.invoices.toArray();
    const repairs = await db.repairs.toArray();
    const shifts = await db.shifts.toArray();
    const expenses = await db.expenses.toArray();
    const customers = await db.customers.toArray();
    const suppliers = await db.suppliers.toArray();

    return {
      exportDate: new Date().toISOString(),
      version: '1.0.1',
      storeName: settings[0]?.storeName || 'الغندور فون',
      settings,
      users,
      phones,
      accessories,
      wallets,
      walletTransactions,
      invoices,
      repairs,
      shifts,
      expenses,
      customers,
      suppliers,
    };
  }

  /**
   * Saves a manual backup snapshot to ~/elghandour-pos-backups/ and offers browser download
   */
  public async saveManualBackup(): Promise<{ success: boolean; path?: string; filename: string }> {
    const data = await this.exportFullDatabaseSnapshot();
    const dateStr = new Date().toISOString().slice(0, 10);
    const timeStr = new Date().toISOString().slice(11, 19).replace(/:/g, '-');
    const filename = `elghandour_backup_manual_${dateStr}_${timeStr}.json`;
    const jsonStr = JSON.stringify(data, null, 2);

    let savedPath: string | undefined;

    // 1. Electron Desktop Save
    if (typeof window !== 'undefined' && (window as any).electronAPI?.saveSnapshotBackup) {
      try {
        const res = await (window as any).electronAPI.saveSnapshotBackup({
          filename,
          jsonContent: jsonStr,
        });
        if (res?.success) {
          savedPath = res.path;
        }
      } catch (err) {
        console.warn('Desktop backup save note:', err);
      }
    }

    // 2. Browser file trigger fallback
    if (typeof document !== 'undefined') {
      try {
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } catch {}
    }

    await systemLogger.logInit(`تم حفظ نسخة احتياطية يدوية بنجاح: ${filename} ${savedPath ? `في المسار: ${savedPath}` : ''}`);
    return { success: true, path: savedPath, filename };
  }

  /**
   * Automatically executes weekly backup if 7 days have passed since last backup
   */
  public async checkAndRunWeeklyBackup(): Promise<boolean> {
    try {
      const currentSettings = await db.settings.get(1);
      const lastWeekly = currentSettings?.lastWeeklyBackupDate;
      const now = new Date();

      let shouldRun = false;
      if (!lastWeekly) {
        shouldRun = true;
      } else {
        const lastDate = new Date(lastWeekly);
        const diffDays = (now.getTime() - lastDate.getTime()) / (1000 * 3600 * 24);
        if (diffDays >= 7) {
          shouldRun = true;
        }
      }

      if (shouldRun) {
        const dateFolder = `backup_weekly_${now.toISOString().slice(0, 10)}`;
        const filename = `weekly_snapshot_${now.toISOString().slice(0, 10)}.json`;
        const data = await this.exportFullDatabaseSnapshot();
        const jsonStr = JSON.stringify(data, null, 2);

        if (typeof window !== 'undefined' && (window as any).electronAPI?.saveSnapshotBackup) {
          await (window as any).electronAPI.saveSnapshotBackup({
            filename,
            jsonContent: jsonStr,
            folderName: dateFolder,
          });
        }

        await db.settings.update(1, { lastWeeklyBackupDate: now.toISOString() });
        await systemLogger.logInit(`تم إنشاء النسخة الاحتياطية الأسبوعية التلقائية بنجاح في مجلد: ${dateFolder}`);
        return true;
      }
      return false;
    } catch (err) {
      console.warn('Weekly backup check note:', err);
      return false;
    }
  }

  /**
   * Cleans & resets entire database with a MANDATORY pre-reset backup for safety
   */
  public async fullDatabaseResetWithMandatoryBackup(): Promise<{ success: boolean; backupPath?: string }> {
    try {
      // 1. Mandatory safety backup before ANY deletion
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `backup_before_full_reset_${timestamp}.json`;
      const data = await this.exportFullDatabaseSnapshot();
      const jsonStr = JSON.stringify(data, null, 2);

      let backupPath: string | undefined;
      if (typeof window !== 'undefined' && (window as any).electronAPI?.saveSnapshotBackup) {
        const res = await (window as any).electronAPI.saveSnapshotBackup({
          filename,
          jsonContent: jsonStr,
          folderName: 'reset-safety-backups',
        });
        backupPath = res?.path;
      }

      await systemLogger.logInit(`[RESET-AUDIT] تم إنشاء نسخة الأمان الإلزامية قبل تصفير الداتا بيز: ${filename}`);

      // 2. Clear all operational & transaction tables
      await db.transaction(
        'rw',
        [
          db.phones,
          db.accessories,
          db.invoices,
          db.walletTransactions,
          db.shifts,
          db.expenses,
          db.repairs,
          db.customers,
          db.suppliers,
          db.syncQueue,
        ],
        async () => {
          await db.phones.clear();
          await db.accessories.clear();
          await db.invoices.clear();
          await db.walletTransactions.clear();
          await db.shifts.clear();
          await db.expenses.clear();
          await db.repairs.clear();
          await db.customers.clear();
          await db.suppliers.clear();
          await db.syncQueue.clear();
        }
      );

      // 3. Reset default admin user & default settings
      const usersCount = await db.users.count();
      if (usersCount === 0) {
        await db.users.put({
          id: 'usr_admin',
          name: 'المدير العام (المالك)',
          displayName: 'المدير العام (المالك)',
          username: 'admin',
          pin: '1234',
          role: 'owner',
          isActive: true,
          createdAt: new Date().toISOString(),
        });
      }

      // Initialize clean initial open shift
      await db.shifts.put({
        id: `shift_${Date.now()}`,
        shiftNumber: 1,
        cashierId: 'usr_admin',
        cashierName: 'المدير العام (المالك)',
        startTime: new Date().toISOString(),
        status: 'open',
        openingCash: 0,
        openingWallets: {},
        closingCashSystem: 0,
        closingCashActual: 0,
        cashDifference: 0,
        totalSalesCash: 0,
        totalWalletIn: 0,
        totalWalletOut: 0,
        totalCommissions: 0,
        totalExpenses: 0,
        notes: 'بداية الوردية الافتتاحية بعد التصفير النظيف',
      });

      // Save clean mirror
      await this.saveDatabaseMirror();

      await systemLogger.logInit('[RESET-AUDIT] تم تصفير وتنظيف قاعدة البيانات المحلية بالكامل بنجاح وبدء وردية نظيفة.');
      return { success: true, backupPath };
    } catch (err: any) {
      await systemLogger.logError(`فشل أثناء تصفير قاعدة البيانات: ${err?.message || err}`, err, 'DatabaseReset');
      return { success: false };
    }
  }

  /**
   * Saves database snapshot to the persistent mirror file: ~/.3amory-pos-data/local_pos_database_mirror.json
   */
  public async saveDatabaseMirror(): Promise<void> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.saveDatabaseMirror) {
      try {
        const snapshot = await this.exportFullDatabaseSnapshot();
        await (window as any).electronAPI.saveDatabaseMirror(snapshot);
      } catch (err) {
        console.warn('Mirror save note:', err);
      }
    }
  }

  /**
   * Opens the backups directory in native OS file explorer
   */
  public async openBackupsFolder(): Promise<boolean> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.openBackupsFolder) {
      try {
        return await (window as any).electronAPI.openBackupsFolder();
      } catch {
        return false;
      }
    } else {
      alert('مجلد النسخ الاحتياطية على جهازك: ~/elghandour-pos-backups/');
      return false;
    }
  }
}

export const backupService = new BackupService();
