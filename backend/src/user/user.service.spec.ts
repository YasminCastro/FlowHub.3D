import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { UserService } from './user.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    const prismaService = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
