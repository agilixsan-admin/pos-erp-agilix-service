import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOutletProductsTable1700000000030 implements MigrationInterface {
  name = 'CreateOutletProductsTable1700000000030';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "outlet_products" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "outlet_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "FK_outlet_products_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_outlet_products_outlet" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_outlet_products_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_outlet_products_tenant_outlet_product" UNIQUE ("tenant_id", "outlet_id", "product_id")
      );

      CREATE INDEX IF NOT EXISTS "IDX_outlet_products_tenant_outlet" ON "outlet_products" ("tenant_id", "outlet_id");
      CREATE INDEX IF NOT EXISTS "IDX_outlet_products_tenant_product" ON "outlet_products" ("tenant_id", "product_id");
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS "outlet_products";
    `);
  }
}

