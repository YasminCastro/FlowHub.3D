import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service.js';
import { SignupDto } from './dto/signup.dto.js';

import bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto.js';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async signup(dto: SignupDto) {
    const exists = await this.userService.user({ email: dto.email });
    if (exists) {
      throw new ConflictException('User already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const created = await this.userService.createUser({
      email: dto.email,
      password: hashedPassword,
      name: dto.name,
    });
    return { message: 'User created successfully', user: created.email };
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
}
