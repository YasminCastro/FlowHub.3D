import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { UserController } from './user.controller.js';
import { UserService } from './user.service.js';
import { User } from '../generated/prisma/client.js';

type MockUserService = {
  [K in keyof UserService]: jest.Mock<UserService[K]>;
};

describe('UserController', () => {
  let controller: UserController;
  let userService: MockUserService;

  const mockUser: User = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'test@example.com',
    name: 'Test User',
    password: 'hashed-password',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    userService = {
      user: jest.fn(),
      users: jest.fn(),
      createUser: jest.fn(),
      updateUser: jest.fn(),
      deleteUser: jest.fn(),
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

  describe('findAll', () => {
    it('should return an array of users', async () => {
      userService.users.mockResolvedValueOnce([mockUser]);

      const result = await controller.findAll();

      expect(result).toEqual([mockUser]);
      expect(userService.users).toHaveBeenCalledWith({
        skip: undefined,
        take: undefined,
      });
    });

    it('should convert skip and take query params to numbers', async () => {
      userService.users.mockResolvedValueOnce([mockUser]);

      await controller.findAll('5', '10');

      expect(userService.users).toHaveBeenCalledWith({ skip: 5, take: 10 });
    });
  });

  describe('findOne', () => {
    it('should return a user when found', async () => {
      userService.user.mockResolvedValueOnce(mockUser);

      const result = await controller.findOne('1');

      expect(result).toEqual(mockUser);
      expect(userService.user).toHaveBeenCalledWith({ id: '1' });
    });

    it('should throw NotFoundException when user does not exist', async () => {
      userService.user.mockResolvedValueOnce(null);

      await expect(controller.findOne('999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update and return the user', async () => {
      const updatedUser = { ...mockUser, name: 'Updated Name' };
      userService.updateUser.mockResolvedValueOnce(updatedUser);

      const result = await controller.update('1', { name: 'Updated Name' });

      expect(result).toEqual(updatedUser);
      expect(userService.updateUser).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { name: 'Updated Name' },
      });
    });
  });

  describe('remove', () => {
    it('should delete and return the user', async () => {
      userService.deleteUser.mockResolvedValueOnce(mockUser);

      const result = await controller.remove('1');

      expect(result).toEqual(mockUser);
      expect(userService.deleteUser).toHaveBeenCalledWith({ id: '1' });
    });
  });
});
