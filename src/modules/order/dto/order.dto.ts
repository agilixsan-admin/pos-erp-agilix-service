import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateOrderItemDto {
  @IsUUID()
  variantId!: string;

  @IsNumber()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number = 0;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateOrderDto {
  @IsOptional()
  @IsUUID()
  outletId?: string;

  @IsOptional()
  @IsString()
  @IsIn(['DINE_IN', 'TAKE_AWAY'])
  orderType?: 'DINE_IN' | 'TAKE_AWAY' = 'DINE_IN';

  @IsOptional()
  @IsUUID()
  tableId?: string;

  @IsOptional()
  @IsString()
  tableNumber?: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsUUID()
  discountId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxAmount?: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(0)
  packagingFee?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
}

export class UpdateOrderDto {
  @IsOptional()
  @IsString()
  tableNumber?: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class QueryOrderDto {
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
  @IsString()
  @IsIn(['PENDING', 'PAID', 'COMPLETED', 'CANCELLED', 'VOID'])
  status?: string;

  @IsOptional()
  @IsString()
  @IsIn(['DINE_IN', 'TAKE_AWAY'])
  orderType?: string;

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

export class VoidOrderDto {
  @IsUUID()
  @IsNotEmpty()
  orderItemId!: string;

  @IsString()
  @MinLength(1)
  reason!: string;

  @IsOptional()
  @IsUUID()
  reasonCategoryId?: string;
}

export class AddOrderItemsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
}

