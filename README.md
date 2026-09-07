# Agilix POS Service

Backend API untuk **Agilix POS** — sistem Point of Sale multi-tenant yang mendukung bisnis dengan satu atau lebih outlet. Dibangun dengan [NestJS](https://nestjs.com/) dan PostgreSQL.

Agilix POS adalah bagian dari ekosistem Agilix, yang berkomunikasi dengan **Agilix Console** (sistem manajemen subscription & tenant) melalui HTTPS/webhook.

## Fitur Utama

- Autentikasi & otorisasi berbasis JWT dengan RBAC (Role-Based Access Control)
- Manajemen multi-tenant & outlet
- Manajemen produk, varian, dan resep (recipe)
- Manajemen inventory & stock adjustment
- Order, meja (table), dan payment (termasuk QRIS)
- Integrasi penyimpanan file (S3 / MinIO)
- Integrasi printer
- Audit log & reporting
- Webhook untuk komunikasi dengan Agilix Console

## Tech Stack

- **Framework:** NestJS 11 (TypeScript)
- **Database:** PostgreSQL + TypeORM
- **Auth:** JWT (Passport), bcrypt
- **Storage:** AWS S3 / MinIO (S3-compatible)
- **Validation:** class-validator, class-transformer, Joi
- **Rate limiting:** @nestjs/throttler
- **Testing:** Jest, Supertest

## Prasyarat

- Node.js (lihat versi di `package.json`)
- PostgreSQL 16
- Docker & Docker Compose (opsional, untuk menjalankan dependency secara lokal)

## Instalasi

```bash
npm install
```

Salin `.env.example` menjadi `.env` lalu sesuaikan konfigurasinya (database, JWT secret, storage, dsb.):

```bash
cp .env.example .env
```

### Menjalankan dependency lokal (PostgreSQL & MinIO)

```bash
docker compose up -d postgres minio
```

### Migrasi database

```bash
npm run migration:run
```

### Seed data (opsional)

```bash
npm run seed
```

## Menjalankan Aplikasi

```bash
# development
npm run start

# watch mode
npm run start:dev

# debug mode
npm run start:debug

# production mode
npm run start:prod
```

Setelah berjalan, API dapat diakses di `http://localhost:<PORT>/api/v1` (default port lihat `.env`). Health check tersedia di `/health` (di luar prefix versi API). Dokumentasi Swagger aktif jika `SWAGGER=development` atau `staging` (lihat `.env.example`).

## Testing

```bash
# unit test
npm run test

# e2e test
npm run test:e2e

# test coverage
npm run test:cov
```

## Database Migration

```bash
# menjalankan migration
npm run migration:run

# revert migration terakhir
npm run migration:revert

# menampilkan status migration
npm run migration:show
```

## Struktur Proyek

```text
src/
├── common/        # filter, interceptor, guard, decorator bersama
├── config/        # konfigurasi aplikasi
├── database/      # data source, migration, seed
├── modules/        # domain modules (auth, tenant, outlet, user, rbac,
│                   #   product, recipe, inventory, order, table, payment,
│                   #   packaging, printer, storage, webhook, audit, report, settings)
├── types/         # shared type definitions
├── health.controller.ts
└── main.ts
```

Dokumentasi arsitektur, business rules, API spec, dan panduan lain tersedia di folder [`doc/`](./doc).

## Docker

Build & jalankan seluruh stack (API + PostgreSQL + MinIO) dengan Docker Compose:

```bash
docker compose up -d --build
```

Untuk deployment production menggunakan Docker Swarm, lihat [`docker-stack.yml`](./docker-stack.yml) dan [`doc/DEPLOYMENT_GUIDE.md`](./doc/DEPLOYMENT_GUIDE.md).

## Lisensi

Proprietary — hak cipta dilindungi. Lihat file [LICENSE](./LICENSE) untuk detail lengkap.
