import { MigrationInterface, QueryRunner } from 'typeorm';

export class InventoryAndRecipe1700000000002 implements MigrationInterface {
  name = 'InventoryAndRecipe1700000000002';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "inventory_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "sku" character varying,
        "unit" character varying NOT NULL DEFAULT 'pcs',
        "minimum_stock" numeric(12,2) NOT NULL DEFAULT 0,
        "status" character varying NOT NULL DEFAULT 'ACTIVE',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_inventory_items_id" PRIMARY KEY ("id")
      )`,
    );

    await queryRunner.query(
      `CREATE TABLE "inventory_stocks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "outlet_id" uuid NOT NULL,
        "inventory_item_id" uuid NOT NULL,
        "quantity" numeric(12,2) NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_inventory_stocks_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_inventory_stocks_outlet_item" UNIQUE ("outlet_id", "inventory_item_id")
      )`,
    );

    await queryRunner.query(
      `CREATE TABLE "recipes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "variant_id" uuid NOT NULL,
        "inventory_item_id" uuid NOT NULL,
        "quantity" numeric(12,2) NOT NULL DEFAULT 1,
        "unit" character varying NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_recipes_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_recipes_variant_item" UNIQUE ("variant_id", "inventory_item_id")
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_inventory_items_tenant_sku" ON "inventory_items" ("tenant_id", "sku")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_inventory_stocks_tenant_outlet" ON "inventory_stocks" ("tenant_id", "outlet_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_recipes_tenant_variant" ON "recipes" ("tenant_id", "variant_id")`,
    );

    await queryRunner.query(
      `ALTER TABLE "inventory_items" ADD CONSTRAINT "FK_inventory_items_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_stocks" ADD CONSTRAINT "FK_inventory_stocks_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_stocks" ADD CONSTRAINT "FK_inventory_stocks_outlet" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_stocks" ADD CONSTRAINT "FK_inventory_stocks_item" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "recipes" ADD CONSTRAINT "FK_recipes_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "recipes" ADD CONSTRAINT "FK_recipes_variant" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "recipes" ADD CONSTRAINT "FK_recipes_item" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "recipes" DROP CONSTRAINT "FK_recipes_item"`,
    );
    await queryRunner.query(
      `ALTER TABLE "recipes" DROP CONSTRAINT "FK_recipes_variant"`,
    );
    await queryRunner.query(
      `ALTER TABLE "recipes" DROP CONSTRAINT "FK_recipes_tenant"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_stocks" DROP CONSTRAINT "FK_inventory_stocks_item"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_stocks" DROP CONSTRAINT "FK_inventory_stocks_outlet"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_stocks" DROP CONSTRAINT "FK_inventory_stocks_tenant"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_items" DROP CONSTRAINT "FK_inventory_items_tenant"`,
    );

    await queryRunner.query(`DROP INDEX "IDX_recipes_tenant_variant"`);
    await queryRunner.query(`DROP INDEX "IDX_inventory_stocks_tenant_outlet"`);
    await queryRunner.query(`DROP INDEX "IDX_inventory_items_tenant_sku"`);

    await queryRunner.query(`DROP TABLE "recipes"`);
    await queryRunner.query(`DROP TABLE "inventory_stocks"`);
    await queryRunner.query(`DROP TABLE "inventory_items"`);
  }
}
