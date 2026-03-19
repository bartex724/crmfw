import type { INestApplication } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request = require('supertest');
import { AccessModule } from '../../src/access/access.module';
import { AuditService } from '../../src/audit/audit.service';
import { AuthService, SessionAuthGuard } from '../../src/auth/auth.service';
import { SessionService } from '../../src/auth/session.service';
import { PrismaService } from '../../src/database/prisma.service';
import { UsersController } from '../../src/users/users.controller';
import { UsersService } from '../../src/users/users.service';

const prismaMock = {
  role: {
    findUnique: jest.fn(async ({ where }: { where: { code: string } }) => ({
      id: where.code === 'OFFICE_STAFF' ? 'role-office' : 'role-admin',
      code: where.code,
      name: where.code
    }))
  },
  user: {
    update: jest.fn(
      async ({
        where,
        data
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => ({
        id: where.id,
        email: 'target@example.com',
        isActive: data.isActive ?? true,
        disabledAt: (data.disabledAt as Date | null | undefined) ?? null,
        role: {
          code: data.roleId === 'role-office' ? 'OFFICE_STAFF' : 'ADMIN'
        }
      })
    )
  }
};

const sessionServiceMock = {
  revokeUserSessions: jest.fn(async () => undefined)
};

const auditServiceMock = {
  record: jest.fn(async () => undefined)
};

@Module({
  imports: [AccessModule],
  controllers: [UsersController],
  providers: [
    UsersService,
    SessionAuthGuard,
    {
      provide: AuthService,
      useValue: {
        getAuthenticatedUserFromToken: jest.fn()
      }
    },
    {
      provide: PrismaService,
      useValue: prismaMock
    },
    {
      provide: SessionService,
      useValue: sessionServiceMock
    },
    {
      provide: AuditService,
      useValue: auditServiceMock
    }
  ]
})
class AdminConfirmationTestModule {}

describe('Sensitive admin confirmation requirements', () => {
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
      imports: [AdminConfirmationTestModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 400 ADMIN_CONFIRMATION_REQUIRED when confirmation is missing or invalid', async () => {
    const adminHeaders = { 'x-test-role': 'ADMIN' };

    const missingRoleConfirmation = await request(app.getHttpServer())
      .patch('/users/u1/role')
      .set(adminHeaders)
      .send({ role: 'OFFICE_STAFF' })
      .expect(400);

    expect(JSON.stringify(missingRoleConfirmation.body)).toContain('ADMIN_CONFIRMATION_REQUIRED');

    const missingDisableConfirmation = await request(app.getHttpServer())
      .patch('/users/u1/disable')
      .set(adminHeaders)
      .send({})
      .expect(400);
    expect(JSON.stringify(missingDisableConfirmation.body)).toContain('ADMIN_CONFIRMATION_REQUIRED');

    const invalidEnableConfirmation = await request(app.getHttpServer())
      .patch('/users/u1/enable')
      .set(adminHeaders)
      .send({
        confirmed: false,
        action: 'user.enable',
        targetUserId: 'u1'
      })
      .expect(400);
    expect(JSON.stringify(invalidEnableConfirmation.body)).toContain('ADMIN_CONFIRMATION_REQUIRED');

    expect(prismaMock.user.update).toHaveBeenCalledTimes(0);
  });

  it('mutates state when confirmation payload is valid', async () => {
    const adminHeaders = { 'x-test-role': 'ADMIN' };

    await request(app.getHttpServer())
      .patch('/users/u1/role')
      .set(adminHeaders)
      .send({
        role: 'OFFICE_STAFF',
        confirmation: {
          confirmed: true,
          action: 'user.role.change',
          targetUserId: 'u1',
          reason: 'Role change approved'
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

    expect(prismaMock.user.update).toHaveBeenCalledTimes(3);
  });
});
