import { MigrationInterface, QueryRunner } from 'typeorm';

export class PosSettings1700000000009 implements MigrationInterface {
  name = 'PosSettings1700000000009';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "pos_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "outlet_id" uuid,
        "tax_enabled" boolean NOT NULL DEFAULT false,
        "tax_rate" numeric(5, 2) NOT NULL DEFAULT 0.00,
        "tax_name" character varying(50) NOT NULL DEFAULT 'PB1',
        "discount_enabled" boolean NOT NULL DEFAULT false,
        "discount_type" character varying(20) NOT NULL DEFAULT 'PERCENTAGE',
        "discount_value" numeric(12, 2) NOT NULL DEFAULT 0.00,
        "cash_enabled" boolean NOT NULL DEFAULT true,
        "qris_enabled" boolean NOT NULL DEFAULT true,
        "bill_logo_url" character varying(500),
        "bill_footer_text" text DEFAULT 'Terima kasih atas kunjungan Anda!',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pos_settings_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_pos_settings_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_pos_settings_outlet" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_pos_settings_tenant_id" ON "pos_settings" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pos_settings_outlet_id" ON "pos_settings" ("outlet_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_pos_settings_tenant_outlet" ON "pos_settings" ("tenant_id", "outlet_id") WHERE "outlet_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_pos_settings_tenant_global" ON "pos_settings" ("tenant_id") WHERE "outlet_id" IS NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_pos_settings_tenant_global"`);
    await queryRunner.query(`DROP INDEX "UQ_pos_settings_tenant_outlet"`);
    await queryRunner.query(`DROP INDEX "IDX_pos_settings_outlet_id"`);
    await queryRunner.query(`DROP INDEX "IDX_pos_settings_tenant_id"`);
    await queryRunner.query(`DROP TABLE "pos_settings"`);
  }
}
