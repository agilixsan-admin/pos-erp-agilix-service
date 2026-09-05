import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type {
  PrinterConnectionType,
  PrinterPaperSize,
  PrinterStatus,
  PrinterType,
} from '../entities/printer.entity';

export class CreatePrinterDto {
  @IsUUID()
  @IsNotEmpty()
  outletId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsIn(['RECEIPT', 'KITCHEN', 'BAR'])
  @IsNotEmpty()
  type!: PrinterType;

  @IsIn(['BLUETOOTH', 'NETWORK', 'USB'])
  @IsNotEmpty()
  connectionType!: PrinterConnectionType;

  @IsIn(['58mm', '80mm'])
  @IsOptional()
  paperSize?: PrinterPaperSize = '58mm';

  @IsString()
  @IsOptional()
  @MaxLength(45)
  ipAddress?: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  port?: number = 9100;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  bluetoothMac?: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean = false;
}

export class UpdatePrinterDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsIn(['RECEIPT', 'KITCHEN', 'BAR'])
  @IsOptional()
  type?: PrinterType;

  @IsIn(['BLUETOOTH', 'NETWORK', 'USB'])
  @IsOptional()
  connectionType?: PrinterConnectionType;

  @IsIn(['58mm', '80mm'])
  @IsOptional()
  paperSize?: PrinterPaperSize;

  @IsString()
  @IsOptional()
  @MaxLength(45)
  ipAddress?: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  port?: number;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  bluetoothMac?: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @IsIn(['ACTIVE', 'INACTIVE'])
  @IsOptional()
  status?: PrinterStatus;
}

export class QueryPrinterDto {
  @IsUUID()
  @IsOptional()
  outletId?: string;

  @IsIn(['RECEIPT', 'KITCHEN', 'BAR'])
  @IsOptional()
  type?: PrinterType;

  @IsIn(['BLUETOOTH', 'NETWORK', 'USB'])
  @IsOptional()
  connectionType?: PrinterConnectionType;

  @IsIn(['ACTIVE', 'INACTIVE'])
  @IsOptional()
  status?: PrinterStatus;
}

export class PrintOrderDto {
  @IsUUID()
  @IsOptional()
  printerId?: string;

  @IsIn(['RECEIPT', 'KITCHEN', 'BAR'])
  @IsOptional()
  type?: PrinterType = 'RECEIPT';
}
