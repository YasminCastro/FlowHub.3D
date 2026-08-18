import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { UserService } from './user.service.js';
import { Prisma, User } from '../generated/prisma/client.js';
import { UserEntity } from './entities/user.entity.js';

@ApiTags('user')
@ApiBearerAuth()
@UseInterceptors(ClassSerializerInterceptor)
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOkResponse({ type: UserEntity, isArray: true })
  async findAll(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ): Promise<UserEntity[]> {
    const users = await this.userService.users({
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
    });
    return users.map((user) => new UserEntity(user));
  }

  @Get(':id')
  @ApiOkResponse({ type: UserEntity })
  async findOne(@Param('id') id: string): Promise<UserEntity> {
    const user = await this.userService.user({ id });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return new UserEntity(user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() data: Prisma.UserUpdateInput,
  ): Promise<User> {
    return this.userService.updateUser({ where: { id }, data });
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<User> {
    return this.userService.deleteUser({ id });
  }
}
