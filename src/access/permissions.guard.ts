import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getPermissionsForRole } from './role-permission.matrix';
import { isRoleCode, type RoleCode } from './roles';
import { REQUIRED_PERMISSIONS_KEY } from './require-permissions.decorator';
import type { PermissionCode } from './permissions';

type GuardRequest = {
  user?: {
    role?: string;
  };
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions =
      this.reflector.getAllAndOverride<PermissionCode[]>(REQUIRED_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass()
      ]) ?? [];

    if (requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<GuardRequest>();
    const role = request.user?.role;

    if (!role || !isRoleCode(role)) {
      throw new ForbiddenException('Missing role context');
    }

    const rolePermissions = new Set(getPermissionsForRole(role as RoleCode));
    const allowed = requiredPermissions.every((permission) => rolePermissions.has(permission));

    if (!allowed) {
      throw new ForbiddenException('Missing required permissions');
    }

    return true;
  }
}
