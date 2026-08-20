import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CategoryService } from './category.service.js';
import { CategoryDto } from './dto/category.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Prisma } from '../generated/prisma/client.js';

@Controller('category')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  post(@CurrentUser('userId') currentUserId: string, @Body() dto: CategoryDto) {
    return this.categoryService.createCategory({
      ...dto,
      userId: currentUserId,
    });
  }

  @Get()
  get(@CurrentUser('userId') currentUserId: string) {
    return this.categoryService.findAllCategories(currentUserId);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.categoryService.findCategoryById(id);
  }

  @Patch(':id')
  patch(@Param('id') id: string, @Body() data: Prisma.CategoryUpdateInput) {
    return this.categoryService.updateCategory(id, data);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.categoryService.deleteCategory(id);
  }
}
