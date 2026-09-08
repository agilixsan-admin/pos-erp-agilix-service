import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStockAdjustmentsTable1700000000019 implements MigrationInterface {
  name = 'CreateStockAdjustmentsTable1700000000019';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "stock_adjustments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "outlet_id" uuid NOT NULL,
        "adjustment_number" character varying(50) NOT NULL,
        "adjustment_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "type" character varying(10) NOT NULL,
        "inventory_item_id" uuid NOT NULL,
        "previous_stock" numeric(12,2) NOT NULL DEFAULT 0,
        "quantity" numeric(12,2) NOT NULL,
        "current_stock" numeric(12,2) NOT NULL DEFAULT 0,
        "reason_category_id" uuid,
        "notes" text,
        "image_url" text,
        "source" character varying(50) NOT NULL DEFAULT 'MANUAL',
        "status" character varying(50) NOT NULL DEFAULT 'COMPLETED',
        "created_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_stock_adjustments_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_stock_adjustments_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_stock_adjustments_outlet" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_stock_adjustments_inventory_item" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_stock_adjustments_reason" FOREIGN KEY ("reason_category_id") REFERENCES "reason_categories"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_stock_adjustments_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_stock_adjustments_tenant_id" ON "stock_adjustments" ("tenant_id")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_stock_adjustments_tenant_outlet" ON "stock_adjustments" ("tenant_id", "outlet_id")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_stock_adjustments_tenant_number" ON "stock_adjustments" ("tenant_id", "adjustment_number")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_stock_adjustments_tenant_item" ON "stock_adjustments" ("tenant_id", "inventory_item_id")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_stock_adjustments_tenant_date" ON "stock_adjustments" ("tenant_id", "adjustment_date")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_stock_adjustments_tenant_date"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_stock_adjustments_tenant_item"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_stock_adjustments_tenant_number"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_stock_adjustments_tenant_outlet"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_stock_adjustments_tenant_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_adjustments"`);
  }
}
