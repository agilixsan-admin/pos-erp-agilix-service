import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPhoneToOutlets1700000000011 implements MigrationInterface {
  name = 'AddPhoneToOutlets1700000000011';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "outlets" ADD COLUMN IF NOT EXISTS "phone" character varying`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "outlets" DROP COLUMN IF EXISTS "phone"`,
    );
  }
}

