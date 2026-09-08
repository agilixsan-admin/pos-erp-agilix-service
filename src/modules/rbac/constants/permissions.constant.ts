export interface PermissionItem {
  code: string;
  name: string;
  description: string;
  action:
    | 'read'
    | 'create'
    | 'update'
    | 'delete'
    | 'adjust'
    | 'void'
    | 'receive'
    | 'finalize'
    | 'cancel'
    | 'manage';
}

export interface PermissionSubGroup {
  key: string;
  title: string;
  permissions: PermissionItem[];
}

export interface PermissionGroup {
  groupKey: string;
  groupTitle: string;
  description: string;
  subGroups: PermissionSubGroup[];
}

export const SYSTEM_PERMISSIONS_GROUPS: PermissionGroup[] = [
  {
    groupKey: 'transaksi',
    groupTitle: 'Modul Transaksi',
    description:
      'Akses operasional kasir POS, pesanan, pembayaran, dan riwayat transaksi',
    subGroups: [
      {
        key: 'pos_order',
        title: 'POS & Pesanan',
        permissions: [
          {
            code: 'order.read',
            name: 'Lihat Pesanan & Menu POS',
            description: 'Melihat antrean pesanan dan menu operasional POS',
            action: 'read',
          },
          {
            code: 'order.create',
            name: 'Buat Pesanan Baru',
            description: 'Membuat pesanan baru di kasir POS',
            action: 'create',
          },
          {
            code: 'order.update',
            name: 'Ubah / Update Pesanan',
            description: 'Mengubah item atau status pesanan sebelum final',
            action: 'update',
          },
          {
            code: 'order.void',
            name: 'Void / Batalkan Pesanan',
            description:
              'Membatalkan item atau transaksi pesanan (memerlukan hak akses khusus)',
            action: 'void',
          },
        ],
      },
      {
        key: 'payment',
        title: 'Pembayaran',
        permissions: [
          {
            code: 'payment.read',
            name: 'Lihat Status Pembayaran',
            description: 'Melihat status tagihan dan pembayaran kasir',
            action: 'read',
          },
          {
            code: 'payment.create',
            name: 'Proses Pembayaran (Cash / QRIS)',
            description: 'Menerima pembayaran cash atau generate dynamic QRIS',
            action: 'create',
          },
        ],
      },
      {
        key: 'transaction',
        title: 'Riwayat Transaksi',
        permissions: [
          {
            code: 'transaction.read',
            name: 'Lihat Riwayat Transaksi',
            description: 'Melihat rekap riwayat transaksi yang sudah selesai',
            action: 'read',
          },
        ],
      },
    ],
  },
  {
    groupKey: 'produk',
    groupTitle: 'Modul Produk & Menu',
    description:
      'Pengelolaan katalog menu, varian harga, resep bahan baku, dan kategori',
    subGroups: [
      {
        key: 'product_catalog',
        title: 'Katalog Produk & Resep',
        permissions: [
          {
            code: 'product.read',
            name: 'Lihat Produk & Kategori',
            description: 'Melihat daftar produk, varian, resep, dan kategori',
            action: 'read',
          },
          {
            code: 'product.create',
            name: 'Tambah Produk & Resep',
            description: 'Menambah menu baru, varian, HPP, resep, dan kategori',
            action: 'create',
          },
          {
            code: 'product.update',
            name: 'Ubah Produk & Resep',
            description:
              'Mengubah harga, foto, varian, resep bahan, dan kategori',
            action: 'update',
          },
          {
            code: 'product.delete',
            name: 'Hapus Produk & Kategori',
            description: 'Menghapus produk, varian, atau kategori menu',
            action: 'delete',
          },
        ],
      },
    ],
  },
  {
    groupKey: 'inventori',
    groupTitle: 'Modul Inventori & Stok',
    description:
      'Pengelolaan stok bahan baku, kemasan, supplier, pembelian, opname, dan adjustment',
    subGroups: [
      {
        key: 'inventory_stock',
        title: 'Stok & Bahan Baku',
        permissions: [
          {
            code: 'inventory.read',
            name: 'Lihat Stok & Bahan Baku',
            description:
              'Melihat ringkasan stok, nilai aset, dan daftar bahan baku',
            action: 'read',
          },
          {
            code: 'inventory.create',
            name: 'Tambah Bahan Baku',
            description: 'Menambahkan data master bahan baku baru',
            action: 'create',
          },
          {
            code: 'inventory.update',
            name: 'Ubah Bahan Baku',
            description: 'Mengubah info, satuan, minimum alert bahan baku',
            action: 'update',
          },
          {
            code: 'inventory.delete',
            name: 'Hapus Bahan Baku',
            description: 'Menghapus data bahan baku',
            action: 'delete',
          },
          {
            code: 'inventory.adjust',
            name: 'Penyesuaian Stok (Adjustment)',
            description:
              'Melakukan penyesuaian stok manual (in/out, rusak, hilang, dll)',
            action: 'adjust',
          },
        ],
      },
      {
        key: 'packaging',
        title: 'Packaging / Kemasan',
        permissions: [
          {
            code: 'packaging.read',
            name: 'Lihat Kemasan',
            description: 'Melihat daftar stok kemasan / packaging',
            action: 'read',
          },
          {
            code: 'packaging.create',
            name: 'Tambah Kemasan',
            description: 'Menambahkan data master kemasan baru',
            action: 'create',
          },
          {
            code: 'packaging.update',
            name: 'Ubah Kemasan',
            description: 'Mengubah data kemasan',
            action: 'update',
          },
          {
            code: 'packaging.delete',
            name: 'Hapus Kemasan',
            description: 'Menghapus data kemasan',
            action: 'delete',
          },
        ],
      },
      {
        key: 'supplier',
        title: 'Supplier (Pemasok)',
        permissions: [
          {
            code: 'supplier.read',
            name: 'Lihat Supplier',
            description: 'Melihat daftar pemasok / supplier',
            action: 'read',
          },
          {
            code: 'supplier.create',
            name: 'Tambah Supplier',
            description: 'Menambahkan data supplier baru',
            action: 'create',
          },
          {
            code: 'supplier.update',
            name: 'Ubah Supplier',
            description: 'Mengubah kontak dan data supplier',
            action: 'update',
          },
          {
            code: 'supplier.delete',
            name: 'Hapus Supplier',
            description: 'Menghapus data supplier',
            action: 'delete',
          },
        ],
      },
      {
        key: 'purchase',
        title: 'Pembelian (Purchase)',
        permissions: [
          {
            code: 'purchase.read',
            name: 'Lihat Pembelian',
            description: 'Melihat daftar faktur dan riwayat pembelian stok',
            action: 'read',
          },
          {
            code: 'purchase.create',
            name: 'Buat Pembelian Baru',
            description: 'Membuat purchase order / faktur pembelian bahan',
            action: 'create',
          },
          {
            code: 'purchase.update',
            name: 'Ubah Pembelian',
            description: 'Mengubah data faktur pembelian yang belum selesai',
            action: 'update',
          },
          {
            code: 'purchase.delete',
            name: 'Hapus Pembelian',
            description: 'Membatalkan/menghapus faktur pembelian',
            action: 'delete',
          },
          {
            code: 'purchase.receive',
            name: 'Terima Barang Pembelian',
            description:
              'Konfirmasi penerimaan barang dan menambah stok otomatis',
            action: 'receive',
          },
        ],
      },
      {
        key: 'stock_opname',
        title: 'Stock Opname',
        permissions: [
          {
            code: 'stock_opname.read',
            name: 'Lihat Stock Opname',
            description: 'Melihat riwayat dan sesi stock opname',
            action: 'read',
          },
          {
            code: 'stock_opname.create',
            name: 'Buat Sesi Stock Opname',
            description: 'Memulai sesi audit fisik stok baru',
            action: 'create',
          },
          {
            code: 'stock_opname.update',
            name: 'Input Hitung Fisik',
            description: 'Memasukkan jumlah hasil perhitungan fisik stok',
            action: 'update',
          },
          {
            code: 'stock_opname.finalize',
            name: 'Finalisasi Stock Opname',
            description:
              'Menyetujui selisih dan memperbarui stok sistem secara otomatis',
            action: 'finalize',
          },
          {
            code: 'stock_opname.cancel',
            name: 'Batalkan Stock Opname',
            description: 'Membatalkan sesi audit fisik yang sedang berjalan',
            action: 'cancel',
          },
        ],
      },
    ],
  },
  {
    groupKey: 'laporan',
    groupTitle: 'Modul Laporan',
    description:
      'Analisis omzet penjualan, laba rugi, HPP/margin, dan kartu mutasi stok',
    subGroups: [
      {
        key: 'reporting',
        title: 'Laporan & Analisis',
        permissions: [
          {
            code: 'report.read',
            name: 'Lihat Seluruh Laporan',
            description:
              'Mengakses laporan penjualan, profit/laba rugi, COGS, dan mutasi inventori',
            action: 'read',
          },
        ],
      },
    ],
  },
  {
    groupKey: 'pengaturan',
    groupTitle: 'Modul Pengaturan & Konfigurasi',
    description:
      'Konfigurasi outlet cabang, denah meja, manajemen karyawan, role, printer, dan sistem',
    subGroups: [
      {
        key: 'outlet',
        title: 'Outlet / Cabang',
        permissions: [
          {
            code: 'outlet.read',
            name: 'Lihat Outlet',
            description: 'Melihat data profil outlet cabang',
            action: 'read',
          },
          {
            code: 'outlet.create',
            name: 'Tambah Outlet',
            description: 'Menambahkan cabang baru (jika lisensi mendukung)',
            action: 'create',
          },
          {
            code: 'outlet.update',
            name: 'Ubah Data Outlet',
            description: 'Mengubah alamat, telepon, dan profil outlet',
            action: 'update',
          },
        ],
      },
      {
        key: 'table',
        title: 'Denah Meja (Table)',
        permissions: [
          {
            code: 'table.read',
            name: 'Lihat Meja',
            description: 'Melihat daftar dan status meja dine-in',
            action: 'read',
          },
          {
            code: 'table.create',
            name: 'Tambah Meja',
            description: 'Menambahkan meja baru di outlet',
            action: 'create',
          },
          {
            code: 'table.update',
            name: 'Ubah Meja',
            description: 'Mengubah nama meja, kapasitas, dan posisi',
            action: 'update',
          },
          {
            code: 'table.delete',
            name: 'Hapus Meja',
            description: 'Menghapus meja dari sistem',
            action: 'delete',
          },
        ],
      },
      {
        key: 'user',
        title: 'Pengguna / Karyawan',
        permissions: [
          {
            code: 'user.read',
            name: 'Lihat Karyawan',
            description: 'Melihat daftar staf dan karyawan',
            action: 'read',
          },
          {
            code: 'user.create',
            name: 'Tambah Karyawan',
            description: 'Menambahkan akun staf baru dan menetapkan role',
            action: 'create',
          },
          {
            code: 'user.update',
            name: 'Ubah Karyawan',
            description: 'Mengubah profil, role, PIN, atau password staf',
            action: 'update',
          },
          {
            code: 'user.delete',
            name: 'Nonaktifkan Karyawan',
            description: 'Menonaktifkan akun staf',
            action: 'delete',
          },
        ],
      },
      {
        key: 'role',
        title: 'Role & Hak Akses',
        permissions: [
          {
            code: 'role.read',
            name: 'Lihat Role & Peran',
            description: 'Melihat daftar role dan matriks hak akses',
            action: 'read',
          },
          {
            code: 'role.create',
            name: 'Tambah Role Baru',
            description: 'Membuat role kustom baru dan memilih hak akses',
            action: 'create',
          },
          {
            code: 'role.update',
            name: 'Ubah Hak Akses Role',
            description: 'Mengubah nama role dan centang hak aksesnya',
            action: 'update',
          },
          {
            code: 'role.delete',
            name: 'Hapus Role',
            description: 'Menghapus role kustom yang tidak digunakan',
            action: 'delete',
          },
        ],
      },
      {
        key: 'printer',
        title: 'Printer Thermal',
        permissions: [
          {
            code: 'printer.read',
            name: 'Lihat Printer',
            description: 'Melihat daftar printer struk/dapur',
            action: 'read',
          },
          {
            code: 'printer.create',
            name: 'Tambah Printer',
            description: 'Menghubungkan printer baru (USB/LAN/Bluetooth)',
            action: 'create',
          },
          {
            code: 'printer.update',
            name: 'Ubah Printer',
            description: 'Mengubah konfigurasi printer dan ukuran kertas',
            action: 'update',
          },
          {
            code: 'printer.delete',
            name: 'Hapus Printer',
            description: 'Menghapus printer dari sistem',
            action: 'delete',
          },
        ],
      },
      {
        key: 'discount',
        title: 'Diskon & Promo',
        permissions: [
          {
            code: 'discount.read',
            name: 'Lihat Diskon & Promo',
            description: 'Melihat daftar master data diskon dan promosi',
            action: 'read',
          },
          {
            code: 'discount.create',
            name: 'Tambah Diskon & Promo',
            description: 'Menambahkan promo baru (persentase / nominal tetap)',
            action: 'create',
          },
          {
            code: 'discount.update',
            name: 'Ubah Diskon & Promo',
            description:
              'Mengubah nominal, jadwal hari, tanggal, atau menu promo',
            action: 'update',
          },
          {
            code: 'discount.delete',
            name: 'Hapus Diskon & Promo',
            description: 'Menghapus data diskon dan promosi',
            action: 'delete',
          },
        ],
      },
      {
        key: 'settings',
        title: 'Pengaturan Sistem',
        permissions: [
          {
            code: 'settings.read',
            name: 'Lihat Pengaturan',
            description: 'Melihat pengaturan pajak, service charge, dan struk',
            action: 'read',
          },
          {
            code: 'settings.manage',
            name: 'Ubah Pengaturan',
            description:
              'Mengubah tarif pajak, service charge, dan footer struk',
            action: 'manage',
          },
        ],
      },
      {
        key: 'audit_log',
        title: 'Audit Log',
        permissions: [
          {
            code: 'audit_log.read',
            name: 'Lihat Audit Log',
            description: 'Melihat riwayat aktivitas operasional penting',
            action: 'read',
          },
        ],
      },
    ],
  },
];
