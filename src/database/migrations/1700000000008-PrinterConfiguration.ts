import { MigrationInterface, QueryRunner } from 'typeorm';

export class PrinterConfiguration1700000000008 implements MigrationInterface {
  name = 'PrinterConfiguration1700000000008';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "printers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "outlet_id" uuid NOT NULL,
        "name" character varying(100) NOT NULL,
        "type" character varying(20) NOT NULL,
        "connection_type" character varying(20) NOT NULL,
        "paper_size" character varying(10) NOT NULL DEFAULT '58mm',
        "ip_address" character varying(45),
        "port" integer DEFAULT 9100,
        "bluetooth_mac" character varying(100),
        "is_default" boolean NOT NULL DEFAULT false,
        "status" character varying(20) NOT NULL DEFAULT 'ACTIVE',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_printers_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_printers_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_printers_outlet" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE RESTRICT
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_printers_tenant_id" ON "printers" ("tenant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_printers_outlet_id" ON "printers" ("outlet_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_printers_outlet_type" ON "printers" ("outlet_id", "type")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_printers_outlet_type_default" ON "printers" ("outlet_id", "type") WHERE "is_default" = true`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_printers_outlet_type_default"`);
    await queryRunner.query(`DROP INDEX "IDX_printers_outlet_type"`);
    await queryRunner.query(`DROP INDEX "IDX_printers_outlet_id"`);
    await queryRunner.query(`DROP INDEX "IDX_printers_tenant_id"`);
    await queryRunner.query(`DROP TABLE "printers"`);
  }
}
