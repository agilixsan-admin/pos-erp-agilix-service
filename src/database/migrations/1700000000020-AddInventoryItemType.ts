import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInventoryItemType1700000000020 implements MigrationInterface {
  name = 'AddInventoryItemType1700000000020';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "item_type" character varying(50) NOT NULL DEFAULT 'RAW_MATERIAL'`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_inventory_items_item_type" ON "inventory_items" ("tenant_id", "item_type")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_inventory_items_item_type"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_items" DROP COLUMN IF EXISTS "item_type"`,
    );
  }
}
