import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductImageUrl1700000000005 implements MigrationInterface {
  name = 'AddProductImageUrl1700000000005';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN "image_url" character varying`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "image_url"`);
  }
}
