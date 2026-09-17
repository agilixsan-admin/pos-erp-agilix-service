import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddServiceChargeAndTaxDetails1700000000028 implements MigrationInterface {
  name = 'AddServiceChargeAndTaxDetails1700000000028';

  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add Service Charge configuration columns to pos_settings
    await queryRunner.query(`
      ALTER TABLE "pos_settings"
      ADD COLUMN IF NOT EXISTS "service_charge_enabled" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "service_charge_rate" numeric(5,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "service_charge_name" character varying(100) NOT NULL DEFAULT 'Service Charge',
      ADD COLUMN IF NOT EXISTS "service_charge_applicable_to" character varying(20) NOT NULL DEFAULT 'ALL'
    `);

    // 2. Add service_charge and tax detail columns to orders
    await queryRunner.query(`
      ALTER TABLE "orders"
      ADD COLUMN IF NOT EXISTS "service_charge" numeric(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "tax_name" character varying(100),
      ADD COLUMN IF NOT EXISTS "tax_rate" numeric(5,2),
      ADD COLUMN IF NOT EXISTS "tax_type" character varying(20)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders"
      DROP COLUMN IF EXISTS "tax_type",
      DROP COLUMN IF EXISTS "tax_rate",
      DROP COLUMN IF EXISTS "tax_name",
      DROP COLUMN IF EXISTS "service_charge"
    `);

    await queryRunner.query(`
      ALTER TABLE "pos_settings"
      DROP COLUMN IF EXISTS "service_charge_applicable_to",
      DROP COLUMN IF EXISTS "service_charge_name",
      DROP COLUMN IF EXISTS "service_charge_rate",
      DROP COLUMN IF EXISTS "service_charge_enabled"
    `);
  }
}

