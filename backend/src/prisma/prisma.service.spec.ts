import { jest } from '@jest/globals';

const mockPrismaPg = jest.fn();
const mockPrismaClientConstructor = jest.fn();

jest.unstable_mockModule('@prisma/adapter-pg', () => ({
  PrismaPg: mockPrismaPg,
}));

jest.unstable_mockModule('../generated/prisma/client.js', () => ({
  PrismaClient: class {
    constructor(...args: unknown[]) {
      mockPrismaClientConstructor(...args);
    }
  },
}));

describe('PrismaService', () => {
  let PrismaService: typeof import('./prisma.service.js').PrismaService;

  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(async () => {
    mockPrismaPg.mockClear();
    mockPrismaClientConstructor.mockClear();
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/test';

    ({ PrismaService } = await import('./prisma.service.js'));
  });

  afterAll(() => {
    process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it('should be defined', () => {
    const service = new PrismaService();

    expect(service).toBeDefined();
  });

  it('should build the Postgres adapter using DATABASE_URL from the environment', () => {
    new PrismaService();

    expect(mockPrismaPg).toHaveBeenCalledTimes(1);
    expect(mockPrismaPg).toHaveBeenCalledWith({
      connectionString: 'postgresql://user:pass@localhost:5432/test',
    });
  });

  it('should pass the adapter instance to PrismaClient', () => {
    new PrismaService();

    expect(mockPrismaClientConstructor).toHaveBeenCalledTimes(1);
    const [{ adapter }] = mockPrismaClientConstructor.mock.calls[0] as [
      { adapter: unknown },
    ];
    expect(adapter).toBeInstanceOf(mockPrismaPg);
  });
});
