import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
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

    const payload = { sub: user.id, email: user.email };

    return {
      message: 'Login successful',
      accessToken: this.jwtService.sign(payload),
    };
  }
}
