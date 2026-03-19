import { Type } from 'class-transformer';
import { IsIn, ValidateNested } from 'class-validator';
import { ROLES, type RoleCode } from '../../access/roles';
import { ConfirmSensitiveActionDto } from './confirm-sensitive-action.dto';

export class UpdateRoleDto {
  @IsIn(ROLES)
  role!: RoleCode;

  @ValidateNested()
  @Type(() => ConfirmSensitiveActionDto)
  confirmation!: ConfirmSensitiveActionDto;
}
