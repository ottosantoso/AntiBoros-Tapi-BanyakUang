/**
 * Pintu masuk akses data. Semua komponen tetap mengimpor dari '@/lib/data'.
 * Isinya dipecah per fitur di folder src/lib/data/. Tambahkan modul baru di sana,
 * lalu satu baris `export *` di bawah. Jangan menulis query Supabase langsung di sini.
 */
export * from './data/shared';
export * from './data/wallets';
export * from './data/transactions';
export * from './data/transfers';
export * from './data/dashboard';
export * from './data/wallet-insights';
export * from './data/budget';
export * from './data/master';
export * from './data/berulang';
export * from './data/analisa';
export * from './data/ai-reports';
export * from './data/ai-chat';
