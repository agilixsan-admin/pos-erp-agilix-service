import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSectionToTables1700000000026 implements MigrationInterface {
  name = 'AddSectionToTables1700000000026';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tables" ADD COLUMN IF NOT EXISTS "section" character varying(50) NOT NULL DEFAULT 'Main Area'`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tables_tenant_outlet_section" ON "tables" ("tenant_id", "outlet_id", "section")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tables_tenant_outlet_section"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tables" DROP COLUMN IF EXISTS "section"`,
    );
  }
}
