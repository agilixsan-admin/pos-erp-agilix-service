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
} from 'class-validator';
import type { DiscountType } from '../entities/pos-settings.entity';

export class UpdatePosSettingsDto {
  @IsUUID()
  @IsOptional()
  outletId?: string | null;

  @IsBoolean()
  @IsOptional()
  taxEnabled?: boolean;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  taxRate?: number;

  @IsString()
  @MaxLength(50)
  @IsOptional()
  taxName?: string;

  @IsBoolean()
  @IsOptional()
  discountEnabled?: boolean;

  @IsIn(['PERCENTAGE', 'FIXED'])
  @IsOptional()
  discountType?: DiscountType;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discountValue?: number;

  @IsBoolean()
  @IsOptional()
  cashEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  qrisEnabled?: boolean;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  billLogoUrl?: string | null;

  @IsString()
  @IsOptional()
  billFooterText?: string | null;
}

export class QueryPosSettingsDto {
  @IsUUID()
  @IsOptional()
  outletId?: string;
}
