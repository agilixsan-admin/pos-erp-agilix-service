import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

export class QuerySalesReportDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsUUID()
  outletId?: string;
}

export class QuerySummaryReportDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsUUID()
  outletId?: string;
}

export class QueryInventoryReportDto {
  @IsOptional()
  @IsUUID()
  outletId?: string;

  @IsOptional()
  search?: string;
}

export class QueryInventoryMovementsReportDto {
  @IsOptional()
  @IsUUID()
  outletId?: string;

  @IsOptional()
  @IsUUID()
  itemId?: string;

  @IsOptional()
  movementType?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

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
}
