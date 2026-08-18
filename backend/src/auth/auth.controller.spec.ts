import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import type { Response } from 'express';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<
    Pick<
      AuthService,
      | 'signup'
      | 'login'
      | 'refresh'
      | 'logout'
      | 'verifyEmail'
      | 'resendCode'
      | 'forgotPassword'
      | 'resetPassword'
    >
  >;
  let res: jest.Mocked<Pick<Response, 'cookie' | 'clearCookie'>>;

  beforeEach(async () => {
    authService = {
      signup: jest.fn(),
      login: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
      verifyEmail: jest.fn(),
      resendCode: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
    };
    res = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
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

  describe('verifyEmail', () => {
    const dto = { email: 'a@a.com', code: '123456' };

    it('should delegate to AuthService.verifyEmail', async () => {
      authService.verifyEmail.mockResolvedValue({
        message: 'E-mail verificado com sucesso',
        accessToken: 'fake-access-token',
        refreshToken: 'fake-refresh-token',
      });

      const result = await controller.verifyEmail(dto as any, res as any);

      expect(authService.verifyEmail).toHaveBeenCalledWith(dto);
      expect(result).toEqual({
        message: 'E-mail verificado com sucesso',
        accessToken: 'fake-access-token',
      });
    });

    it('should set the refresh token as an httpOnly cookie', async () => {
      authService.verifyEmail.mockResolvedValue({
        message: 'E-mail verificado com sucesso',
        accessToken: 'fake-access-token',
        refreshToken: 'fake-refresh-token',
      });

      await controller.verifyEmail(dto as any, res as any);

      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'fake-refresh-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
        }),
      );
    });

    it('should not leak the refresh token in the response body', async () => {
      authService.verifyEmail.mockResolvedValue({
        message: 'E-mail verificado com sucesso',
        accessToken: 'fake-access-token',
        refreshToken: 'fake-refresh-token',
      });

      const result = await controller.verifyEmail(dto as any, res as any);

      expect(result).not.toHaveProperty('refreshToken');
    });
  });

  describe('resendCode', () => {
    it('should delegate to AuthService.resendCode', async () => {
      const dto = { email: 'a@a.com' };
      authService.resendCode.mockResolvedValue({
        message: 'Código de verificação reenviado com sucesso',
      });

      const result = await controller.resendCode(dto as any);

      expect(authService.resendCode).toHaveBeenCalledWith(dto);
      expect(result).toEqual({
        message: 'Código de verificação reenviado com sucesso',
      });
    });
  });

  describe('forgotPassword', () => {
    it('should delegate to AuthService.forgotPassword', async () => {
      const dto = { email: 'a@a.com' };
      authService.forgotPassword.mockResolvedValue({
        message:
          'Se o e-mail estiver cadastrado, um código de redefinição de senha foi enviado.',
      });

      const result = await controller.forgotPassword(dto as any);

      expect(authService.forgotPassword).toHaveBeenCalledWith(dto);
      expect(result).toEqual({
        message:
          'Se o e-mail estiver cadastrado, um código de redefinição de senha foi enviado.',
      });
    });
  });

  describe('resetPassword', () => {
    it('should delegate to AuthService.resetPassword', async () => {
      const dto = {
        email: 'a@a.com',
        newPassword: 'newpassword123',
        code: '123456',
      };
      authService.resetPassword.mockResolvedValue({
        message: 'Senha redefinida com sucesso.',
      });

      const result = await controller.resetPassword(dto as any);

      expect(authService.resetPassword).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ message: 'Senha redefinida com sucesso.' });
    });
  });

  describe('login', () => {
    const dto = { email: 'a@a.com', password: '12345678' };

    it('should delegate to AuthService.login', async () => {
      authService.login.mockResolvedValue({
        message: 'Login successful',
        accessToken: 'fake-access-token',
        refreshToken: 'fake-refresh-token',
      });

      const result = await controller.login(dto as any, res as any);

      expect(authService.login).toHaveBeenCalledWith(dto);
      expect(result).toEqual({
        message: 'Login successful',
        accessToken: 'fake-access-token',
      });
    });

    it('should set the refresh token as an httpOnly cookie', async () => {
      authService.login.mockResolvedValue({
        message: 'Login successful',
        accessToken: 'fake-access-token',
        refreshToken: 'fake-refresh-token',
      });

      await controller.login(dto as any, res as any);

      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'fake-refresh-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
        }),
      );
    });

    it('should not leak the refresh token in the response body', async () => {
      authService.login.mockResolvedValue({
        message: 'Login successful',
        accessToken: 'fake-access-token',
        refreshToken: 'fake-refresh-token',
      });

      const result = await controller.login(dto as any, res as any);

      expect(result).not.toHaveProperty('refreshToken');
    });
  });

  describe('refresh', () => {
    const req = {
      user: { userId: 1, refreshToken: 'old-refresh-token' },
    };

    it('should delegate to AuthService.refresh using the cookie payload', async () => {
      authService.refresh.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      } as any);

      const result = await controller.refresh(req as any, res as any);

      expect(authService.refresh).toHaveBeenCalledWith(
        req.user.userId,
        req.user.refreshToken,
      );
      expect(result).toEqual({ accessToken: 'new-access-token' });
    });

    it('should rotate the refresh token cookie', async () => {
      authService.refresh.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      } as any);

      await controller.refresh(req as any, res as any);

      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'new-refresh-token',
        expect.objectContaining({ httpOnly: true }),
      );
    });
  });

  describe('logout', () => {
    const req = { user: { userId: 1, refreshToken: 'refresh-token' } };

    it('should delegate to AuthService.logout with the userId', async () => {
      authService.logout.mockResolvedValue(undefined);

      const result = await controller.logout(req as any, res as any);

      expect(authService.logout).toHaveBeenCalledWith(req.user.userId);
      expect(result).toEqual({ message: 'Logout successful' });
    });

    it('should clear the refresh token cookie', async () => {
      authService.logout.mockResolvedValue(undefined);

      await controller.logout(req as any, res as any);

      expect(res.clearCookie).toHaveBeenCalledWith('refreshToken');
    });
  });
});
