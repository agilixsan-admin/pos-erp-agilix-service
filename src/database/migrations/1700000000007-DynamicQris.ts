import { MigrationInterface, QueryRunner } from 'typeorm';

export class DynamicQris1700000000007 implements MigrationInterface {
  name = 'DynamicQris1700000000007';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payments" ALTER COLUMN "paid_at" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ALTER COLUMN "paid_at" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD COLUMN "qr_string" text`,
    );
    await queryRunner.query(`ALTER TABLE "payments" ADD COLUMN "qr_url" text`);
    await queryRunner.query(
      `ALTER TABLE "payments" ADD COLUMN "expires_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD COLUMN "gateway_provider" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD COLUMN "gateway_reference" character varying(100)`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_payments_gateway_reference" ON "payments" ("tenant_id", "gateway_reference")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_payments_tenant_status" ON "payments" ("tenant_id", "status")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_payments_tenant_status"`);
    await queryRunner.query(`DROP INDEX "IDX_payments_gateway_reference"`);
    await queryRunner.query(
      `ALTER TABLE "payments" DROP COLUMN "gateway_reference"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP COLUMN "gateway_provider"`,
    );
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "expires_at"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "qr_url"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "qr_string"`);
    await queryRunner.query(
      `ALTER TABLE "payments" ALTER COLUMN "paid_at" SET DEFAULT now()`,
    );
    await queryRunner.query(
      `UPDATE "payments" SET "paid_at" = now() WHERE "paid_at" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ALTER COLUMN "paid_at" SET NOT NULL`,
    );
  }
}
