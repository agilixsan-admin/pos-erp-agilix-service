import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTaxesTable1700000000021 implements MigrationInterface {
  name = 'CreateTaxesTable1700000000021';

  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create taxes table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "taxes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "outlet_id" uuid,
        "name" character varying(100) NOT NULL,
        "description" character varying(255),
        "rate" numeric(5,2) NOT NULL DEFAULT 0,
        "type" character varying(20) NOT NULL DEFAULT 'EXCLUSIVE',
        "status" character varying(20) NOT NULL DEFAULT 'ACTIVE',
        "is_global" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_taxes_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_taxes_tenant_id" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_taxes_outlet_id" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE
      )
    `);

    // 2. Create indexes
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_taxes_tenant_id" ON "taxes" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_taxes_outlet_id" ON "taxes" ("outlet_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_taxes_status" ON "taxes" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_taxes_tenant_is_global" ON "taxes" ("tenant_id", "is_global")`,
    );

    // 3. Add default_global_tax_id to pos_settings
    await queryRunner.query(`
      ALTER TABLE "pos_settings" 
      ADD COLUMN IF NOT EXISTS "default_global_tax_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "pos_settings"
      ADD CONSTRAINT "FK_pos_settings_default_global_tax"
      FOREIGN KEY ("default_global_tax_id") REFERENCES "taxes"("id") ON DELETE SET NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pos_settings" DROP CONSTRAINT IF EXISTS "FK_pos_settings_default_global_tax"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pos_settings" DROP COLUMN IF EXISTS "default_global_tax_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "taxes"`);
  }
}
