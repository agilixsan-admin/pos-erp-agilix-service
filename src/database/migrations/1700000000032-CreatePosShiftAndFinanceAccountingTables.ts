import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePosShiftAndFinanceAccountingTables1700000000032 implements MigrationInterface {
  name = 'CreatePosShiftAndFinanceAccountingTables1700000000032';

  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. pos_shifts
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pos_shifts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "outlet_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "opened_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "closed_at" TIMESTAMP WITH TIME ZONE,
        "opening_cash" numeric(12,2) NOT NULL DEFAULT 0,
        "expected_cash" numeric(12,2),
        "actual_cash" numeric(12,2),
        "cash_difference" numeric(12,2),
        "total_cash_sales" numeric(12,2) NOT NULL DEFAULT 0,
        "total_cash_out" numeric(12,2) NOT NULL DEFAULT 0,
        "notes" text,
        "status" varchar(20) NOT NULL DEFAULT 'OPEN',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "FK_pos_shifts_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_pos_shifts_outlet" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_pos_shifts_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT
      );

      CREATE INDEX IF NOT EXISTS "IDX_pos_shifts_tenant_outlet" ON "pos_shifts" ("tenant_id", "outlet_id");
      CREATE INDEX IF NOT EXISTS "IDX_pos_shifts_tenant_user_status" ON "pos_shifts" ("tenant_id", "user_id", "status");
    `);

    // 2. petty_cash_transactions
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "petty_cash_transactions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "outlet_id" uuid NOT NULL,
        "shift_id" uuid,
        "amount" numeric(12,2) NOT NULL,
        "category" varchar(100) NOT NULL,
        "notes" text,
        "receipt_photo_url" text NOT NULL,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "FK_petty_cash_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_petty_cash_outlet" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_petty_cash_shift" FOREIGN KEY ("shift_id") REFERENCES "pos_shifts"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_petty_cash_creator" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT
      );

      CREATE INDEX IF NOT EXISTS "IDX_petty_cash_tenant_outlet" ON "petty_cash_transactions" ("tenant_id", "outlet_id");
      CREATE INDEX IF NOT EXISTS "IDX_petty_cash_shift" ON "petty_cash_transactions" ("shift_id");
    `);

    // 3. financial_accounts (Kas & Bank)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "financial_accounts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "outlet_id" uuid,
        "account_code" varchar(50) NOT NULL,
        "account_name" varchar(150) NOT NULL,
        "account_type" varchar(30) NOT NULL,
        "account_number" varchar(100),
        "bank_name" varchar(100),
        "current_balance" numeric(15,2) NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "FK_financial_accounts_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_financial_accounts_outlet" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS "IDX_financial_accounts_tenant" ON "financial_accounts" ("tenant_id");
    `);

    // 4. financial_transfers (Transfer Antar Kas/Bank)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "financial_transfers" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "from_account_id" uuid NOT NULL,
        "to_account_id" uuid NOT NULL,
        "amount" numeric(15,2) NOT NULL,
        "transfer_date" date NOT NULL DEFAULT CURRENT_DATE,
        "notes" text,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "FK_transfers_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_transfers_from_account" FOREIGN KEY ("from_account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_transfers_to_account" FOREIGN KEY ("to_account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_transfers_creator" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT
      );

      CREATE INDEX IF NOT EXISTS "IDX_transfers_tenant" ON "financial_transfers" ("tenant_id");
    `);

    // 5. expense_categories & expenses
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "expense_categories" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "name" varchar(100) NOT NULL,
        "description" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "FK_expense_categories_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT
      );

      CREATE INDEX IF NOT EXISTS "IDX_expense_categories_tenant" ON "expense_categories" ("tenant_id");

      CREATE TABLE IF NOT EXISTS "expenses" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "outlet_id" uuid NOT NULL,
        "category_id" uuid NOT NULL,
        "financial_account_id" uuid NOT NULL,
        "amount" numeric(15,2) NOT NULL,
        "expense_date" date NOT NULL DEFAULT CURRENT_DATE,
        "recipient" varchar(150),
        "notes" text,
        "receipt_url" text,
        "petty_cash_id" uuid,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "FK_expenses_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_expenses_outlet" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_expenses_category" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_expenses_account" FOREIGN KEY ("financial_account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_expenses_petty_cash" FOREIGN KEY ("petty_cash_id") REFERENCES "petty_cash_transactions"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_expenses_creator" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT
      );

      CREATE INDEX IF NOT EXISTS "IDX_expenses_tenant_outlet" ON "expenses" ("tenant_id", "outlet_id");
      CREATE INDEX IF NOT EXISTS "IDX_expenses_date" ON "expenses" ("tenant_id", "expense_date");
    `);

    // 6. fixed_assets
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "fixed_assets" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "outlet_id" uuid NOT NULL,
        "name" varchar(150) NOT NULL,
        "category" varchar(100) NOT NULL,
        "purchase_date" date NOT NULL,
        "purchase_cost" numeric(15,2) NOT NULL,
        "financial_account_id" uuid,
        "useful_life_months" integer NOT NULL,
        "salvage_value" numeric(15,2) NOT NULL DEFAULT 0,
        "depreciation_method" varchar(30) NOT NULL DEFAULT 'STRAIGHT_LINE',
        "status" varchar(20) NOT NULL DEFAULT 'ACTIVE',
        "disposal_date" date,
        "disposal_price" numeric(15,2),
        "disposal_notes" text,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "FK_fixed_assets_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_fixed_assets_outlet" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_fixed_assets_account" FOREIGN KEY ("financial_account_id") REFERENCES "financial_accounts"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_fixed_assets_creator" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT
      );

      CREATE INDEX IF NOT EXISTS "IDX_fixed_assets_tenant_outlet" ON "fixed_assets" ("tenant_id", "outlet_id");
    `);

    // 7. chart_of_accounts
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "chart_of_accounts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "account_code" varchar(50) NOT NULL,
        "name" varchar(150) NOT NULL,
        "category" varchar(30) NOT NULL,
        "normal_balance" varchar(10) NOT NULL,
        "is_system" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "FK_coa_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
        CONSTRAINT "UQ_coa_tenant_account_code" UNIQUE ("tenant_id", "account_code")
      );

      CREATE INDEX IF NOT EXISTS "IDX_coa_tenant" ON "chart_of_accounts" ("tenant_id");
    `);

    // 8. journal_entries & journal_entry_lines
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "journal_entries" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "outlet_id" uuid,
        "entry_number" varchar(50) NOT NULL,
        "entry_date" date NOT NULL DEFAULT CURRENT_DATE,
        "source_type" varchar(50) NOT NULL,
        "source_id" uuid,
        "description" text NOT NULL,
        "created_by" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "FK_journals_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_journals_outlet" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_journals_creator" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT
      );

      CREATE INDEX IF NOT EXISTS "IDX_journals_tenant_date" ON "journal_entries" ("tenant_id", "entry_date");

      CREATE TABLE IF NOT EXISTS "journal_entry_lines" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "journal_entry_id" uuid NOT NULL,
        "account_id" uuid NOT NULL,
        "debit" numeric(15,2) NOT NULL DEFAULT 0,
        "credit" numeric(15,2) NOT NULL DEFAULT 0,
        "notes" text,
        CONSTRAINT "FK_journal_lines_entry" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_journal_lines_account" FOREIGN KEY ("account_id") REFERENCES "chart_of_accounts"("id") ON DELETE RESTRICT
      );

      CREATE INDEX IF NOT EXISTS "IDX_journal_lines_entry" ON "journal_entry_lines" ("journal_entry_id");
      CREATE INDEX IF NOT EXISTS "IDX_journal_lines_account" ON "journal_entry_lines" ("account_id");
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS "journal_entry_lines";
      DROP TABLE IF EXISTS "journal_entries";
      DROP TABLE IF EXISTS "chart_of_accounts";
      DROP TABLE IF EXISTS "fixed_assets";
      DROP TABLE IF EXISTS "expenses";
      DROP TABLE IF EXISTS "expense_categories";
      DROP TABLE IF EXISTS "financial_transfers";
      DROP TABLE IF EXISTS "financial_accounts";
      DROP TABLE IF EXISTS "petty_cash_transactions";
      DROP TABLE IF EXISTS "pos_shifts";
    `);
  }
}
