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
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreatePurchaseItemDto {
  @IsUUID()
  @IsNotEmpty()
  inventoryItemId!: string;

  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  quantityOrdered!: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitCost!: number;
}

export class CreatePurchaseDto {
  @IsUUID()
  @IsNotEmpty()
  outletId!: string;

  @IsUUID()
  @IsNotEmpty()
  supplierId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  purchaseNumber?: string;

  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseItemDto)
  items!: CreatePurchaseItemDto[];
}

export class UpdatePurchaseDto {
  @IsOptional()
  @IsUUID()
  outletId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseItemDto)
  items?: CreatePurchaseItemDto[];
}

export class ReceivePurchaseItemDto {
  @IsUUID()
  @IsNotEmpty()
  itemId!: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  quantityReceived!: number;
}

export class ReceivePurchaseDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceivePurchaseItemDto)
  items?: ReceivePurchaseItemDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}

export class QueryPurchaseDto {
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
  @IsIn(['DRAFT', 'RECEIVED', 'CANCELLED'])
  status?: 'DRAFT' | 'RECEIVED' | 'CANCELLED';

  @IsOptional()
  @IsUUID()
  outletId?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

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

