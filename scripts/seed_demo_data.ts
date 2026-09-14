import 'fake-indexeddb/auto';
import { db } from '../src/db';
import { SAMPLE_PHONES, SAMPLE_ACCESSORIES, SAMPLE_WALLETS } from '../src/db/sampleData';

async function run() {
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('🚀 بدء حقن المنتجات والأجهزة التجريبية مع الصور (Demo Data Seeder)');
  console.log('═════════════════════════════════════════════════════════════════');

  await db.open();

  // 1. Phones
  await db.phones.bulkPut(SAMPLE_PHONES);
  console.log(`📱 تم إضافة ${SAMPLE_PHONES.length} هواتف بنجاح (مع صور حقيقية عالية الجودة)`);

  // 2. Accessories
  await db.accessories.bulkPut(SAMPLE_ACCESSORIES);
  console.log(`🔌 تم إضافة ${SAMPLE_ACCESSORIES.length} إكسسوارات بمتغيراتها وباركوداتها وصورها`);

  // 3. Wallets
  await db.wallets.bulkPut(SAMPLE_WALLETS);
  console.log(`💳 تم إضافة ${SAMPLE_WALLETS.length} محافظ وخطوط كاش للتجربة`);

  console.log('═════════════════════════════════════════════════════════════════');
  console.log('✅ تم تجهيز البيانات بنجاح! يمكنك الآن التقاط الصور والشاشات.');
  console.log('═════════════════════════════════════════════════════════════════');
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ خطأ أثناء إضافة البيانات:', err);
  process.exit(1);
});
