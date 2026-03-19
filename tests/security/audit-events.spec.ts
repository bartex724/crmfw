import * as argon2 from 'argon2';
import { AuditService } from '../../src/audit/audit.service';
import { AuthService } from '../../src/auth/auth.service';
import { SessionService } from '../../src/auth/session.service';
import { LoginThrottleService } from '../../src/security/throttling.config';
import { UsersService } from '../../src/users/users.service';

type RoleCode = 'ADMIN' | 'WAREHOUSE_STAFF' | 'OFFICE_STAFF' | 'GUEST';

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
  revokedAt: Date | null;
  ipAddress: string | null;
  userAgent: string | null;
};

function createAuditPrismaHarness() {
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
      findUnique: jest.fn(async ({ where }: { where: { code: RoleCode } }) => {
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
          const found = where.id
            ? users.find((candidate) => candidate.id === where.id)
            : users.find((candidate) => candidate.email === (where.email ?? '').toLowerCase());
          if (!found) {
            return null;
          }

          if (include?.role) {
            return {
              ...found,
              role: roles.find((candidate) => candidate.id === found.roleId)
            };
          }

          return { ...found };
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
            isActive: data.isActive,
            roleId: data.roleId,
            disabledAt: null
          };
          users.push(next);

          if (include?.role) {
            return {
              ...next,
              role: roles.find((candidate) => candidate.id === next.roleId)
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
          const user = users.find((candidate) => candidate.id === where.id);
          if (!user) {
            throw new Error('not found');
          }

          Object.assign(user, data);

          if (include?.role) {
            return {
              ...user,
              role: roles.find((candidate) => candidate.id === user.roleId)
            };
          }

          return { ...user };
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
          const next: InMemorySession = {
            id: `session-${sessions.length + 1}`,
            userId: data.userId,
            tokenHash: data.tokenHash,
            isActive: data.isActive,
            idleExpiresAt: data.idleExpiresAt,
            absoluteExpiresAt: data.absoluteExpiresAt,
            lastActivityAt: data.lastActivityAt,
            revokedAt: null,
            ipAddress: data.ipAddress,
            userAgent: data.userAgent
          };
          sessions.push(next);
          return { ...next };
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
          const found = sessions.find((session) => session.tokenHash === where.tokenHash);
          if (!found) {
            return null;
          }

          if (include?.user) {
            const user = users.find((candidate) => candidate.id === found.userId);
            if (!user) {
              return null;
            }

            return {
              ...found,
              user: {
                ...user,
                role: roles.find((candidate) => candidate.id === user.roleId)
              }
            };
          }

          return { ...found };
        }
      ),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<InMemorySession> }) => {
        const found = sessions.find((session) => session.id === where.id);
        if (!found) {
          throw new Error('not found');
        }
        Object.assign(found, data);
        return { ...found };
      }),
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
              count += 1;
            }
          }
          return { count };
        }
      )
    },
    auditLog: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'audit', ...data }))
    }
  };

  return { prisma, users, roles };
}

describe('Audit events persistence', () => {
  it('persists auth.login.success, auth.login.failure, and auth.logout events', async () => {
    const { prisma, users, roles } = createAuditPrismaHarness();
    users.push({
      id: 'user-admin',
      email: 'admin@example.com',
      passwordHash: await argon2.hash('AdminPass123!'),
      isActive: true,
      roleId: roles.find((role) => role.code === 'ADMIN')?.id ?? 'role-admin',
      disabledAt: null
    });

    const auditService = new AuditService(prisma as never);
    const sessionService = new SessionService(prisma as never);
    const loginThrottle = new LoginThrottleService();
    const authService = new AuthService(prisma as never, sessionService, auditService, loginThrottle);

    await expect(
      authService.login({
        email: 'admin@example.com',
        password: 'WrongPass123!',
        rememberMe: false,
        ipAddress: '127.0.0.1',
        userAgent: 'jest'
      })
    ).rejects.toThrow('Invalid credentials');

    const login = await authService.login({
      email: 'admin@example.com',
      password: 'AdminPass123!',
      rememberMe: false,
      ipAddress: '127.0.0.1',
      userAgent: 'jest'
    });

    await authService.logoutByToken(login.token, login.user.id, '127.0.0.1', 'jest');

    const actions = prisma.auditLog.create.mock.calls.map((call) => call[0].data.action);
    expect(actions).toContain('auth.login.failure');
    expect(actions).toContain('auth.login.success');
    expect(actions).toContain('auth.logout');
  });

  it('persists user.created, user.role.changed, user.disabled, and user.enabled events', async () => {
    const { prisma, roles } = createAuditPrismaHarness();
    const auditService = new AuditService(prisma as never);
    const sessionService = new SessionService(prisma as never);
    const usersService = new UsersService(prisma as never, sessionService, auditService);

    const created = await usersService.createUser(
      {
        email: 'worker@example.com',
        password: 'StartPass123!',
        role: 'WAREHOUSE_STAFF'
      },
      'actor-admin'
    );

    await usersService.updateRole(
      created.id,
      'OFFICE_STAFF',
      {
        confirmed: true,
        action: 'user.role.change',
        targetUserId: created.id
      },
      'actor-admin'
    );

    await usersService.disableUser(
      created.id,
      {
        confirmed: true,
        action: 'user.disable',
        targetUserId: created.id
      },
      'actor-admin'
    );

    await usersService.enableUser(
      created.id,
      {
        confirmed: true,
        action: 'user.enable',
        targetUserId: created.id
      },
      'actor-admin'
    );

    const actions = prisma.auditLog.create.mock.calls.map((call) => call[0].data.action);
    expect(actions).toContain('user.created');
    expect(actions).toContain('user.role.changed');
    expect(actions).toContain('user.disabled');
    expect(actions).toContain('user.enabled');
  });
});
