import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Recipe } from './entities/recipe.entity';
import { ProductVariant } from '../product/entities/product-variant.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { RecipeService } from './services/recipe.service';
import { RecipeController } from './controllers/recipe.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Recipe, ProductVariant, InventoryItem])],
  controllers: [RecipeController],
  providers: [RecipeService],
  exports: [RecipeService],
})
export class RecipeModule {}
