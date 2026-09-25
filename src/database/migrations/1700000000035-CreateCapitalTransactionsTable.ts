import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCapitalTransactionsTable1700000000035 implements MigrationInterface {
  name = 'CreateCapitalTransactionsTable1700000000035';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "capital_transactions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "outlet_id" uuid,
        "financial_account_id" uuid NOT NULL,
        "type" varchar(50) NOT NULL,
        "amount" numeric(15,2) NOT NULL,
        "transaction_date" date NOT NULL DEFAULT CURRENT_DATE,
        "party_name" varchar(150),
        "reference_number" varchar(100),
        "notes" text,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "FK_capital_transactions_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_capital_transactions_outlet" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_capital_transactions_account" FOREIGN KEY ("financial_account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_capital_transactions_creator" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT
      );

      CREATE INDEX IF NOT EXISTS "IDX_capital_transactions_tenant" ON "capital_transactions" ("tenant_id");
      CREATE INDEX IF NOT EXISTS "IDX_capital_transactions_tenant_date" ON "capital_transactions" ("tenant_id", "transaction_date");
      CREATE INDEX IF NOT EXISTS "IDX_capital_transactions_tenant_outlet" ON "capital_transactions" ("tenant_id", "outlet_id");
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "capital_transactions"`);
  }
}
