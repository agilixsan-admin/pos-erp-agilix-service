import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixHttsSchemeInImageUrls1700000000027 implements MigrationInterface {
  name = 'FixHttpsSchemeInImageUrls1700000000027';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "products" SET "image_url" = REPLACE("image_url", 'htts://', 'https://') WHERE "image_url" LIKE 'htts://%'`,
    );
    await queryRunner.query(
      `UPDATE "inventory_stock_adjustments" SET "image_url" = REPLACE("image_url", 'https://', 'https://') WHERE "image_url" LIKE 'htts://%'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No-op: cannot easily revert sanitized URLs back to invalid scheme
  }
}
