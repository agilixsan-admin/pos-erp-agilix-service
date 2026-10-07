import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUnitCostToInventoryStocks1700000000038 implements MigrationInterface {
  name = 'AddUnitCostToInventoryStocks1700000000038';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "inventory_stocks"
      ADD COLUMN IF NOT EXISTS "unit_cost" numeric(12, 2) NOT NULL DEFAULT 0.00;
    `);

    // Backfill outlet-specific unit cost from previous received purchases
    await queryRunner.query(`
      UPDATE "inventory_stocks" s
      SET "unit_cost" = COALESCE(agg.avg_cost, 0.00)
      FROM (
        SELECT 
          p.outlet_id, 
          pi.inventory_item_id, 
          ROUND(SUM(pi.quantity_received * pi.unit_cost) / NULLIF(SUM(pi.quantity_received), 0), 2) AS avg_cost
        FROM "purchase_items" pi
        JOIN "purchases" p ON p.id = pi.purchase_id
        WHERE p.status = 'RECEIVED'
        GROUP BY p.outlet_id, pi.inventory_item_id
      ) agg
      WHERE s.outlet_id = agg.outlet_id AND s.inventory_item_id = agg.inventory_item_id;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "inventory_stocks" DROP COLUMN IF EXISTS "unit_cost";
    `);
  }
}
