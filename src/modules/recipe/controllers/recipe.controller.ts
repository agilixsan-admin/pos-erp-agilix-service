import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { RecipeService } from '../services/recipe.service';
import { CreateRecipeDto, SetVariantRecipesDto } from '../dto/recipe.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { User } from '../../user/user.entity';

@Controller('recipes')
export class RecipeController {
  constructor(private readonly recipeService: RecipeService) {}

  @Get('variants/:variantId')
  @Permissions('product.read')
  async findByVariantId(
    @CurrentUser() user: User,
    @Param('variantId', ParseUUIDPipe) variantId: string,
  ) {
    const data = await this.recipeService.findByVariantId(
      user.tenantId,
      variantId,
    );
    return {
      success: true,
      message: 'Variant recipe retrieved successfully',
      data,
    };
  }

  @Get('variants/:variantId/cogs')
  @Permissions('product.read')
  async getVariantCogsSummary(
    @CurrentUser() user: User,
    @Param('variantId', ParseUUIDPipe) variantId: string,
  ) {
    const data = await this.recipeService.getVariantCogsSummary(
      user.tenantId,
      variantId,
    );
    return {
      success: true,
      message: 'Variant COGS and margin summary retrieved successfully',
      data,
    };
  }

  @Post()
  @Permissions('product.create')
  async createRecipe(@CurrentUser() user: User, @Body() dto: CreateRecipeDto) {
    const data = await this.recipeService.setVariantRecipes(
      user.tenantId,
      dto.variantId,
      { items: dto.items },
    );
    return {
      success: true,
      message: 'Variant recipe saved successfully',
      data,
    };
  }

  @Post('variants/:variantId')
  @Permissions('product.create')
  async createVariantRecipes(
    @CurrentUser() user: User,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() dto: SetVariantRecipesDto,
  ) {
    const data = await this.recipeService.setVariantRecipes(
      user.tenantId,
      variantId,
      dto,
    );
    return {
      success: true,
      message: 'Variant recipe saved successfully',
      data,
    };
  }

  @Put('variants/:variantId')
  @Permissions('product.update')
  async setVariantRecipes(
    @CurrentUser() user: User,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() dto: SetVariantRecipesDto,
  ) {
    const data = await this.recipeService.setVariantRecipes(
      user.tenantId,
      variantId,
      dto,
    );
    return {
      success: true,
      message: 'Variant recipe updated successfully',
      data,
    };
  }

  @Delete('variants/:variantId')
  @Permissions('product.delete')
  async delete(
    @CurrentUser() user: User,
    @Param('variantId', ParseUUIDPipe) variantId: string,
  ) {
    const data = await this.recipeService.delete(user.tenantId, variantId);
    return {
      success: true,
      message: 'Variant recipe deleted successfully',
      data,
    };
  }
}
