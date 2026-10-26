import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../generated/prisma/client.js';

// O que a API devolve de um usuário. Lista branca: campo novo no User (senha,
// tokens, códigos de e-mail) só sai daqui se for copiado de propósito.
export class UserEntity {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ nullable: true, type: String })
  name: string | null;

  @ApiProperty()
  isEmailVerified: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(user: User) {
    this.id = user.id;
    this.email = user.email;
    this.name = user.name;
    this.isEmailVerified = user.isEmailVerified;
    this.createdAt = user.createdAt;
    this.updatedAt = user.updatedAt;
  }
}
