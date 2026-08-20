import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  ForbiddenException,
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
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { DeleteAccountDto } from './dto/delete-account.dto.js';

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
    @CurrentUser('userId') currentUserId: string,
    @Param('id') id: string,
    @Body() data: Prisma.UserUpdateInput,
  ): Promise<User> {
    if (id !== currentUserId) {
      throw new ForbiddenException('You can only update your own account.');
    }
    return this.userService.updateUser({ where: { id }, data });
  }

  @Delete(':id')
  remove(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') id: string,
    @Body() dto: DeleteAccountDto,
  ): Promise<User> {
    if (id !== currentUserId) {
      throw new ForbiddenException('You can only delete your own account.');
    }
    return this.userService.deleteUserWithPassword(id, dto.password);
  }
}
