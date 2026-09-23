export interface DefaultAccountTemplate {
  accountCode: string;
  name: string;
  category: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  normalBalance: 'DEBIT' | 'CREDIT';
  isSystem: boolean;
}

export const DEFAULT_CHART_OF_ACCOUNTS: DefaultAccountTemplate[] = [
  // 1-xxxx ASET (HARTA)
  {
    accountCode: '1-1100',
    name: 'Kas Laci Kasir (Cash Drawer)',
    category: 'ASSET',
    normalBalance: 'DEBIT',
    isSystem: true,
  },
  {
    accountCode: '1-1200',
    name: 'Rekening Bank Operasional',
    category: 'ASSET',
    normalBalance: 'DEBIT',
    isSystem: true,
  },
  {
    accountCode: '1-1250',
    name: 'Saldo QRIS & Payment Gateway',
    category: 'ASSET',
    normalBalance: 'DEBIT',
    isSystem: true,
  },
  {
    accountCode: '1-1300',
    name: 'Persediaan Bahan Baku (Inventory)',
    category: 'ASSET',
    normalBalance: 'DEBIT',
    isSystem: true,
  },
  {
    accountCode: '1-1400',
    name: 'Persediaan Kemasan & Packaging',
    category: 'ASSET',
    normalBalance: 'DEBIT',
    isSystem: true,
  },
  {
    accountCode: '1-1500',
    name: 'Aset Tetap - Peralatan & Mesin',
    category: 'ASSET',
    normalBalance: 'DEBIT',
    isSystem: true,
  },
  {
    accountCode: '1-1590',
    name: 'Akumulasi Penyusutan Aset Tetap',
    category: 'ASSET',
    normalBalance: 'CREDIT',
    isSystem: true,
  },

  // 2-xxxx KEWAJIBAN (HUTANG)
  {
    accountCode: '2-1100',
    name: 'Hutang Usaha / Supplier',
    category: 'LIABILITY',
    normalBalance: 'CREDIT',
    isSystem: true,
  },
  {
    accountCode: '2-1200',
    name: 'Hutang Pajak PB1 & PPN',
    category: 'LIABILITY',
    normalBalance: 'CREDIT',
    isSystem: true,
  },
  {
    accountCode: '2-1300',
    name: 'Hutang Service Charge Karyawan',
    category: 'LIABILITY',
    normalBalance: 'CREDIT',
    isSystem: true,
  },

  // 3-xxxx MODAL (EKUITAS)
  {
    accountCode: '3-1000',
    name: 'Modal Disetor Pemilik',
    category: 'EQUITY',
    normalBalance: 'CREDIT',
    isSystem: true,
  },
  {
    accountCode: '3-2000',
    name: 'Laba Ditahan / Berjalan',
    category: 'EQUITY',
    normalBalance: 'CREDIT',
    isSystem: true,
  },
  {
    accountCode: '3-3000',
    name: 'Prive / Penarikan Modal Pemilik',
    category: 'EQUITY',
    normalBalance: 'DEBIT',
    isSystem: true,
  },

  // 4-xxxx PENDAPATAN (REVENUE)
  {
    accountCode: '4-1000',
    name: 'Pendapatan Penjualan Produk',
    category: 'REVENUE',
    normalBalance: 'CREDIT',
    isSystem: true,
  },
  {
    accountCode: '4-2000',
    name: 'Diskon & Promosi Penjualan',
    category: 'REVENUE',
    normalBalance: 'DEBIT',
    isSystem: true,
  },
  {
    accountCode: '4-3000',
    name: 'Pendapatan Lain-lain',
    category: 'REVENUE',
    normalBalance: 'CREDIT',
    isSystem: false,
  },

  // 5-xxxx HPP / COGS
  {
    accountCode: '5-1000',
    name: 'Beban Pokok Penjualan (HPP Bahan Baku)',
    category: 'EXPENSE',
    normalBalance: 'DEBIT',
    isSystem: true,
  },
  {
    accountCode: '5-1100',
    name: 'Beban Pokok Kemasan / Packaging',
    category: 'EXPENSE',
    normalBalance: 'DEBIT',
    isSystem: true,
  },

  // 6-xxxx BIAYA OPERASIONAL (OPEX)
  {
    accountCode: '6-1000',
    name: 'Beban Gaji & Upah Karyawan',
    category: 'EXPENSE',
    normalBalance: 'DEBIT',
    isSystem: false,
  },
  {
    accountCode: '6-2000',
    name: 'Beban Listrik, Air & Internet',
    category: 'EXPENSE',
    normalBalance: 'DEBIT',
    isSystem: false,
  },
  {
    accountCode: '6-3000',
    name: 'Beban Sewa Tempat Usaha',
    category: 'EXPENSE',
    normalBalance: 'DEBIT',
    isSystem: false,
  },
  {
    accountCode: '6-4000',
    name: 'Beban Kebersihan, Keamanan & Parkir',
    category: 'EXPENSE',
    normalBalance: 'DEBIT',
    isSystem: false,
  },
  {
    accountCode: '6-5000',
    name: 'Beban Perlengkapan & Kas Kecil Kasir',
    category: 'EXPENSE',
    normalBalance: 'DEBIT',
    isSystem: false,
  },
  {
    accountCode: '6-6000',
    name: 'Beban Perbaikan & Pemeliharaan',
    category: 'EXPENSE',
    normalBalance: 'DEBIT',
    isSystem: false,
  },
  {
    accountCode: '6-7000',
    name: 'Beban Iklan & Promosi Usaha',
    category: 'EXPENSE',
    normalBalance: 'DEBIT',
    isSystem: false,
  },
  {
    accountCode: '6-8000',
    name: 'Beban Penyusutan Aset Tetap',
    category: 'EXPENSE',
    normalBalance: 'DEBIT',
    isSystem: true,
  },
  {
    accountCode: '6-9000',
    name: 'Beban Selisih Kas Laci (Shortage)',
    category: 'EXPENSE',
    normalBalance: 'DEBIT',
    isSystem: true,
  },
  {
    accountCode: '6-9900',
    name: 'Beban Operasional Lain-lain',
    category: 'EXPENSE',
    normalBalance: 'DEBIT',
    isSystem: false,
  },
];
