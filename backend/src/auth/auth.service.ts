import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service.js';
import { SignupDto } from './dto/signup.dto.js';

import bcrypt from 'bcrypt';
import { randomInt } from 'node:crypto';
import { LoginDto } from './dto/login.dto.js';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../mail/mail.service.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';
import { ResendCodeDto } from './dto/resend-code.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private config: ConfigService,
    private mailService: MailService,
  ) {}

  async signup(dto: SignupDto) {
    const exists = await this.userService.user({ email: dto.email });
    if (exists) {
      throw new ConflictException('Este e-mail já está cadastrado');
    }

    const hashedCode = await this.sendVerificationEmail(dto.email);

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const created = await this.userService.createUser({
      email: dto.email,
      password: hashedPassword,
      name: dto.name,
      verificationCode: hashedCode,
      verificationCodeExpiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });

    return { message: 'Conta criada com sucesso', user: created.email };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const user = await this.userService.user({ email: dto.email });
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    if (!user.verificationCode || !user.verificationCodeExpiresAt) {
      throw new UnauthorizedException(
        'Nenhum código de verificação encontrado',
      );
    }
    if (user.verificationCodeExpiresAt < new Date()) {
      throw new UnauthorizedException(
        'Este código expirou. Peça um novo código.',
      );
    }
    const isCodeValid = await bcrypt.compare(dto.code, user.verificationCode);
    if (!isCodeValid) {
      throw new UnauthorizedException('Código de verificação inválido');
    }

    await this.userService.updateUser({
      where: { id: user.id },
      data: {
        verificationCode: null,
        verificationCodeExpiresAt: null,
        isEmailVerified: true,
      },
    });

    const tokens = await this.issueTokens(user.id, user.email, user.name);

    return { message: 'E-mail verificado com sucesso', ...tokens };
  }

  async resendCode(dto: ResendCodeDto) {
    const user = await this.userService.user({ email: dto.email });
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    const hashedCode = await this.sendVerificationEmail(dto.email);

    await this.userService.updateUser({
      where: { id: user.id },
      data: {
        verificationCode: hashedCode,
        verificationCodeExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    return { message: 'Código de verificação reenviado com sucesso' };
  }

  async login(dto: LoginDto) {
    const user = await this.userService.user({ email: dto.email });
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedException('E-mail não verificado');
    }

    const tokens = await this.issueTokens(user.id, user.email, user.name);
    return { message: 'Login realizado com sucesso', ...tokens };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.userService.user({ email: dto.email });
    if (user) {
      const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
      const hashedCode = await bcrypt.hash(code, 10);

      await this.mailService.sendPasswordResetCode(user.email, code);

      await this.userService.updateUser({
        where: { id: user.id },
        data: {
          passwordResetCode: hashedCode,
          passwordResetCodeExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      });
    }

    return {
      message:
        'Se o e-mail estiver cadastrado, um código de redefinição de senha foi enviado.',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const invalidCodeMessage = 'Código de redefinição inválido ou expirado';

    const user = await this.userService.user({ email: dto.email });
    if (
      !user ||
      !user.passwordResetCode ||
      !user.passwordResetCodeExpiresAt ||
      user.passwordResetCodeExpiresAt < new Date()
    ) {
      throw new UnauthorizedException(invalidCodeMessage);
    }

    const isCodeValid = await bcrypt.compare(dto.code, user.passwordResetCode);
    if (!isCodeValid) {
      throw new UnauthorizedException(invalidCodeMessage);
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    await this.userService.updateUser({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetCode: null,
        passwordResetCodeExpiresAt: null,
      },
    });
    return {
      message: 'Senha redefinida com sucesso.',
    };
  }

  async refresh(userId: string, refreshToken: string) {
    const user = await this.userService.user({ id: userId });
    if (!user?.hashedRefreshToken) {
      throw new UnauthorizedException();
    }

    const matches = await bcrypt.compare(refreshToken, user.hashedRefreshToken);
    if (!matches) {
      throw new UnauthorizedException();
    }

    return this.issueTokens(user.id, user.email, user.name);
  }

  async logout(userId: string) {
    await this.userService.updateUser({
      where: { id: userId },
      data: { hashedRefreshToken: null },
    });
  }

  private async issueTokens(
    userId: string,
    email: string,
    name: string | null,
  ) {
    const payload = { sub: userId, email, name };

    const accessToken = this.signToken(
      payload,
      'JWT_SECRET',
      'JWT_EXPIRES_IN',
      '15m',
    );
    const refreshToken = this.signToken(
      payload,
      'JWT_REFRESH_SECRET',
      'JWT_REFRESH_EXPIRES_IN',
      '7d',
    );

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.userService.updateUser({
      where: { id: userId },
      data: { hashedRefreshToken },
    });

    return { accessToken, refreshToken };
  }

  private signToken(
    payload: { sub: string; email: string; name: string | null },
    secretKey: 'JWT_SECRET' | 'JWT_REFRESH_SECRET',
    expiresInKey: 'JWT_EXPIRES_IN' | 'JWT_REFRESH_EXPIRES_IN',
    fallbackExpiresIn: `${number}${'s' | 'm' | 'h' | 'd'}`,
  ) {
    return this.jwtService.sign(payload, {
      secret: this.config.get<string>(secretKey),
      expiresIn: (this.config.get<string>(expiresInKey) ??
        fallbackExpiresIn) as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });
  }

  private async sendVerificationEmail(email: string) {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const hashedCode = await bcrypt.hash(code, 10);

    await this.mailService.sendVerificationCode(email, code);

    return hashedCode;
  }
}
