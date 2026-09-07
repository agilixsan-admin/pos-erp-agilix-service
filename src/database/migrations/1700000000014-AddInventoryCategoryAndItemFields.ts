import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInventoryCategoryAndItemFields1700000000014 implements MigrationInterface {
  name = 'AddInventoryCategoryAndItemFields1700000000014';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "inventory_categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" character varying(150) NOT NULL,
        "description" character varying(500),
        "status" character varying(50) NOT NULL DEFAULT 'ACTIVE',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_inventory_categories_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_inventory_categories_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_inventory_categories_tenant_id" ON "inventory_categories" ("tenant_id")`,
    );

    await queryRunner.query(
      `ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "category_id" uuid`,
    );

    await queryRunner.query(
      `ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "description" character varying(500)`,
    );

    await queryRunner.query(
      `ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "unit_cost" numeric(12, 2) NOT NULL DEFAULT 0.00`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_inventory_items_category_id" ON "inventory_items" ("category_id")`,
    );

    await queryRunner.query(
      `DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_inventory_items_category'
        ) THEN
          ALTER TABLE "inventory_items"
          ADD CONSTRAINT "FK_inventory_items_category"
          FOREIGN KEY ("category_id")
          REFERENCES "inventory_categories"("id")
          ON DELETE SET NULL;
        END IF;
      END $$;`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "inventory_items" DROP CONSTRAINT IF EXISTS "FK_inventory_items_category"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_inventory_items_category_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_items" DROP COLUMN IF EXISTS "unit_cost"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_items" DROP COLUMN IF EXISTS "description"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_items" DROP COLUMN IF EXISTS "category_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_inventory_categories_tenant_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_categories"`);
  }
}
