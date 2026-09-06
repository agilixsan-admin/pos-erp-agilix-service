import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
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

  @IsUUID()
  @IsOptional()
  outletId?: string;

  @IsUUID()
  @IsOptional()
  inventoryItemId?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  extraPrice?: number = 0;

  @IsOptional()
  @IsIn(['TAKE_AWAY', 'ALL', 'CUSTOM'])
  applyToOrderType?: 'TAKE_AWAY' | 'ALL' | 'CUSTOM' = 'TAKE_AWAY';

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE' = 'ACTIVE';
}

export class UpdatePackagingDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsUUID()
  @IsOptional()
  outletId?: string;

  @IsUUID()
  @IsOptional()
  inventoryItemId?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  extraPrice?: number;

  @IsOptional()
  @IsIn(['TAKE_AWAY', 'ALL', 'CUSTOM'])
  applyToOrderType?: 'TAKE_AWAY' | 'ALL' | 'CUSTOM';

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

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string;

  @IsString()
  @IsOptional()
  search?: string;
}
