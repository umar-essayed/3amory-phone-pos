import 'fake-indexeddb/auto';
import { db } from '../src/db';

async function run() {
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('🧹 بدء مسح وتنظيف البيانات التجريبية (Demo Data Cleaner)');
  console.log('═════════════════════════════════════════════════════════════════');

  await db.open();

  // Delete all items starting with demo_
  const allPhones = await db.phones.toArray();
  const demoPhones = allPhones.filter((p) => p.id.startsWith('demo_'));
  if (demoPhones.length > 0) {
    await db.phones.bulkDelete(demoPhones.map((p) => p.id));
    console.log(`🗑️ تم مسح ${demoPhones.length} هواتف تجريبية`);
  }

  const allAccs = await db.accessories.toArray();
  const demoAccs = allAccs.filter((a) => a.id.startsWith('demo_'));
  if (demoAccs.length > 0) {
    await db.accessories.bulkDelete(demoAccs.map((a) => a.id));
    console.log(`🗑️ تم مسح ${demoAccs.length} إكسسوارات تجريبية`);
  }

  const allWallets = await db.wallets.toArray();
  const demoWallets = allWallets.filter((w) => w.id.startsWith('demo_'));
  if (demoWallets.length > 0) {
    await db.wallets.bulkDelete(demoWallets.map((w) => w.id));
    console.log(`🗑️ تم مسح ${demoWallets.length} محافظ تجريبية`);
  }

  console.log('═════════════════════════════════════════════════════════════════');
  console.log('✅ تم تنظيف ومسح كافة البيانات التجريبية وعادت قاعدة البيانات نظيفة.');
  console.log('═════════════════════════════════════════════════════════════════');
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ خطأ أثناء مسح البيانات:', err);
  process.exit(1);
});
