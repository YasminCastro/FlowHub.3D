import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<Pick<AuthService, 'signup' | 'login'>>;

  beforeEach(async () => {
    authService = {
      signup: jest.fn(),
      login: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('signup should delegate to AuthService.signup', async () => {
    const dto = { email: 'a@a.com', password: '12345678' };
    authService.signup.mockResolvedValue({
      message: 'User created successfully',
      user: dto.email,
    });

    const result = await controller.signup(dto as any);

    expect(authService.signup).toHaveBeenCalledWith(dto);
    expect(result.user).toBe(dto.email);
  });

  it('login should delegate to AuthService.login', async () => {
    const dto = { email: 'a@a.com', password: '12345678' };
    authService.login.mockResolvedValue({
      message: 'Login successful',
      accessToken: 'fake-token',
    });

    const result = await controller.login(dto as any);

    expect(authService.login).toHaveBeenCalledWith(dto);
    expect(result.accessToken).toBe('fake-token');
  });
});
