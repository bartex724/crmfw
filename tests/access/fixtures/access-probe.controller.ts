import {
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  Injectable,
  Post,
  UseGuards
} from '@nestjs/common';
import { PERMISSIONS } from '../../../src/access/permissions';
import { PermissionsGuard } from '../../../src/access/permissions.guard';
import { RequirePermissions } from '../../../src/access/require-permissions.decorator';
import { isRoleCode } from '../../../src/access/roles';

type ProbeRequest = {
  headers: Record<string, string | string[] | undefined>;
  user?: {
    role: string;
  };
};

@Injectable()
export class HeaderRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<ProbeRequest>();
    const roleHeader = request.headers['x-role'];
    const role = Array.isArray(roleHeader) ? roleHeader[0] : roleHeader;
    const resolvedRole = typeof role === 'string' && isRoleCode(role) ? role : 'GUEST';

    request.user = { role: resolvedRole };
    return true;
  }
}

@Controller('access-probe')
@UseGuards(HeaderRoleGuard, PermissionsGuard)
export class AccessProbeController {
  @Get('inventory/read')
  @RequirePermissions(PERMISSIONS.INVENTORY_READ)
  inventoryRead(): { ok: boolean } {
    return { ok: true };
  }

  @Post('inventory/write')
  @RequirePermissions(PERMISSIONS.INVENTORY_WRITE)
  inventoryWrite(): { ok: boolean } {
    return { ok: true };
  }

  @Post('events/write')
  @RequirePermissions(PERMISSIONS.EVENTS_WRITE)
  eventsWrite(): { ok: boolean } {
    return { ok: true };
  }

  @Post('boxes/write')
  @RequirePermissions(PERMISSIONS.BOXES_WRITE)
  boxesWrite(): { ok: boolean } {
    return { ok: true };
  }

  @Get('exports')
  @RequirePermissions(PERMISSIONS.EXPORTS_READ)
  exportsRead(): { ok: boolean } {
    return { ok: true };
  }
}
