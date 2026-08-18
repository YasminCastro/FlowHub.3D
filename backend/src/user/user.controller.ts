import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UserService } from './user.service.js';
import { Prisma, User } from '../generated/prisma/client.js';
import { UserModel } from '../generated/prisma/models.js';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  findAll(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ): Promise<User[]> {
    return this.userService.users({
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<User> {
    const user = await this.userService.user({ id: Number(id) });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() data: Prisma.UserUpdateInput,
  ): Promise<User> {
    return this.userService.updateUser({ where: { id: Number(id) }, data });
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<User> {
    return this.userService.deleteUser({ id: Number(id) });
  }
}
