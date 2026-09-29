import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClosedByToPosShiftsTable1700000000037 implements MigrationInterface {
  name = 'AddClosedByToPosShiftsTable1700000000037';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pos_shifts"
      ADD COLUMN IF NOT EXISTS "closed_by_id" uuid;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_pos_shifts_closed_by'
        ) THEN
          ALTER TABLE "pos_shifts"
          ADD CONSTRAINT "FK_pos_shifts_closed_by"
          FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pos_shifts_tenant_outlet_status"
      ON "pos_shifts" ("tenant_id", "outlet_id", "status");
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_pos_shifts_tenant_outlet_status";
      ALTER TABLE "pos_shifts" DROP CONSTRAINT IF EXISTS "FK_pos_shifts_closed_by";
      ALTER TABLE "pos_shifts" DROP COLUMN IF EXISTS "closed_by_id";
    `);
  }
}
