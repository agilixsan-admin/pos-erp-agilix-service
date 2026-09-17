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
  ValidateIf,
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

  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsUUID()
  outletId?: string | null;
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
  @IsBoolean()
  serviceChargeEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  serviceChargeRate?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  serviceChargeName?: string;

  @IsOptional()
  @IsIn(['ALL', 'DINE_IN'])
  serviceChargeApplicableTo?: 'ALL' | 'DINE_IN';

  @IsOptional()
  @IsUUID()
  outletId?: string;
}
