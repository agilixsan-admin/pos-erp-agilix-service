import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSuppliersTable1700000000016 implements MigrationInterface {
  name = 'CreateSuppliersTable1700000000016';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "suppliers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "code" character varying(50),
        "name" character varying(200) NOT NULL,
        "contact_person" character varying(150),
        "phone" character varying(50),
        "email" character varying(150),
        "address" text,
        "city" character varying(100),
        "province" character varying(100),
        "postal_code" character varying(20),
        "notes" text,
        "status" character varying(50) NOT NULL DEFAULT 'ACTIVE',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_suppliers_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_suppliers_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_suppliers_tenant_id" ON "suppliers" ("tenant_id")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_suppliers_tenant_code" ON "suppliers" ("tenant_id", "code")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_suppliers_tenant_name" ON "suppliers" ("tenant_id", "name")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_suppliers_status" ON "suppliers" ("status")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_suppliers_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_suppliers_tenant_name"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_suppliers_tenant_code"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_suppliers_tenant_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "suppliers"`);
  }
}
