import { MigrationInterface, QueryRunner } from 'typeorm';

export class StockMovementAndAdjustment1700000000003 implements MigrationInterface {
  name = 'StockMovementAndAdjustment1700000000003';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "reason_categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "type" character varying NOT NULL DEFAULT 'BOTH',
        "status" character varying NOT NULL DEFAULT 'ACTIVE',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_reason_categories_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_reason_categories_tenant_name" UNIQUE ("tenant_id", "name")
      )`,
    );

    await queryRunner.query(
      `CREATE TABLE "inventory_movements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "outlet_id" uuid NOT NULL,
        "inventory_item_id" uuid NOT NULL,
        "movement_type" character varying NOT NULL,
        "quantity" numeric(12,2) NOT NULL,
        "reference_type" character varying,
        "reference_id" character varying,
        "reason_category_id" uuid,
        "notes" character varying,
        "movement_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "created_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "metadata" jsonb,
        CONSTRAINT "PK_inventory_movements_id" PRIMARY KEY ("id")
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_reason_categories_tenant_name" ON "reason_categories" ("tenant_id", "name")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_inventory_movements_tenant_outlet_item" ON "inventory_movements" ("tenant_id", "outlet_id", "inventory_item_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_inventory_movements_date" ON "inventory_movements" ("tenant_id", "movement_date")`,
    );

    await queryRunner.query(
      `ALTER TABLE "reason_categories" ADD CONSTRAINT "FK_reason_categories_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_movements" ADD CONSTRAINT "FK_inventory_movements_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_movements" ADD CONSTRAINT "FK_inventory_movements_outlet" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_movements" ADD CONSTRAINT "FK_inventory_movements_item" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_movements" ADD CONSTRAINT "FK_inventory_movements_reason" FOREIGN KEY ("reason_category_id") REFERENCES "reason_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_movements" ADD CONSTRAINT "FK_inventory_movements_user" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "inventory_movements" DROP CONSTRAINT "FK_inventory_movements_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_movements" DROP CONSTRAINT "FK_inventory_movements_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_movements" DROP CONSTRAINT "FK_inventory_movements_item"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_movements" DROP CONSTRAINT "FK_inventory_movements_outlet"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_movements" DROP CONSTRAINT "FK_inventory_movements_tenant"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reason_categories" DROP CONSTRAINT "FK_reason_categories_tenant"`,
    );

    await queryRunner.query(`DROP INDEX "IDX_inventory_movements_date"`);
    await queryRunner.query(
      `DROP INDEX "IDX_inventory_movements_tenant_outlet_item"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_reason_categories_tenant_name"`);

    await queryRunner.query(`DROP TABLE "inventory_movements"`);
    await queryRunner.query(`DROP TABLE "reason_categories"`);
  }
}
