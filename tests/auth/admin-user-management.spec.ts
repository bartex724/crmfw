import type { INestApplication } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request = require('supertest');
import { AccessModule } from '../../src/access/access.module';
import { AuthService, SessionAuthGuard } from '../../src/auth/auth.service';
import { SessionService } from '../../src/auth/session.service';
import { LoginThrottleService } from '../../src/security/throttling.config';
import { CreateUserDto } from '../../src/users/dto/create-user.dto';
import { ResetPasswordDto } from '../../src/users/dto/reset-password.dto';
import { UsersController } from '../../src/users/users.controller';
import { UsersService } from '../../src/users/users.service';

type RoleCode = 'ADMIN' | 'WAREHOUSE_STAFF' | 'OFFICE_STAFF' | 'GUEST';

const usersServiceMock = {
  createUser: jest.fn(async () => ({ id: 'u1', email: 'created@example.com', isActive: true, role: 'GUEST' })),
  updateRole: jest.fn(async () => ({ id: 'u1', email: 'created@example.com', isActive: true, role: 'ADMIN' })),
  disableUser: jest.fn(async () => ({ id: 'u1', email: 'created@example.com', isActive: false, role: 'ADMIN' })),
  enableUser: jest.fn(async () => ({ id: 'u1', email: 'created@example.com', isActive: true, role: 'ADMIN' })),
  resetPassword: jest.fn(async () => ({ id: 'u1', email: 'created@example.com', isActive: true, role: 'ADMIN' }))
};

@Module({
  imports: [AccessModule],
  controllers: [UsersController],
  providers: [
    SessionAuthGuard,
    {
      provide: UsersService,
      useValue: usersServiceMock
    },
    {
      provide: AuthService,
      useValue: {
        getAuthenticatedUserFromToken: jest.fn()
      }
    }
  ]
})
class UsersEndpointTestModule {}

