import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateStockOpnameDto {
  @IsUUID()
  @IsNotEmpty()
  outletId!: string;

  @IsOptional()
  @IsIn(['ALL', 'CATEGORY'])
  scope?: 'ALL' | 'CATEGORY' = 'ALL';

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsDateString()
  opnameDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateStockOpnameCountItemDto {
  @IsUUID()
  @IsNotEmpty()
  inventoryItemId!: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  actualStock!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateStockOpnameCountsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateStockOpnameCountItemDto)
  items!: UpdateStockOpnameCountItemDto[];
}

export class QueryStockOpnameDto {
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
  @IsIn(['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
  status?: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

  @IsOptional()
  @IsIn(['ALL', 'CATEGORY'])
  scope?: 'ALL' | 'CATEGORY';

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

  @IsOptional()
  @IsString()
  search?: string;
}
