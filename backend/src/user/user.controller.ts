import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { UserService } from './user.service.js';
import { UserEntity } from './entities/user.entity.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { DeleteAccountDto } from './dto/delete-account.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

// Cada um só vê e mexe na própria conta. Não há listagem de usuários.
@ApiTags('user')
@ApiBearerAuth()
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  private assertSelf(currentUserId: string, id: string) {
    if (id !== currentUserId) {
      throw new ForbiddenException('Você só pode acessar a sua conta.');
    }
  }

  @Get(':id')
  @ApiOkResponse({ type: UserEntity })
  async findOne(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') id: string,
  ): Promise<UserEntity> {
    this.assertSelf(currentUserId, id);
    const user = await this.userService.user({ id });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }
    return new UserEntity(user);
  }

  @Patch(':id')
  @ApiOkResponse({ type: UserEntity })
  async update(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserEntity> {
    this.assertSelf(currentUserId, id);
    const user = await this.userService.updateUser({
      where: { id },
      data: { name: dto.name },
    });
    return new UserEntity(user);
  }

  @Delete(':id')
  @ApiOkResponse({ type: UserEntity })
  async remove(
    @CurrentUser('userId') currentUserId: string,
    @Param('id') id: string,
    @Body() dto: DeleteAccountDto,
  ): Promise<UserEntity> {
    this.assertSelf(currentUserId, id);
    return new UserEntity(
      await this.userService.deleteUserWithPassword(id, dto.password),
    );
  }
}
