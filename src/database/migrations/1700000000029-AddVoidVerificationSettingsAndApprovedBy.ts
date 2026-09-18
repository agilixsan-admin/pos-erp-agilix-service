import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVoidVerificationSettingsAndApprovedBy1700000000029 implements MigrationInterface {
  name = 'AddVoidVerificationSettingsAndApprovedBy1700000000029';

  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add void_verification_mode to pos_settings
    await queryRunner.query(`
      ALTER TABLE "pos_settings"
      ADD COLUMN IF NOT EXISTS "void_verification_mode" character varying(30) NOT NULL DEFAULT 'SUPERVISOR_APPROVAL'
    `);

    // 2. Add approved_by column to voids table with foreign key to users
    await queryRunner.query(`
      ALTER TABLE "voids"
      ADD COLUMN IF NOT EXISTS "approved_by" uuid
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_voids_approved_by_users'
        ) THEN
          ALTER TABLE "voids"
          ADD CONSTRAINT "FK_voids_approved_by_users"
          FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "voids"
      DROP CONSTRAINT IF EXISTS "FK_voids_approved_by_users",
      DROP COLUMN IF EXISTS "approved_by"
    `);

    await queryRunner.query(`
      ALTER TABLE "pos_settings"
      DROP COLUMN IF EXISTS "void_verification_mode"
    `);
  }
}
