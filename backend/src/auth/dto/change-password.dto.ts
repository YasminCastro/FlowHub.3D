import { IsString, Length, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(8)
  newPassword!: string;

  @IsString()
  @Length(8)
  currentPassword!: string;
}
