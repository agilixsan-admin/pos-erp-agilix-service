import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixCategorySoftDeleteUniqueConstraint1700000000025 implements MigrationInterface {
  name = 'FixCategorySoftDeleteUniqueConstraint1700000000025';

  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop existing unique constraints/indexes on categories (tenant_id, name)
    await queryRunner.query(
      `ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "UQ_categories_tenant_name"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_categories_tenant_id_name"`,
    );

    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_categories_tenant_name"`);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_categories_tenant_name_active"`,
    );

    // 2. Create partial unique index so that uniqueness only applies to active (non-deleted) records
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_categories_tenant_name_active" ON "categories" ("tenant_id", "name") WHERE "deleted_at" IS NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_categories_tenant_name_active"`,
    );

    await queryRunner.query(
      `ALTER TABLE "categories" ADD CONSTRAINT "UQ_categories_tenant_name" UNIQUE ("tenant_id", "name")`,
    );
  }
}
