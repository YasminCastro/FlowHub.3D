import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserController } from './user.controller.js';
import { UserService } from './user.service.js';
import { User } from '../generated/prisma/client.js';

type MockUserService = {
  [K in keyof UserService]: jest.Mock<UserService[K]>;
};

describe('UserController', () => {
  let controller: UserController;
  let userService: MockUserService;

  const userId = '11111111-1111-4111-8111-111111111111';
  const otherId = '22222222-2222-4222-8222-222222222222';

  const mockUser: User = {
    id: userId,
    email: 'test@example.com',
    name: 'Test User',
    password: 'hashed-password',
    hashedRefreshToken: 'hashed-refresh',
    isEmailVerified: true,
    verificationCode: '123456',
    verificationCodeExpiresAt: new Date('2026-01-02T00:00:00.000Z'),
    passwordResetCode: '654321',
    passwordResetCodeExpiresAt: new Date('2026-01-02T00:00:00.000Z'),
    queueShareToken: 'k3J9xQ2mT7vB1nR8wZ4yLa',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  // O que pode sair na resposta; nada de senha, token ou código.
  const publicUser = {
    id: userId,
    email: 'test@example.com',
    name: 'Test User',
    isEmailVerified: true,
    createdAt: mockUser.createdAt,
    updatedAt: mockUser.updatedAt,
  };

  beforeEach(async () => {
    userService = {
      user: jest.fn(),
      createUser: jest.fn(),
      updateUser: jest.fn(),
      deleteUser: jest.fn(),
      deleteUserWithPassword: jest.fn(),
    } as unknown as MockUserService;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [{ provide: UserService, useValue: userService }],
    }).compile();

    controller = module.get<UserController>(UserController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findOne', () => {
    it('returns only the public fields of the own account', async () => {
      userService.user.mockResolvedValueOnce(mockUser);

      const result = await controller.findOne(userId, userId);

      expect({ ...result }).toEqual(publicUser);
      expect(userService.user).toHaveBeenCalledWith({ id: userId });
    });

    it('throws NotFoundException when the user does not exist', async () => {
      userService.user.mockResolvedValueOnce(null);

      await expect(controller.findOne(userId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('does not show another user', async () => {
      await expect(controller.findOne(userId, otherId)).rejects.toThrow(
        ForbiddenException,
      );
      expect(userService.user).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates only the name and returns the public fields', async () => {
      userService.updateUser.mockResolvedValueOnce({
        ...mockUser,
        name: 'Updated Name',
      });

      const result = await controller.update(userId, userId, {
        name: 'Updated Name',
      });

      expect({ ...result }).toEqual({ ...publicUser, name: 'Updated Name' });
      expect(userService.updateUser).toHaveBeenCalledWith({
        where: { id: userId },
        data: { name: 'Updated Name' },
      });
    });

    it('ignores fields other than the name', async () => {
      userService.updateUser.mockResolvedValueOnce(mockUser);

      await controller.update(userId, userId, {
        name: 'Test User',
        password: 'plain',
        isEmailVerified: true,
      } as never);

      expect(userService.updateUser).toHaveBeenCalledWith({
        where: { id: userId },
        data: { name: 'Test User' },
      });
    });

    it('throws ForbiddenException when updating another user', async () => {
      await expect(
        controller.update(userId, otherId, { name: 'Updated Name' }),
      ).rejects.toThrow(ForbiddenException);
      expect(userService.updateUser).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes and returns the public fields', async () => {
      userService.deleteUserWithPassword.mockResolvedValueOnce(mockUser);

      const result = await controller.remove(userId, userId, {
        password: 'correct-password',
      });

      expect({ ...result }).toEqual(publicUser);
      expect(userService.deleteUserWithPassword).toHaveBeenCalledWith(
        userId,
        'correct-password',
      );
    });

    it('throws ForbiddenException when deleting another user', async () => {
      await expect(
        controller.remove(userId, otherId, { password: 'whatever' }),
      ).rejects.toThrow(ForbiddenException);
      expect(userService.deleteUserWithPassword).not.toHaveBeenCalled();
    });
  });
});
