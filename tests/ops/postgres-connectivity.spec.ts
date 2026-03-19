import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../src/database/prisma.service';

process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/crm?schema=public';

describe('PostgreSQL connectivity bootstrap', () => {
  const connectSpy = jest
    .spyOn(PrismaClient.prototype, '$connect')
    .mockResolvedValue(undefined as never);
  const disconnectSpy = jest
    .spyOn(PrismaClient.prototype, '$disconnect')
    .mockResolvedValue(undefined as never);
  const queryRawSpy = jest
    .spyOn(PrismaClient.prototype, '$queryRaw')
    .mockResolvedValue([{ ok: 1 }] as never);

  afterEach(async () => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    connectSpy.mockRestore();
    disconnectSpy.mockRestore();
    queryRawSpy.mockRestore();
  });

  it('connects Prisma on module init and executes readiness probe query', async () => {
    const prisma = new PrismaService();

    await prisma.onModuleInit();
    await prisma.probe();

    expect(connectSpy).toHaveBeenCalledTimes(1);
    expect(queryRawSpy).toHaveBeenCalledTimes(1);

    await prisma.onModuleDestroy();
  });

  it('disconnects Prisma when module is destroyed', async () => {
    const prisma = new PrismaService();

    await prisma.onModuleDestroy();

    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });
});
