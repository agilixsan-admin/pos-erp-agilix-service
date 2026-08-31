import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

export class CreateStockAdjustmentDto {
  @IsOptional()
  @IsDateString()
  adjustmentDate?: string;

  @IsString()
  @IsIn(['IN', 'OUT'])
  type!: 'IN' | 'OUT';

  @IsUUID()
  itemId!: string;

  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsOptional()
  @IsUUID()
  reasonCategoryId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID()
  outletId?: string;
}

export class CreateReasonCategoryDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  @IsIn(['IN', 'OUT', 'BOTH'])
  type?: 'IN' | 'OUT' | 'BOTH' = 'BOTH';

  @IsOptional()
  @IsString()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string = 'ACTIVE';
}

export class UpdateReasonCategoryDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @IsIn(['IN', 'OUT', 'BOTH'])
  type!: 'IN' | 'OUT' | 'BOTH';

  @IsString()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status!: string;
}

export class QueryMovementDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsUUID()
  outletId?: string;

  @IsOptional()
  @IsUUID()
  itemId?: string;

  @IsOptional()
  @IsString()
  @IsIn(['IN', 'OUT', 'SALE', 'ADJUSTMENT', 'VOID'])
  movementType?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
