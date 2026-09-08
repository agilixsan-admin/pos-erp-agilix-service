import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { TaxStatus, TaxType } from '../entities/tax.entity';

export class CreateTaxDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  rate!: number;

  @IsString()
  @IsIn(['INCLUSIVE', 'EXCLUSIVE'])
  type!: TaxType;

  @IsOptional()
  @IsString()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: TaxStatus = 'ACTIVE';

  @IsOptional()
  @IsBoolean()
  isGlobal?: boolean = false;

  @IsOptional()
  @IsUUID()
  outletId?: string;
}

export class UpdateTaxDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  rate?: number;

  @IsOptional()
  @IsString()
  @IsIn(['INCLUSIVE', 'EXCLUSIVE'])
  type?: TaxType;

  @IsOptional()
  @IsString()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: TaxStatus;

  @IsOptional()
  @IsBoolean()
  isGlobal?: boolean;
}

export class QueryTaxDto {
  @IsOptional()
  @IsUUID()
  outletId?: string;

  @IsOptional()
  @IsString()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: TaxStatus;

  @IsOptional()
  @IsString()
  @IsIn(['INCLUSIVE', 'EXCLUSIVE'])
  type?: TaxType;

  @IsOptional()
  @IsString()
  search?: string;
}

export class UpdateGlobalTaxConfigDto {
  @IsBoolean()
  enableTaxCalculation!: boolean;

  @IsOptional()
  @IsUUID()
  defaultGlobalTaxId?: string | null;

  @IsOptional()
  @IsUUID()
  outletId?: string;
}
