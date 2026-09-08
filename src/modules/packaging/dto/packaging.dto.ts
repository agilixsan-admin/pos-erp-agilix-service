import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreatePackagingDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsUUID()
  @IsOptional()
  outletId?: string;

  @IsUUID()
  @IsOptional()
  inventoryItemId?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE' = 'ACTIVE';
}

export class UpdatePackagingDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsUUID()
  @IsOptional()
  outletId?: string;

  @IsUUID()
  @IsOptional()
  inventoryItemId?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';
}

export class QueryPackagingDto {
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

  @IsUUID()
  @IsOptional()
  outletId?: string;

  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string;

  @IsString()
  @IsOptional()
  search?: string;
}
