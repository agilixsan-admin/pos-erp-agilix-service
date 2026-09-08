import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePurchasesTables1700000000017 implements MigrationInterface {
  name = 'CreatePurchasesTables1700000000017';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "purchases" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "outlet_id" uuid NOT NULL,
        "supplier_id" uuid NOT NULL,
        "purchase_number" character varying(50) NOT NULL,
        "purchase_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "status" character varying(50) NOT NULL DEFAULT 'DRAFT',
        "total_items" integer NOT NULL DEFAULT 0,
        "subtotal" numeric(14,2) NOT NULL DEFAULT 0,
        "total_amount" numeric(14,2) NOT NULL DEFAULT 0,
        "notes" text,
        "received_at" TIMESTAMP WITH TIME ZONE,
        "received_by" uuid,
        "created_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_purchases_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_purchases_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_purchases_outlet" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_purchases_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_purchases_received_by" FOREIGN KEY ("received_by") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_purchases_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_purchases_tenant_id" ON "purchases" ("tenant_id")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_purchases_tenant_outlet" ON "purchases" ("tenant_id", "outlet_id")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_purchases_tenant_number" ON "purchases" ("tenant_id", "purchase_number")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_purchases_status" ON "purchases" ("status")`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "purchase_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "purchase_id" uuid NOT NULL,
        "inventory_item_id" uuid NOT NULL,
        "quantity_ordered" numeric(12,2) NOT NULL,
        "quantity_received" numeric(12,2) NOT NULL DEFAULT 0,
        "unit_cost" numeric(12,2) NOT NULL,
        "subtotal" numeric(14,2) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_purchase_items_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_purchase_items_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_purchase_items_purchase" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_purchase_items_inventory_item" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_purchase_items_tenant_purchase" ON "purchase_items" ("tenant_id", "purchase_id")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_purchase_items_tenant_inventory" ON "purchase_items" ("tenant_id", "inventory_item_id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_purchase_items_tenant_inventory"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_purchase_items_tenant_purchase"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "purchase_items"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_purchases_status"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_purchases_tenant_number"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_purchases_tenant_outlet"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_purchases_tenant_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "purchases"`);
  }
}
