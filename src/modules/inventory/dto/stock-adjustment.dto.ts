import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
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

  @IsOptional()
  @IsUUID()
  itemId?: string;

  @IsOptional()
  @IsUUID()
  inventoryItemId?: string;

  @IsNumber()
  @Min(0.001)
  @Type(() => Number)
  quantity!: number;

  @IsOptional()
  @IsUUID()
  reasonCategoryId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsIn(['MANUAL', 'STOCK_OPNAME'])
  source?: 'MANUAL' | 'STOCK_OPNAME' = 'MANUAL';

  @IsOptional()
  @IsUUID()
  outletId?: string;
}

export class QueryStockAdjustmentDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsUUID()
  outletId?: string;

  @IsOptional()
  @IsUUID()
  inventoryItemId?: string;

  @IsOptional()
  @IsUUID()
  reasonCategoryId?: string;

  @IsOptional()
  @IsIn(['IN', 'OUT'])
  type?: 'IN' | 'OUT';

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  search?: string;
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
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
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
