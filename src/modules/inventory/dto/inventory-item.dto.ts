import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

export class CreateInventoryItemDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  @IsIn(['RAW_MATERIAL', 'PACKAGING'])
  itemType?: 'RAW_MATERIAL' | 'PACKAGING' = 'RAW_MATERIAL';

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  unit?: string = 'pcs';

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumStock?: number = 0;

  @IsOptional()
  @IsString()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string = 'ACTIVE';
}

export class UpdateInventoryItemDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  @IsIn(['RAW_MATERIAL', 'PACKAGING'])
  itemType?: 'RAW_MATERIAL' | 'PACKAGING';

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  unit!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @IsNumber()
  @Min(0)
  minimumStock!: number;

  @IsString()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status!: string;
}

export class QueryInventoryDto {
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
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  @IsIn(['ALL', 'RAW_MATERIAL', 'PACKAGING', 'raw_material', 'packaging'])
  itemType?: string;

  @IsOptional()
  @IsString()
  @IsIn([
    'ALL',
    'NORMAL',
    'LOW_STOCK',
    'OUT_OF_STOCK',
    'normal',
    'low_stock',
    'out_of_stock',
  ])
  stockStatus?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  outletId?: string;

  @IsOptional()
  @IsString()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string;

  @IsOptional()
  @IsString()
  @IsIn(['name', 'createdAt', 'updatedAt', 'sku', 'unitCost'])
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'sku' | 'unitCost' =
    'createdAt';

  @IsOptional()
  @IsString()
  @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  sortOrder?: 'ASC' | 'DESC' | 'asc' | 'desc' = 'DESC';
}

export class SetStockDto {
  @IsUUID()
  outletId!: string;

  @IsNumber()
  @Min(0)
  quantity!: number;
}
