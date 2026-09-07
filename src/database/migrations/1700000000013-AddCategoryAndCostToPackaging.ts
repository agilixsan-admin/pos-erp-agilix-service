import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCategoryAndCostToPackaging1700000000013 implements MigrationInterface {
  name = 'AddCategoryAndCostToPackaging1700000000013';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "packagings" ADD COLUMN IF NOT EXISTS "category" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "packagings" ADD COLUMN IF NOT EXISTS "cost_price" numeric(12, 2) NOT NULL DEFAULT 0.00`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_packagings_category" ON "packagings" ("category")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_packagings_category"`);
    await queryRunner.query(
      `ALTER TABLE "packagings" DROP COLUMN IF EXISTS "cost_price"`,
    );
    await queryRunner.query(
      `ALTER TABLE "packagings" DROP COLUMN IF EXISTS "category"`,
    );
  }
}
