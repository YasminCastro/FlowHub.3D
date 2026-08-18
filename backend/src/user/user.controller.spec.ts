import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { UserController } from './user.controller.js';
import { UserService } from './user.service.js';

describe('UserController', () => {
  let controller: UserController;

  beforeEach(async () => {
    const userService = {
      user: jest.fn(),
      users: jest.fn(),
      createUser: jest.fn(),
      updateUser: jest.fn(),
      deleteUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [{ provide: UserService, useValue: userService }],
    }).compile();

    controller = module.get<UserController>(UserController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
