import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStockOpnamesTables1700000000018 implements MigrationInterface {
  name = 'CreateStockOpnamesTables1700000000018';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "stock_opnames" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "outlet_id" uuid NOT NULL,
        "opname_number" character varying(50) NOT NULL,
        "opname_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "status" character varying(50) NOT NULL DEFAULT 'IN_PROGRESS',
        "scope" character varying(50) NOT NULL DEFAULT 'ALL',
        "category_id" uuid,
        "total_items" integer NOT NULL DEFAULT 0,
        "counted_items" integer NOT NULL DEFAULT 0,
        "matched_items" integer NOT NULL DEFAULT 0,
        "deficit_items" integer NOT NULL DEFAULT 0,
        "surplus_items" integer NOT NULL DEFAULT 0,
        "total_difference_value" numeric(14,2) NOT NULL DEFAULT 0,
        "notes" text,
        "finalized_at" TIMESTAMP WITH TIME ZONE,
        "finalized_by" uuid,
        "created_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_stock_opnames_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_stock_opnames_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_stock_opnames_outlet" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_stock_opnames_category" FOREIGN KEY ("category_id") REFERENCES "inventory_categories"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_stock_opnames_finalized_by" FOREIGN KEY ("finalized_by") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_stock_opnames_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_stock_opnames_tenant_id" ON "stock_opnames" ("tenant_id")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_stock_opnames_tenant_outlet" ON "stock_opnames" ("tenant_id", "outlet_id")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_stock_opnames_tenant_number" ON "stock_opnames" ("tenant_id", "opname_number")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_stock_opnames_status" ON "stock_opnames" ("status")`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "stock_opname_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "stock_opname_id" uuid NOT NULL,
        "inventory_item_id" uuid NOT NULL,
        "system_stock" numeric(12,2) NOT NULL DEFAULT 0,
        "actual_stock" numeric(12,2),
        "difference" numeric(12,2) NOT NULL DEFAULT 0,
        "status" character varying(50) NOT NULL DEFAULT 'UNCOUNTED',
        "notes" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_stock_opname_items_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_stock_opname_items_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_stock_opname_items_stock_opname" FOREIGN KEY ("stock_opname_id") REFERENCES "stock_opnames"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_stock_opname_items_inventory_item" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_stock_opname_items_tenant_opname" ON "stock_opname_items" ("tenant_id", "stock_opname_id")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_stock_opname_items_tenant_inventory" ON "stock_opname_items" ("tenant_id", "inventory_item_id")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_stock_opname_items_status" ON "stock_opname_items" ("status")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_stock_opname_items_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_stock_opname_items_tenant_inventory"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_stock_opname_items_tenant_opname"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_opname_items"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_stock_opnames_status"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_stock_opnames_tenant_number"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_stock_opnames_tenant_outlet"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_stock_opnames_tenant_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_opnames"`);
  }
}
