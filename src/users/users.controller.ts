import { Body, Controller, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { PERMISSIONS } from '../access/permissions';
import { PermissionsGuard } from '../access/permissions.guard';
import { RequirePermissions } from '../access/require-permissions.decorator';
import { SessionAuthGuard } from '../auth/auth.service';
import { ConfirmSensitiveActionDto } from './dto/confirm-sensitive-action.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UsersService } from './users.service';

type AuthenticatedRequest = {
  user?: {
    id: string;
  };
};

@Controller('users')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  async create(
    @Body() body: CreateUserDto,
    @Req() request: AuthenticatedRequest
  ): Promise<{ user: unknown }> {
    const user = await this.usersService.createUser(body, request.user?.id ?? null);
    return { user };
  }

  @Patch(':id/role')
  @RequirePermissions(PERMISSIONS.USERS_MANAGE, PERMISSIONS.ROLES_MANAGE)
  async updateRole(
    @Param('id') id: string,
    @Body() body: UpdateRoleDto,
    @Req() request: AuthenticatedRequest
  ): Promise<{ user: unknown }> {
    const user = await this.usersService.updateRole(
      id,
      body.role,
      body.confirmation,
      request.user?.id ?? null
    );
    return { user };
  }

  @Patch(':id/disable')
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  async disable(
    @Param('id') id: string,
    @Body() confirmation: ConfirmSensitiveActionDto,
    @Req() request: AuthenticatedRequest
  ): Promise<{ user: unknown }> {
    const user = await this.usersService.disableUser(id, confirmation, request.user?.id ?? null);
    return { user };
  }

  @Patch(':id/enable')
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  async enable(
    @Param('id') id: string,
    @Body() confirmation: ConfirmSensitiveActionDto,
    @Req() request: AuthenticatedRequest
  ): Promise<{ user: unknown }> {
    const user = await this.usersService.enableUser(id, confirmation, request.user?.id ?? null);
    return { user };
  }

  @Patch(':id/password') // PATCH /users/:id/password
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  async resetPassword(
    @Param('id') id: string,
    @Body() body: ResetPasswordDto
  ): Promise<{ user: unknown }> {
    const user = await this.usersService.resetPassword(id, body);
    return { user };
  }
}
