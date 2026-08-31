import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string;
}

export class UpdateCategoryDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status!: string;
}
