import { MigrationInterface, QueryRunner } from 'typeorm';

export class TableManagementAndDineIn1700000000006 implements MigrationInterface {
  name = 'TableManagementAndDineIn1700000000006';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "tables" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "outlet_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "capacity" integer NOT NULL DEFAULT 4,
        "status" character varying NOT NULL DEFAULT 'AVAILABLE',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tables_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tables_outlet_name" UNIQUE ("outlet_id", "name")
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_tables_tenant_id" ON "tables" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tables_outlet_id" ON "tables" ("outlet_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tables_tenant_status" ON "tables" ("tenant_id", "status")`,
    );

    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN "table_id" uuid`);

    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_orders_table" FOREIGN KEY ("table_id") REFERENCES "tables"("id") ON DELETE SET NULL`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_orders_table_id" ON "orders" ("table_id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_orders_table_id"`);
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_orders_table"`,
    );
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "table_id"`);
    await queryRunner.query(`DROP TABLE "tables"`);
  }
}
