import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import type { Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { UserService } from '../user/user.service.js';
import { MailService } from '../mail/mail.service.js';
import type { User } from '../generated/prisma/client.js';

/**
 * Exercises the real AuthController + AuthService together, backed by an
 * in-memory fake of UserService (no database) and a mocked MailService
 * (no real emails), to cover the signup -> verify -> login ->
 * forgot-password -> reset-password journey end to end.
 */
describe('Auth flow (signup, login, forgot password)', () => {
  let controller: AuthController;
  let users: Map<string, User>;
  let mailService: jest.Mocked<
    Pick<MailService, 'sendVerificationCode' | 'sendPasswordResetCode'>
  >;
  let res: jest.Mocked<Pick<Response, 'cookie' | 'clearCookie'>>;

  const configValues: Record<string, string> = {
    JWT_SECRET: 'test-jwt-secret',
    JWT_EXPIRES_IN: '15m',
    JWT_REFRESH_SECRET: 'test-jwt-refresh-secret',
    JWT_REFRESH_EXPIRES_IN: '7d',
  };

  beforeEach(async () => {
    users = new Map();
    mailService = {
      sendVerificationCode: jest.fn(),
      sendPasswordResetCode: jest.fn(),
    };
    res = { cookie: jest.fn(), clearCookie: jest.fn() };

    const userService: Pick<UserService, 'user' | 'createUser' | 'updateUser'> =
      {
        user: async (where) => {
          if (where.id) return users.get(where.id) ?? null;
          if (where.email) {
            return (
              [...users.values()].find((u) => u.email === where.email) ??
              null
            );
          }
          return null;
        },
        createUser: async (data) => {
          const user = {
            id: randomUUID(),
            hashedRefreshToken: null,
            isEmailVerified: false,
            verificationCode: null,
            verificationCodeExpiresAt: null,
            passwordResetCode: null,
            passwordResetCodeExpiresAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...data,
          } as User;
          users.set(user.id, user);
          return user;
        },
        updateUser: async ({ where, data }) => {
          const existing = where.id
            ? users.get(where.id)
            : [...users.values()].find((u) => u.email === where.email);
          if (!existing) throw new Error('user not found');
          const updated = { ...existing, ...data } as User;
          users.set(updated.id, updated);
          return updated;
        },
      };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        JwtService,
        { provide: UserService, useValue: userService },
        { provide: MailService, useValue: mailService },
        {
          provide: ConfigService,
          useValue: { get: (key: string) => configValues[key] },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('walks signup -> verify email -> login -> forgot password -> reset password -> login', async () => {
    const email = 'flow@example.com';
    const password = 'InitialPass123';

    const signupResult = await controller.signup({
      email,
      password,
      name: 'Flow User',
    } as any);
    expect(signupResult).toEqual({
      message: 'Conta criada com sucesso',
      user: email,
    });
    expect(mailService.sendVerificationCode).toHaveBeenCalledTimes(1);
    const [, verificationCode] =
      mailService.sendVerificationCode.mock.calls[0];

    await expect(
      controller.login({ email, password } as any, res as any),
    ).rejects.toThrow('E-mail não verificado');

    const verifyResult = await controller.verifyEmail(
      { email, code: verificationCode } as any,
      res as any,
    );
    expect(verifyResult.message).toBe('E-mail verificado com sucesso');
    expect(res.cookie).toHaveBeenCalledWith(
      'refreshToken',
      expect.any(String),
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
    );

    const loginResult = await controller.login(
      { email, password } as any,
      res as any,
    );
    expect(loginResult.message).toBe('Login realizado com sucesso');
    expect(loginResult.accessToken).toEqual(expect.any(String));

    const forgotResult = await controller.forgotPassword({ email } as any);
    expect(forgotResult.message).toContain(
      'Se o e-mail estiver cadastrado',
    );
    expect(mailService.sendPasswordResetCode).toHaveBeenCalledTimes(1);
    const [, resetCode] = mailService.sendPasswordResetCode.mock.calls[0];

    const newPassword = 'NewPassword456';
    const resetResult = await controller.resetPassword({
      email,
      code: resetCode,
      newPassword,
    } as any);
    expect(resetResult).toEqual({ message: 'Senha redefinida com sucesso.' });

    await expect(
      controller.login({ email, password } as any, res as any),
    ).rejects.toThrow('Credenciais inválidas');

    const finalLogin = await controller.login(
      { email, password: newPassword } as any,
      res as any,
    );
    expect(finalLogin.message).toBe('Login realizado com sucesso');
  });

  it('does not reveal whether an email exists when requesting a password reset', async () => {
    const result = await controller.forgotPassword({
      email: 'unknown@example.com',
    } as any);

    expect(result.message).toContain('Se o e-mail estiver cadastrado');
    expect(mailService.sendPasswordResetCode).not.toHaveBeenCalled();
  });
});
