import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPurchasePaymentAndStatus1700000000033 implements MigrationInterface {
  name = 'AddPurchasePaymentAndStatus1700000000033';

  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Tambah kolom payment_status dan paid_amount pada tabel purchases
    await queryRunner.query(`
      ALTER TABLE "purchases" 
      ADD COLUMN IF NOT EXISTS "payment_status" varchar(50) NOT NULL DEFAULT 'UNPAID',
      ADD COLUMN IF NOT EXISTS "paid_amount" numeric(14,2) NOT NULL DEFAULT 0;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_purchases_payment_status" ON "purchases" ("payment_status");
    `);

    // 2. Buat tabel purchase_payments untuk mencatat riwayat pelunasan hutang pembelian
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "purchase_payments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "outlet_id" uuid NOT NULL,
        "purchase_id" uuid NOT NULL,
        "financial_account_id" uuid NOT NULL,
        "payment_number" varchar(50) NOT NULL,
        "payment_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "amount" numeric(14,2) NOT NULL,
        "notes" text,
        "created_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "FK_purchase_payments_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_purchase_payments_outlet" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_purchase_payments_purchase" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_purchase_payments_account" FOREIGN KEY ("financial_account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_purchase_payments_creator" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS "IDX_purchase_payments_tenant_id" ON "purchase_payments" ("tenant_id");
      CREATE INDEX IF NOT EXISTS "IDX_purchase_payments_tenant_outlet" ON "purchase_payments" ("tenant_id", "outlet_id");
      CREATE INDEX IF NOT EXISTS "IDX_purchase_payments_tenant_purchase" ON "purchase_payments" ("tenant_id", "purchase_id");
      CREATE INDEX IF NOT EXISTS "IDX_purchase_payments_tenant_number" ON "purchase_payments" ("tenant_id", "payment_number");
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "purchase_payments";`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_purchases_payment_status";`,
    );
    await queryRunner.query(`
      ALTER TABLE "purchases"
      DROP COLUMN IF EXISTS "paid_amount",
      DROP COLUMN IF EXISTS "payment_status";
    `);
  }
}
