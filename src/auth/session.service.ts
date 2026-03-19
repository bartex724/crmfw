import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type { RoleCode } from '../access/roles';
import { PrismaService } from '../database/prisma.service';

const IDLE_TIMEOUT_MS = 24 * 60 * 60 * 1000;
const REMEMBER_ME_TIMEOUT_MS = 30 * 24 * 60 * 60 * 1000;

type SessionUser = {
  id: string;
  email: string;
  isActive: boolean;
  role: {
    code: RoleCode;
  };
};

export type AuthenticatedUser = {
  id: string;
  email: string;
  role: RoleCode;
};

type SessionWithUser = {
  id: string;
  userId: string;
  isActive: boolean;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  revokedAt: Date | null;
  user: SessionUser;
};

type CreateSessionInput = {
  userId: string;
  rememberMe: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  now?: Date;
};

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(input: CreateSessionInput): Promise<{ token: string }> {
    const now = input.now ?? new Date();
    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);
    const idleExpiresAt = new Date(now.getTime() + IDLE_TIMEOUT_MS);
    const absoluteExpiresAt = input.rememberMe
      ? new Date(now.getTime() + REMEMBER_ME_TIMEOUT_MS)
      : new Date(now.getTime() + IDLE_TIMEOUT_MS);

    await this.prisma.session.create({
      data: {
        userId: input.userId,
        tokenHash,
        isActive: true,
        idleExpiresAt,
        absoluteExpiresAt,
        lastActivityAt: now,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent
      }
    });

    return { token };
  }

  async getAuthenticatedUser(token: string, now: Date = new Date()): Promise<AuthenticatedUser | null> {
    const session = await this.prisma.session.findUnique({
      where: {
        tokenHash: this.hashToken(token)
      },
      include: {
        user: {
          include: {
            role: true
          }
        }
      }
    });

    if (!session || !session.user) {
      return null;
    }

    const resolvedSession = session as unknown as SessionWithUser;

    if (!this.isSessionActive(resolvedSession, now)) {
      await this.expireSession(resolvedSession.id, now);
      return null;
    }

    const nextIdleExpiry = new Date(now.getTime() + IDLE_TIMEOUT_MS);
    await this.prisma.session.update({
      where: { id: resolvedSession.id },
      data: {
        lastActivityAt: now,
        idleExpiresAt: nextIdleExpiry
      }
    });

    return {
      id: resolvedSession.user.id,
      email: resolvedSession.user.email,
      role: resolvedSession.user.role.code
    };
  }

  async revokeByToken(token: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: {
        tokenHash: this.hashToken(token),
        isActive: true
      },
      data: {
        isActive: false,
        revokedAt: new Date()
      }
    });
  }

  async revokeUserSessions(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: {
        userId,
        isActive: true
      },
      data: {
        isActive: false,
        revokedAt: new Date()
      }
    });
  }

  getPolicy(): { idleTimeoutMs: number; rememberMeAbsoluteTimeoutMs: number } {
    return {
      idleTimeoutMs: IDLE_TIMEOUT_MS,
      rememberMeAbsoluteTimeoutMs: REMEMBER_ME_TIMEOUT_MS
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private isSessionActive(session: SessionWithUser, now: Date): boolean {
    if (!session.isActive) {
      return false;
    }

    if (session.revokedAt) {
      return false;
    }

    if (session.idleExpiresAt.getTime() <= now.getTime()) {
      return false;
    }

    if (session.absoluteExpiresAt.getTime() <= now.getTime()) {
      return false;
    }

    return true;
  }

  private async expireSession(sessionId: string, now: Date): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        isActive: false,
        revokedAt: now
      }
    });
  }
}
