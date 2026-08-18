import { Exclude } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../generated/prisma/client.js';

export class UserEntity implements Omit<
  User,
  'password' | 'hashedRefreshToken' | 'passwordResetCode' | 'passwordResetCodeExpiresAt'
> {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ nullable: true, type: String })
  name!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  isEmailVerified!: boolean;

  @ApiProperty()
  verificationCode!: string | null;

  @ApiProperty()
  verificationCodeExpiresAt!: Date | null;

  @ApiProperty()
  updatedAt!: Date;

  @Exclude()
  password!: string;

  constructor(partial: Partial<User>) {
    Object.assign(this, partial);
  }
}
