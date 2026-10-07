import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeRolesTenantWideAndCreateUserOutlets1700000000039 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Roles table: Drop old unique constraint on (outlet_id, name)
    await queryRunner.query(
      `ALTER TABLE "roles" DROP CONSTRAINT IF EXISTS "UQ_roles_outlet_name"`,
    );

    // Make outlet_id nullable on roles
    await queryRunner.query(
      `ALTER TABLE "roles" ALTER COLUMN "outlet_id" DROP NOT NULL`,
    );

    // Deduplicate any duplicate role names per tenant if any exist before creating unique index
    await queryRunner.query(`
      UPDATE "roles" r
      SET "name" = r.name || ' (' || SUBSTRING(r.id::text, 1, 4) || ')'
      WHERE r.id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER(PARTITION BY tenant_id, name ORDER BY created_at ASC) as rn
          FROM "roles"
        ) sub WHERE sub.rn > 1
      )
    `);

    // Create unique index on (tenant_id, name) for tenant-wide role uniqueness
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_roles_tenant_name" ON "roles" ("tenant_id", "name")`,
    );

    // 2. Create user_outlets pivot table for Multi-Outlet Assignment (e.g. Area Manager)
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "user_outlets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "outlet_id" uuid NOT NULL,
        "is_primary" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_outlets_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_outlet" UNIQUE ("user_id", "outlet_id"),
        CONSTRAINT "FK_user_outlets_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_outlets_outlet" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_outlets_user_id" ON "user_outlets" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_outlets_outlet_id" ON "user_outlets" ("outlet_id")`,
    );

    // 3. Populate existing user.outlet_id into user_outlets
    await queryRunner.query(
      `INSERT INTO "user_outlets" ("user_id", "outlet_id", "is_primary")
       SELECT "id", "outlet_id", true
       FROM "users"
       WHERE "outlet_id" IS NOT NULL
       ON CONFLICT ("user_id", "outlet_id") DO NOTHING`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_outlets"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_roles_tenant_name"`);
    await queryRunner.query(
      `ALTER TABLE "roles" ADD CONSTRAINT "UQ_roles_outlet_name" UNIQUE ("outlet_id", "name")`,
    );
  }
}
