import { MigrationInterface, QueryRunner } from 'typeorm';

export class PackagingManagement1700000000010 implements MigrationInterface {
  name = 'PackagingManagement1700000000010';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "packagings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "outlet_id" uuid,
        "name" character varying(150) NOT NULL,
        "inventory_item_id" uuid,
        "extra_price" numeric(12, 2) NOT NULL DEFAULT 0.00,
        "apply_to_order_type" character varying(50) NOT NULL DEFAULT 'TAKE_AWAY',
        "status" character varying(50) NOT NULL DEFAULT 'ACTIVE',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_packagings_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_packagings_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_packagings_outlet" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_packagings_inventory_item" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE SET NULL
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_packagings_tenant_id" ON "packagings" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_packagings_outlet_id" ON "packagings" ("outlet_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_packagings_status" ON "packagings" ("status")`,
    );

    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "packaging_fee" numeric(12, 2) NOT NULL DEFAULT 0.00`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "packaging_fee"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_packagings_status"`);
    await queryRunner.query(`DROP INDEX "IDX_packagings_outlet_id"`);
    await queryRunner.query(`DROP INDEX "IDX_packagings_tenant_id"`);
    await queryRunner.query(`DROP TABLE "packagings"`);
  }
}
