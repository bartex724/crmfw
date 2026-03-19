import { SessionService } from '../../src/auth/session.service';

function createPrismaMock() {
  return {
    session: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'session-1', ...data })),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn()
    }
  };
}

describe('Session policy', () => {
  it('enforces 24h idle timeout for sessions without remember-me', async () => {
    const prisma = createPrismaMock();
    const service = new SessionService(prisma as never);
    const now = new Date('2026-03-19T00:00:00.000Z');

    await service.createSession({
      userId: 'user-1',
      rememberMe: false,
      ipAddress: null,
      userAgent: null,
      now
    });

    expect(prisma.session.create).toHaveBeenCalledTimes(1);
    const payload = prisma.session.create.mock.calls[0][0].data;
    const idleMs = payload.idleExpiresAt.getTime() - now.getTime();
    const absoluteMs = payload.absoluteExpiresAt.getTime() - now.getTime();

    expect(idleMs).toBe(24 * 60 * 60 * 1000);
    expect(absoluteMs).toBe(24 * 60 * 60 * 1000);
  });

  it('enforces 30-day absolute limit for rememberMe=true with 24h idle checks', async () => {
    const prisma = createPrismaMock();
    const service = new SessionService(prisma as never);
    const now = new Date('2026-03-19T00:00:00.000Z');

    await service.createSession({
      userId: 'user-1',
      rememberMe: true,
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
      now
    });

    const payload = prisma.session.create.mock.calls[0][0].data;
    const idleMs = payload.idleExpiresAt.getTime() - now.getTime();
    const absoluteMs = payload.absoluteExpiresAt.getTime() - now.getTime();

    expect(idleMs).toBe(24 * 60 * 60 * 1000);
    expect(absoluteMs).toBe(30 * 24 * 60 * 60 * 1000);
  });
});
