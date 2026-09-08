import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDiscountsTable1700000000023 implements MigrationInterface {
  name = 'CreateDiscountsTable1700000000023';

  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create discounts table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "discounts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "outlet_id" uuid,
        "name" character varying(100) NOT NULL,
        "type" character varying(20) NOT NULL DEFAULT 'PERCENTAGE',
        "value" numeric(12,2) NOT NULL DEFAULT 0,
        "validity_type" character varying(30) NOT NULL DEFAULT 'ALWAYS_ACTIVE',
        "recurring_days" text[],
        "start_date" TIMESTAMP WITH TIME ZONE,
        "end_date" TIMESTAMP WITH TIME ZONE,
        "min_order_amount" numeric(12,2) NOT NULL DEFAULT 0,
        "max_discount_amount" numeric(12,2),
        "applicable_scope" character varying(30) NOT NULL DEFAULT 'ALL_PRODUCTS',
        "status" character varying(20) NOT NULL DEFAULT 'ACTIVE',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_discounts_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_discounts_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_discounts_outlet" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE RESTRICT
      )
    `);

    // 2. Create discount_products junction table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "discount_products" (
        "discount_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        CONSTRAINT "PK_discount_products" PRIMARY KEY ("discount_id", "product_id"),
        CONSTRAINT "FK_discount_products_discount" FOREIGN KEY ("discount_id") REFERENCES "discounts"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_discount_products_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE
      )
    `);

    // 3. Add discount_id to orders table
    await queryRunner.query(`
      ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "discount_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "orders"
      ADD CONSTRAINT "FK_orders_discount"
      FOREIGN KEY ("discount_id") REFERENCES "discounts"("id") ON DELETE SET NULL
    `);

    // 4. Create indexes
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_discounts_tenant_id" ON "discounts" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_discounts_outlet_id" ON "discounts" ("outlet_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_discounts_status" ON "discounts" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_discounts_validity_type" ON "discounts" ("validity_type")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_discount_products_discount_id" ON "discount_products" ("discount_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_discount_products_product_id" ON "discount_products" ("product_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_orders_discount_id" ON "orders" ("discount_id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "FK_orders_discount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "discount_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "discount_products"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "discounts"`);
  }
}
