import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { isRoleCode } from '../access/roles';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { LoginThrottleService, loginThrottleKey } from '../security/throttling.config';
import { SessionService, type AuthenticatedUser } from './session.service';

type LoginInput = {
  email: string;
  password: string;
  rememberMe: boolean;
  ipAddress: string | null;
  userAgent: string | null;
};

type SessionRequest = {
  headers: Record<string, string | string[] | undefined>;
  user?: AuthenticatedUser;
  sessionToken?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
    private readonly auditService: AuditService,
    private readonly loginThrottleService: LoginThrottleService
  ) {}

  async login(input: LoginInput): Promise<{ token: string; user: AuthenticatedUser }> {
    const throttleKey = loginThrottleKey(input.ipAddress, input.email);
    if (!this.loginThrottleService.isAllowed(throttleKey)) {
      await this.auditService.record({
        action: 'auth.login.failure',
        entityType: 'auth',
        metadata: {
          email: input.email,
          reason: 'throttled'
        },
        ipAddress: input.ipAddress,
        userAgent: input.userAgent
      });
      throw new HttpException('Too many login attempts', HttpStatus.TOO_MANY_REQUESTS);
    }

    const user = await this.prisma.user.findUnique({
      where: {
        email: input.email
      },
      include: {
        role: true
      }
    });

    if (!user || !user.isActive) {
      await this.auditService.record({
        action: 'auth.login.failure',
        entityType: 'auth',
        metadata: {
          email: input.email
        },
        ipAddress: input.ipAddress,
        userAgent: input.userAgent
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const validPassword = await argon2.verify(user.passwordHash, input.password);
    if (!validPassword) {
      await this.auditService.record({
        action: 'auth.login.failure',
        entityType: 'auth',
        actorUserId: user.id,
        targetUserId: user.id,
        metadata: {
          email: input.email
        },
        ipAddress: input.ipAddress,
        userAgent: input.userAgent
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const session = await this.sessionService.createSession({
      userId: user.id,
      rememberMe: input.rememberMe,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent
    });

    await this.auditService.record({
      action: 'auth.login.success',
      entityType: 'auth',
      actorUserId: user.id,
      targetUserId: user.id,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent
    });

    return {
      token: session.token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role.code
      }
    };
  }

  async logoutByToken(
    token: string,
    actorUserId: string | null = null,
    ipAddress: string | null = null,
    userAgent: string | null = null
  ): Promise<void> {
    await this.sessionService.revokeByToken(token);
    await this.auditService.record({
      action: 'auth.logout',
      entityType: 'auth',
      actorUserId,
      targetUserId: actorUserId,
      ipAddress,
      userAgent
    });
  }

  async getAuthenticatedUserFromToken(token: string): Promise<AuthenticatedUser | null> {
    return this.sessionService.getAuthenticatedUser(token);
  }
}

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<SessionRequest>();
    const testRoleHeader = request.headers['x-test-role'];

    if (process.env.NODE_ENV === 'test') {
      const candidateRole = Array.isArray(testRoleHeader) ? testRoleHeader[0] : testRoleHeader;
      if (typeof candidateRole === 'string' && isRoleCode(candidateRole)) {
        request.user = {
          id: 'test-user',
          email: 'test@example.com',
          role: candidateRole
        };
        request.sessionToken = 'test-session-token';
        return true;
      }
    }

    const token = readCookieValue(request.headers.cookie, 'sid');
    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    const user = await this.authService.getAuthenticatedUserFromToken(token);
    if (!user) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    request.user = user;
    request.sessionToken = token;
    return true;
  }
}

function readCookieValue(
  cookieHeader: string | string[] | undefined,
  cookieName: string
): string | null {
  const normalizedHeader = Array.isArray(cookieHeader) ? cookieHeader.join(';') : cookieHeader;
  if (!normalizedHeader) {
    return null;
  }

  const entries = normalizedHeader.split(';');
  for (const entry of entries) {
    const [name, ...valueParts] = entry.trim().split('=');
    if (name === cookieName) {
      return decodeURIComponent(valueParts.join('='));
    }
  }

  return null;
}
