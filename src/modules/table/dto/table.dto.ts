import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import type { TableStatus } from '../entities/table.entity';

export class CreateTableDto {
  @IsUUID()
  outletId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity?: number = 4;

  @IsOptional()
  @IsString()
  @IsIn(['AVAILABLE', 'OCCUPIED', 'RESERVED'])
  status?: TableStatus = 'AVAILABLE';
}

export class UpdateTableDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsString()
  @IsIn(['AVAILABLE', 'OCCUPIED', 'RESERVED'])
  status?: TableStatus;
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
  search?: string;
}