describe('Admin-only user lifecycle routes', () => {
  let app: INestApplication;
  const previousNodeEnv = process.env.NODE_ENV;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
  });

  afterAll(() => {
    process.env.NODE_ENV = previousNodeEnv;
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [UsersEndpointTestModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('allows admin and blocks guest for create/role/disable/enable/reset-password endpoints', async () => {
    const adminHeaders = { 'x-test-role': 'ADMIN' };
    const guestHeaders = { 'x-test-role': 'GUEST' };

    await request(app.getHttpServer())
      .post('/users')
      .set(adminHeaders)
      .send({ email: 'worker@example.com', password: 'Secret123!', role: 'WAREHOUSE_STAFF' })
      .expect(201);

    await request(app.getHttpServer())
      .patch('/users/u1/role')
      .set(adminHeaders)
      .send({
        role: 'OFFICE_STAFF',
        confirmation: {
          confirmed: true,
          action: 'user.role.change',
          targetUserId: 'u1'
        }
      })
      .expect(200);

    await request(app.getHttpServer())
      .patch('/users/u1/disable')
      .set(adminHeaders)
      .send({
        confirmed: true,
        action: 'user.disable',
        targetUserId: 'u1'
      })
      .expect(200);
    await request(app.getHttpServer())
      .patch('/users/u1/enable')
      .set(adminHeaders)
      .send({
        confirmed: true,
        action: 'user.enable',
        targetUserId: 'u1'
      })
      .expect(200);
    await request(app.getHttpServer())
      .patch('/users/u1/password')
      .set(adminHeaders)
      .send({ password: 'NewSecret123!' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/users')
      .set(guestHeaders)
      .send({ email: 'guest-blocked@example.com', password: 'Secret123!', role: 'GUEST' })
      .expect(403);

    await request(app.getHttpServer())
      .patch('/users/u1/role')
      .set(guestHeaders)
      .send({
        role: 'GUEST',
        confirmation: {
          confirmed: true,
          action: 'user.role.change',
          targetUserId: 'u1'
        }
      })
      .expect(403);

    await request(app.getHttpServer())
      .patch('/users/u1/disable')
      .set(guestHeaders)
      .send({
        confirmed: true,
        action: 'user.disable',
        targetUserId: 'u1'
      })
      .expect(403);
    await request(app.getHttpServer())
      .patch('/users/u1/enable')
      .set(guestHeaders)
      .send({
        confirmed: true,
        action: 'user.enable',
        targetUserId: 'u1'
      })
      .expect(403);
    await request(app.getHttpServer())
      .patch('/users/u1/password')
      .set(guestHeaders)
      .send({ password: 'Nope12345!' })
      .expect(403);
  });
});

type InMemoryRole = {
  id: string;
  code: RoleCode;
  name: string;
};

type InMemoryUser = {
  id: string;
  email: string;
  passwordHash: string;
  isActive: boolean;
  roleId: string;
  disabledAt: Date | null;
};

type InMemorySession = {
  id: string;
  userId: string;
  tokenHash: string;
  isActive: boolean;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
  revokedAt: Date | null;
  ipAddress: string | null;
  userAgent: string | null;
};

function createInMemoryPrisma() {
  const roles: InMemoryRole[] = [
    { id: 'role-admin', code: 'ADMIN', name: 'Admin' },
    { id: 'role-warehouse', code: 'WAREHOUSE_STAFF', name: 'Warehouse staff' },
    { id: 'role-office', code: 'OFFICE_STAFF', name: 'Office staff' },
    { id: 'role-guest', code: 'GUEST', name: 'Guest' }
  ];
  const users: InMemoryUser[] = [];
  const sessions: InMemorySession[] = [];

  const prisma = {
    role: {
      findUnique: jest.fn(async ({ where }: { where: { code?: RoleCode } }) => {
        if (!where.code) {
          return null;
        }
        return roles.find((role) => role.code === where.code) ?? null;
      })
    },
    user: {
      findUnique: jest.fn(
        async ({
          where,
          include
        }: {
          where: {
            id?: string;
            email?: string;
          };
          include?: {
            role?: boolean;
          };
        }) => {
          const record = where.id
            ? users.find((user) => user.id === where.id)
            : users.find((user) => user.email === (where.email ?? '').toLowerCase());

          if (!record) {
            return null;
          }

          if (include?.role) {
            const role = roles.find((candidate) => candidate.id === record.roleId);
            return {
              ...record,
              role
            };
          }

          return { ...record };
        }
      ),
      create: jest.fn(
        async ({
          data,
          include
        }: {
          data: {
            email: string;
            passwordHash: string;
            roleId: string;
            isActive: boolean;
          };
          include?: {
            role?: boolean;
          };
        }) => {
          const next: InMemoryUser = {
            id: `user-${users.length + 1}`,
            email: data.email.toLowerCase(),
            passwordHash: data.passwordHash,
            roleId: data.roleId,
            isActive: data.isActive,
            disabledAt: null
          };
          users.push(next);

          if (include?.role) {
            const role = roles.find((candidate) => candidate.id === next.roleId);
            return {
              ...next,
              role
            };
          }

          return { ...next };
        }
      ),
      update: jest.fn(
        async ({
          where,
          data,
          include
        }: {
          where: {
            id: string;
          };
          data: Partial<InMemoryUser>;
          include?: {
            role?: boolean;
          };
        }) => {
          const target = users.find((user) => user.id === where.id);
          if (!target) {
            throw new Error('not found');
          }

          Object.assign(target, data);

          if (include?.role) {
            const role = roles.find((candidate) => candidate.id === target.roleId);
            return {
              ...target,
              role
            };
          }

          return { ...target };
        }
      )
    },
    session: {
      create: jest.fn(
        async ({
          data
        }: {
          data: {
            userId: string;
            tokenHash: string;
            isActive: boolean;
            idleExpiresAt: Date;
            absoluteExpiresAt: Date;
            lastActivityAt: Date;
            ipAddress: string | null;
            userAgent: string | null;
          };
        }) => {
          const record: InMemorySession = {
            id: `session-${sessions.length + 1}`,
            userId: data.userId,
            tokenHash: data.tokenHash,
            isActive: data.isActive,
            idleExpiresAt: data.idleExpiresAt,
            absoluteExpiresAt: data.absoluteExpiresAt,
            lastActivityAt: data.lastActivityAt,
            createdAt: new Date(),
            updatedAt: new Date(),
            revokedAt: null,
            ipAddress: data.ipAddress,
            userAgent: data.userAgent
          };
          sessions.push(record);
          return { ...record };
        }
      ),
      findUnique: jest.fn(
        async ({
          where,
          include
        }: {
          where: {
            tokenHash: string;
          };
          include?: {
            user?: {
              include?: {
                role?: boolean;
              };
            };
          };
        }) => {
          const session = sessions.find((entry) => entry.tokenHash === where.tokenHash);
          if (!session) {
            return null;
          }

          if (include?.user) {
            const user = users.find((entry) => entry.id === session.userId);
            if (!user) {
              return null;
            }

            if (include.user.include?.role) {
              const role = roles.find((candidate) => candidate.id === user.roleId);
              return {
                ...session,
                user: {
                  ...user,
                  role
                }
              };
            }

            return {
              ...session,
              user: { ...user }
            };
          }

          return { ...session };
        }
      ),
      update: jest.fn(
        async ({
          where,
          data
        }: {
          where: {
            id: string;
          };
          data: Partial<InMemorySession>;
        }) => {
          const session = sessions.find((entry) => entry.id === where.id);
          if (!session) {
            throw new Error('not found');
          }

          Object.assign(session, data);
          session.updatedAt = new Date();
          return { ...session };
        }
      ),
      updateMany: jest.fn(
        async ({
          where,
          data
        }: {
          where: {
            userId?: string;
            tokenHash?: string;
            isActive?: boolean;
          };
          data: Partial<InMemorySession>;
        }) => {
          let count = 0;
          for (const session of sessions) {
            const matchUser = where.userId ? session.userId === where.userId : true;
            const matchToken = where.tokenHash ? session.tokenHash === where.tokenHash : true;
            const matchActive =
              typeof where.isActive === 'boolean' ? session.isActive === where.isActive : true;

            if (matchUser && matchToken && matchActive) {
              Object.assign(session, data);
              session.updatedAt = new Date();
              count += 1;
            }
          }
          return { count };
        }
      )
    }
  };

  return { prisma, users, sessions, roles };
}

describe('Admin-managed password lifecycle', () => {
  it('admin-created users receive permanent credentials and reset invalidates old password', async () => {
    const { prisma, users } = createInMemoryPrisma();
    const auditService = {
      record: jest.fn(async () => undefined)
    };
    const sessionService = new SessionService(prisma as never);
    const loginThrottle = new LoginThrottleService();
    const usersService = new UsersService(prisma as never, sessionService, auditService as never);
    const authService = new AuthService(
      prisma as never,
      sessionService,
      auditService as never,
      loginThrottle
    );

    const created = await usersService.createUser({
      email: 'warehouse@example.com',
      password: 'StartPass123!',
      role: 'WAREHOUSE_STAFF'
    } as CreateUserDto, 'admin-user');

    const storedUser = users.find((candidate) => candidate.id === created.id);
    expect(storedUser).toBeDefined();
    expect(storedUser?.passwordHash).not.toBe('StartPass123!');
    expect(await argon2.verify(storedUser?.passwordHash ?? '', 'StartPass123!')).toBe(true);

    const firstLogin = await authService.login({
      email: 'warehouse@example.com',
      password: 'StartPass123!',
      rememberMe: false,
      ipAddress: null,
      userAgent: null
    });
    expect(firstLogin.user.email).toBe('warehouse@example.com');

    await usersService.resetPassword(created.id, {
      password: 'NextPass123!'
    } as ResetPasswordDto);

    await expect(
      authService.login({
        email: 'warehouse@example.com',
        password: 'StartPass123!',
        rememberMe: false,
        ipAddress: null,
        userAgent: null
      })
    ).rejects.toThrow('Invalid credentials');

    await expect(
      authService.login({
        email: 'warehouse@example.com',
        password: 'NextPass123!',
        rememberMe: false,
        ipAddress: null,
        userAgent: null
      })
    ).resolves.toMatchObject({
      user: {
        email: 'warehouse@example.com'
      }
    });
  });
});
