import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { TableStatus } from '../entities/table.entity';

export class CreateTableDto {
  @IsUUID()
  outletId!: string;

  @IsString()
  @MinLength(1)
  tableNumber!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity?: number = 4;

  @IsOptional()
  @IsString()
  @IsIn(['AVAILABLE', 'OCCUPIED', 'RESERVED'])
  status?: TableStatus = 'AVAILABLE';

  @IsOptional()
  @IsString()
  @MaxLength(50)
  section?: string = 'Main Area';
}

export class UpdateTableDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  tableNumber?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsString()
  @IsIn(['AVAILABLE', 'OCCUPIED', 'RESERVED'])
  status?: TableStatus;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  section?: string;
}

export class QueryTableDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 50;

  @IsOptional()
  @IsUUID()
  outletId?: string;

  @IsOptional()
  @IsString()
  @IsIn(['AVAILABLE', 'OCCUPIED', 'RESERVED'])
  status?: TableStatus;

  @IsOptional()
  @IsString()
  section?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
