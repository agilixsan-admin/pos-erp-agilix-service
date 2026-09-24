import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

// ─── Kas & Bank ─────────────────────────────────────────────────────────────

export class CreateFinancialAccountDto {
  @IsOptional()
  @IsUUID()
  outletId?: string;

  @IsString()
  @IsNotEmpty()
  accountCode!: string;

  @IsString()
  @IsNotEmpty()
  accountName!: string;

  @IsIn(['CASH', 'BANK', 'EWALLET', 'PAYMENT_GATEWAY'])
  accountType!: 'CASH' | 'BANK' | 'EWALLET' | 'PAYMENT_GATEWAY';

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  initialBalance?: number;
}

export class UpdateFinancialAccountDto {
  @IsOptional()
  @IsString()
  accountName?: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  isActive?: boolean;
}

export class CreateFinancialTransferDto {
  @IsUUID()
  @IsNotEmpty()
  fromAccountId!: string;

  @IsUUID()
  @IsNotEmpty()
  toAccountId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsDateString()
  transferDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

// ─── Biaya Operasional (Opex) ───────────────────────────────────────────────

export class CreateExpenseCategoryDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateExpenseDto {
  @IsUUID()
  @IsNotEmpty()
  outletId!: string;

  @IsUUID()
  @IsNotEmpty()
  categoryId!: string;

  @IsUUID()
  @IsNotEmpty()
  financialAccountId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  amount!: number;

  @IsDateString()
  expenseDate!: string;

  @IsOptional()
  @IsString()
  recipient?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  receiptUrl?: string;
}

export class QueryExpenseDto {
  @IsOptional()
  @IsUUID()
  outletId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

// ─── Aset Tetap & Depresiasi ────────────────────────────────────────────────

export class CreateFixedAssetDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }): string | undefined =>
    value === '' || value === null || value === undefined
      ? undefined
      : String(value),
  )
  @IsUUID()
  outletId?: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsDateString()
  purchaseDate!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  purchaseCost!: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }): string | undefined =>
    value === '' || value === null || value === undefined
      ? undefined
      : String(value),
  )
  @IsUUID()
  financialAccountId?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  usefulLifeMonths!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  salvageValue?: number;
}

export class DisposeFixedAssetDto {
  @IsDateString()
  disposalDate!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  disposalPrice?: number;

  @IsOptional()
  @IsString()
  disposalNotes?: string;
}

// ─── Jurnal Umum & Buku Besar ───────────────────────────────────────────────

export class JournalLineDto {
  @IsUUID()
  @IsNotEmpty()
  accountId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  debit!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  credit!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateManualJournalDto {
  @IsOptional()
  @IsUUID()
  outletId?: string;

  @IsDateString()
  entryDate!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines!: JournalLineDto[];
}

export class QueryJournalDto {
  @IsOptional()
  @IsUUID()
  outletId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  sourceType?: string;
}
