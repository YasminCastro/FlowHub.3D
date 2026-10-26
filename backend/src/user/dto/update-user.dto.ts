import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// Só o nome muda por aqui. E-mail e senha têm fluxos próprios em /auth.
export class UpdateUserDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'Informe seu nome.' })
  @MaxLength(100)
  name!: string;
}
