import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class RecipeItemDto {
  @IsUUID()
  inventoryItemId!: string;

  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsString()
  @MinLength(1)
  unit!: string;
}

export class SetVariantRecipesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RecipeItemDto)
  items!: RecipeItemDto[];
}
