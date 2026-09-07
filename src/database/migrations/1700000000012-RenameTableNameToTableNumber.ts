import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameTableNameToTableNumber1700000000012 implements MigrationInterface {
  name = 'RenameTableNameToTableNumber1700000000012';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tables" DROP CONSTRAINT "UQ_tables_outlet_name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tables" RENAME COLUMN "name" TO "table_number"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tables" ADD CONSTRAINT "UQ_tables_outlet_table_number" UNIQUE ("outlet_id", "table_number")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tables" DROP CONSTRAINT "UQ_tables_outlet_table_number"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tables" RENAME COLUMN "table_number" TO "name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tables" ADD CONSTRAINT "UQ_tables_outlet_name" UNIQUE ("outlet_id", "name")`,
    );
  }
}
