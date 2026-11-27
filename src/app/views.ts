export type View = 'dashboard' | 'wallets' | 'budget' | 'utang' | 'rencana' | 'analisa' | 'transactions' | 'ai' | 'scanner' | 'settings' | 'admin';

export type TransactionSection = 'all' | 'income' | 'expense' | 'transfer';

/** Sub-halaman di dalam AI Center. 'scanner' tidak ada di sini karena punya view sendiri. */
export type AiSection = 'hub' | 'asisten' | 'kategorisasi' | 'riwayat' | 'prediksi';
