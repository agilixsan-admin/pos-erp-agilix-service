import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPackagingCategoryAndRelations1700000000015 implements MigrationInterface {
  name = 'AddPackagingCategoryAndRelations1700000000015';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "packaging_categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" character varying(150) NOT NULL,
        "description" character varying(500),
        "status" character varying(50) NOT NULL DEFAULT 'ACTIVE',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_packaging_categories_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_packaging_categories_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_packaging_categories_tenant_id" ON "packaging_categories" ("tenant_id")`,
    );

    await queryRunner.query(
      `ALTER TABLE "packagings" ADD COLUMN IF NOT EXISTS "category_id" uuid`,
    );

    await queryRunner.query(
      `ALTER TABLE "packagings" ADD COLUMN IF NOT EXISTS "sku" character varying(100)`,
    );

    await queryRunner.query(
      `ALTER TABLE "packagings" ADD COLUMN IF NOT EXISTS "description" character varying(500)`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_packagings_category_id" ON "packagings" ("category_id")`,
    );

    await queryRunner.query(
      `DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_packagings_category'
        ) THEN
          ALTER TABLE "packagings"
          ADD CONSTRAINT "FK_packagings_category"
          FOREIGN KEY ("category_id")
          REFERENCES "packaging_categories"("id")
          ON DELETE SET NULL;
        END IF;
      END $$;`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "packagings" DROP CONSTRAINT IF EXISTS "FK_packagings_category"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_packagings_category_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "packagings" DROP COLUMN IF EXISTS "description"`,
    );
    await queryRunner.query(
      `ALTER TABLE "packagings" DROP COLUMN IF EXISTS "sku"`,
    );
    await queryRunner.query(
      `ALTER TABLE "packagings" DROP COLUMN IF EXISTS "category_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_packaging_categories_tenant_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "packaging_categories"`);
  }
}
