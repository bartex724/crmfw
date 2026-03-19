import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import type { RoleCode } from '../access/roles';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { SessionService } from '../auth/session.service';
import { ConfirmSensitiveActionDto } from './dto/confirm-sensitive-action.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

type UserSummary = {
  id: string;
  email: string;
  isActive: boolean;
  role: RoleCode;
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
    private readonly auditService: AuditService
  ) {}

  async createUser(dto: CreateUserDto, actorUserId: string | null): Promise<UserSummary> {
    const role = await this.prisma.role.findUnique({
      where: { code: dto.role }
    });

    if (!role) {
      throw new BadRequestException(`Unknown role code: ${dto.role}`);
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        roleId: role.id,
        isActive: true
      },
      include: {
        role: true
      }
    });

    await this.auditService.record({
      action: 'user.created',
      entityType: 'user',
      entityId: user.id,
      actorUserId,
      targetUserId: user.id,
      metadata: {
        role: user.role.code
      }
    });

    return {
      id: user.id,
      email: user.email,
      isActive: user.isActive,
      role: user.role.code
    };
  }

  async updateRole(
    userId: string,
    roleCode: RoleCode,
    confirmation: ConfirmSensitiveActionDto,
    actorUserId: string | null
  ): Promise<UserSummary> {
    this.ensureSensitiveConfirmation(confirmation, 'user.role.change', userId);

    const role = await this.prisma.role.findUnique({
      where: { code: roleCode }
    });

    if (!role) {
      throw new BadRequestException(`Unknown role code: ${roleCode}`);
    }

    const user = await this.prisma.user
      .update({
        where: { id: userId },
        data: { roleId: role.id },
        include: {
          role: true
        }
      })
      .catch(() => null);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.auditService.record({
      action: 'user.role.changed',
      entityType: 'user',
      entityId: user.id,
      actorUserId,
      targetUserId: user.id,
      metadata: {
        role: user.role.code
      }
    });

    return {
      id: user.id,
      email: user.email,
      isActive: user.isActive,
      role: user.role.code
    };
  }

  async disableUser(
    userId: string,
    confirmation: ConfirmSensitiveActionDto,
    actorUserId: string | null
  ): Promise<UserSummary> {
    this.ensureSensitiveConfirmation(confirmation, 'user.disable', userId);

    const user = await this.prisma.user
      .update({
        where: { id: userId },
        data: {
          isActive: false,
          disabledAt: new Date()
        },
        include: {
          role: true
        }
      })
      .catch(() => null);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.sessionService.revokeUserSessions(userId);
    await this.auditService.record({
      action: 'user.disabled',
      entityType: 'user',
      entityId: user.id,
      actorUserId,
      targetUserId: user.id,
      metadata: {
        disabledAt: user.disabledAt?.toISOString() ?? null
      }
    });

    return {
      id: user.id,
      email: user.email,
      isActive: user.isActive,
      role: user.role.code
    };
  }

  async enableUser(
    userId: string,
    confirmation: ConfirmSensitiveActionDto,
    actorUserId: string | null
  ): Promise<UserSummary> {
    this.ensureSensitiveConfirmation(confirmation, 'user.enable', userId);

    const user = await this.prisma.user
      .update({
        where: { id: userId },
        data: {
          isActive: true,
          disabledAt: null
        },
        include: {
          role: true
        }
      })
      .catch(() => null);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.auditService.record({
      action: 'user.enabled',
      entityType: 'user',
      entityId: user.id,
      actorUserId,
      targetUserId: user.id
    });

    return {
      id: user.id,
      email: user.email,
      isActive: user.isActive,
      role: user.role.code
    };
  }

  async resetPassword(userId: string, dto: ResetPasswordDto): Promise<UserSummary> {
    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user
      .update({
        where: { id: userId },
        data: {
          passwordHash
        },
        include: {
          role: true
        }
      })
      .catch(() => null);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.sessionService.revokeUserSessions(userId);
    await this.auditService.record({
      action: 'user.password.reset',
      entityType: 'user',
      entityId: user.id,
      targetUserId: user.id
    });

    return {
      id: user.id,
      email: user.email,
      isActive: user.isActive,
      role: user.role.code
    };
  }

  private ensureSensitiveConfirmation(
    confirmation: ConfirmSensitiveActionDto,
    expectedAction: string,
    targetUserId: string
  ): void {
    const valid =
      Boolean(confirmation?.confirmed) &&
      confirmation.action === expectedAction &&
      confirmation.targetUserId === targetUserId;

    if (!valid) {
      throw new BadRequestException({
        code: 'ADMIN_CONFIRMATION_REQUIRED',
        message: 'ADMIN_CONFIRMATION_REQUIRED'
      });
    }
  }
}
