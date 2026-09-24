import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMaxOutletsToTenants1700000000034 implements MigrationInterface {
  name = 'AddMaxOutletsToTenants1700000000034';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "max_outlets" integer NOT NULL DEFAULT 1`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenants" DROP COLUMN IF EXISTS "max_outlets"`,
    );
  }
}
