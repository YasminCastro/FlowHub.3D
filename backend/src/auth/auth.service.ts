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
      throw new ConflictException('User already exists');
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

    return { message: 'User created successfully', user: created.email };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const user = await this.userService.user({ email: dto.email });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.verificationCode || !user.verificationCodeExpiresAt) {
      throw new UnauthorizedException('No verification code found');
    }
    if (user.verificationCodeExpiresAt < new Date()) {
      throw new UnauthorizedException('Verification code has expired');
    }
    const isCodeValid = await bcrypt.compare(dto.code, user.verificationCode);
    if (!isCodeValid) {
      throw new UnauthorizedException('Invalid verification code');
    }

    await this.userService.updateUser({
      where: { id: user.id },
      data: {
        verificationCode: null,
        verificationCodeExpiresAt: null,
        isEmailVerified: true,
      },
    });

    const tokens = await this.issueTokens(user.id, user.email);

    return { message: 'Email verified successfully', ...tokens };
  }

  async resendCode(dto: ResendCodeDto) {
    const user = await this.userService.user({ email: dto.email });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const hashedCode = await this.sendVerificationEmail(dto.email);

    await this.userService.updateUser({
      where: { id: user.id },
      data: {
        verificationCode: hashedCode,
        verificationCodeExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    return { message: 'Verification code resent successfully' };
  }

  async login(dto: LoginDto) {
    const user = await this.userService.user({ email: dto.email });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedException('Email not verified');
    }

    const tokens = await this.issueTokens(user.id, user.email);
    return { message: 'Login successful', ...tokens };
  }

  async refresh(userId: number, refreshToken: string) {
    const user = await this.userService.user({ id: userId });
    if (!user?.hashedRefreshToken) {
      throw new UnauthorizedException();
    }

    const matches = await bcrypt.compare(refreshToken, user.hashedRefreshToken);
    if (!matches) {
      throw new UnauthorizedException();
    }

    return this.issueTokens(user.id, user.email);
  }

  async logout(userId: number) {
    await this.userService.updateUser({
      where: { id: userId },
      data: { hashedRefreshToken: null },
    });
  }

  private async issueTokens(userId: number, email: string) {
    const payload = { sub: userId, email };

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
    payload: { sub: number; email: string },
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
