import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePrinterCategoryRoutingTable1700000000022 implements MigrationInterface {
  name = 'CreatePrinterCategoryRoutingTable1700000000022';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "printer_category_routings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "outlet_id" uuid NOT NULL,
        "printer_id" uuid NOT NULL,
        "category_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_printer_category_routings_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_printer_category_routings_outlet_category" UNIQUE ("outlet_id", "category_id"),
        CONSTRAINT "FK_printer_category_routings_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_printer_category_routings_outlet" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_printer_category_routings_printer" FOREIGN KEY ("printer_id") REFERENCES "printers"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_printer_category_routings_category" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_printer_category_routings_tenant_id" ON "printer_category_routings" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_printer_category_routings_outlet_id" ON "printer_category_routings" ("outlet_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_printer_category_routings_printer_id" ON "printer_category_routings" ("printer_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_printer_category_routings_category_id" ON "printer_category_routings" ("category_id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "printer_category_routings"`);
  }
}
