import {
  IsArray,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import type {
  DiscountCalculationType,
  DiscountScope,
  DiscountStatus,
  DiscountValidityType,
} from '../entities/discount.entity';

export const VALID_DAYS_OF_WEEK = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;

export class CreateDiscountDto {
  @IsUUID()
  @IsOptional()
  outletId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsIn(['PERCENTAGE', 'FIXED'])
  @IsNotEmpty()
  type!: DiscountCalculationType;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  value!: number;

  @IsIn(['ALWAYS_ACTIVE', 'RECURRING_WEEKLY', 'DATE_RANGE'])
  @IsNotEmpty()
  validityType!: DiscountValidityType;

  @IsArray()
  @IsOptional()
  @IsIn(VALID_DAYS_OF_WEEK, { each: true })
  recurringDays?: string[];

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  minOrderAmount?: number = 0;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  maxDiscountAmount?: number;

  @IsIn(['ALL_PRODUCTS', 'SPECIFIC_PRODUCTS'])
  @IsOptional()
  applicableScope?: DiscountScope = 'ALL_PRODUCTS';

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  productIds?: string[];

  @IsIn(['ACTIVE', 'INACTIVE'])
  @IsOptional()
  status?: DiscountStatus = 'ACTIVE';
}

export class UpdateDiscountDto {
  @IsUUID()
  @IsOptional()
  outletId?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsIn(['PERCENTAGE', 'FIXED'])
  @IsOptional()
  type?: DiscountCalculationType;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  value?: number;

  @IsIn(['ALWAYS_ACTIVE', 'RECURRING_WEEKLY', 'DATE_RANGE'])
  @IsOptional()
  validityType?: DiscountValidityType;

  @IsArray()
  @IsOptional()
  @IsIn(VALID_DAYS_OF_WEEK, { each: true })
  recurringDays?: string[] | null;

  @IsString()
  @IsOptional()
  startDate?: string | null;

  @IsString()
  @IsOptional()
  endDate?: string | null;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  minOrderAmount?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  maxDiscountAmount?: number | null;

  @IsIn(['ALL_PRODUCTS', 'SPECIFIC_PRODUCTS'])
  @IsOptional()
  applicableScope?: DiscountScope;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  productIds?: string[];

  @IsIn(['ACTIVE', 'INACTIVE'])
  @IsOptional()
  status?: DiscountStatus;
}

export class QueryDiscountDto {
  @IsUUID()
  @IsOptional()
  outletId?: string;

  @IsIn(['ACTIVE', 'INACTIVE'])
  @IsOptional()
  status?: DiscountStatus;

  @IsIn(['ALWAYS_ACTIVE', 'RECURRING_WEEKLY', 'DATE_RANGE'])
  @IsOptional()
  validityType?: DiscountValidityType;

  @IsString()
  @IsOptional()
  search?: string;
}

export class QueryApplicableDiscountDto {
  @IsUUID()
  @IsOptional()
  outletId?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  orderAmount?: number;

  @IsString()
  @IsOptional()
  checkDate?: string;
}
